use super::types::*;
use super::LLMProvider;
use async_trait::async_trait;
use futures_util::{stream, Stream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

const OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "gpt-4o";

#[derive(Debug, Clone, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<ToolDefinition>>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIStreamChunk {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<OpenAIStreamChoice>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIStreamChoice {
    index: u32,
    delta: OpenAIDelta,
    #[serde(skip_serializing_if = "Option::is_none")]
    finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<MessageRole>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct OpenAIProvider {
    api_key: String,
    base_url: String,
    client: Client,
}

impl OpenAIProvider {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        Self {
            api_key,
            base_url: base_url.unwrap_or(OPENAI_BASE_URL.to_string()),
            client: Client::new(),
        }
    }

    async fn do_chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, LLMError> {
        let openai_request = OpenAIRequest {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stream: Some(false),
            tools: request.tools,
        };

        let response = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("content-type", "application/json")
            .json(&openai_request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(LLMError::ApiError(format!(
                "OpenAI API error: {}",
                error_text
            )));
        }

        let completion: ChatCompletionResponse = response.json().await?;
        Ok(completion)
    }

    async fn do_stream_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> impl Stream<Item = StreamEvent> + Send {
        let id = uuid::Uuid::new_v4().to_string();
        let event_id = id.clone();

        // Ensure messages have system role properly
        let has_system = request
            .messages
            .iter()
            .any(|m| m.role == MessageRole::System);

        let mut openai_request = OpenAIRequest {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stream: Some(true),
            tools: request.tools,
        };

        if !has_system {
            openai_request.messages.insert(
                0,
                Message {
                    role: MessageRole::System,
                    content: "You are a helpful AI assistant.".to_string(),
                    tool_calls: None,
                    tool_call_id: None,
                },
            );
        }

        let result = async move {
            match self
                .client
                .post(format!("{}/chat/completions", self.base_url))
                .header("Authorization", format!("Bearer {}", self.api_key))
                .header("content-type", "application/json")
                .json(&openai_request)
                .send()
                .await
            {
                Ok(response) => {
                    if !response.status().is_success() {
                        let error_text = response.text().await.unwrap_or_default();
                        return stream::once(async move {
                            StreamEvent::Error {
                                message: format!("OpenAI API error: {}", error_text),
                            }
                        })
                        .boxed();
                    }

                    let byte_stream = response.bytes_stream();
                    let stream = byte_stream
                        .map(|result| match result {
                            Ok(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                            Err(e) => format!("Error reading stream: {}", e),
                        })
                        .flat_map(|s| {
                            let mut lines = Vec::new();
                            for line in s.lines() {
                                if !line.is_empty() {
                                    lines.push(line.to_string());
                                }
                            }
                            futures_util::stream::iter(lines)
                        })
                        .filter_map(|line| async move {
                            line.strip_prefix("data: ").map(|s| s.to_string())
                        })
                        .take_while(|line| std::future::ready(line.as_str() != "[DONE]"))
                        .filter_map(|json| async move {
                            serde_json::from_str::<OpenAIStreamChunk>(&json).ok()
                        })
                        .map(move |chunk| {
                            if chunk.choices.is_empty() {
                                return StreamEvent::Content {
                                    delta: String::new(),
                                };
                            }

                            let choice = &chunk.choices[0];

                            if let Some(finish_reason) = choice.finish_reason.clone() {
                                return StreamEvent::Done {
                                    finish_reason: Some(finish_reason),
                                    usage: None,
                                };
                            }

                            if let Some(content) = choice.delta.content.clone() {
                                return StreamEvent::Content { delta: content };
                            }

                            if let Some(ref tool_calls) = choice.delta.tool_calls {
                                for tc in tool_calls {
                                    return StreamEvent::ToolCall {
                                        tool_call: tc.clone(),
                                    };
                                }
                            }

                            StreamEvent::Content {
                                delta: String::new(),
                            }
                        });

                    // Add start event
                    let start = stream::once(async move { StreamEvent::Start { id: event_id } });

                    start.chain(stream).boxed()
                }
                Err(e) => stream::once(async move {
                    StreamEvent::Error {
                        message: format!("Request failed: {}", e),
                    }
                })
                .boxed(),
            }
        };

        result.await
    }
}

#[async_trait]
impl LLMProvider for OpenAIProvider {
    fn name(&self) -> &'static str {
        "OpenAI GPT"
    }

    fn provider_id(&self) -> ProviderId {
        ProviderId::OpenAI
    }

    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, LLMError> {
        self.do_chat_completion(request).await
    }

    async fn stream_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Pin<Box<dyn Stream<Item = StreamEvent> + Send>> {
        Box::pin(self.do_stream_completion(request).await)
    }
}

impl Default for OpenAIProvider {
    fn default() -> Self {
        Self::new(String::new(), None)
    }
}
