use super::types::*;
use super::LLMProvider;
use async_trait::async_trait;
use futures_util::{stream, Stream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

const OPENAI_BASE_URL: &str = "https://api.openai.com/v1";

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
    choices: Vec<OpenAIStreamChoice>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIStreamChoice {
    delta: OpenAIDelta,
    #[serde(skip_serializing_if = "Option::is_none")]
    finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Clone)]
pub struct OpenAIProvider {
    provider_id: ProviderId,
    provider_name: &'static str,
    api_key: String,
    base_url: String,
    client: Client,
}

impl OpenAIProvider {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        Self::compatible(
            ProviderId::OpenAI,
            "OpenAI GPT",
            api_key,
            base_url,
            OPENAI_BASE_URL,
        )
    }

    pub fn compatible(
        provider_id: ProviderId,
        provider_name: &'static str,
        api_key: String,
        base_url: Option<String>,
        default_base_url: &'static str,
    ) -> Self {
        Self {
            provider_id,
            provider_name,
            api_key,
            base_url: base_url.unwrap_or_else(|| default_base_url.to_string()),
            client: Client::new(),
        }
    }

    fn with_provider_headers(
        &self,
        request: reqwest::RequestBuilder,
    ) -> reqwest::RequestBuilder {
        let request = request.header("content-type", "application/json");
        if self.api_key.trim().is_empty() {
            request
        } else {
            request.header("Authorization", format!("Bearer {}", self.api_key))
        }
    }

    async fn api_error_from_response(&self, response: reqwest::Response) -> LLMError {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();

        if self.provider_id == ProviderId::Ollama && status.is_server_error() {
            return LLMError::ApiError(format!(
                "Ollama server unreachable or unavailable at {}. Start Ollama and confirm the configured base URL. Details: {}",
                self.base_url, error_text
            ));
        }

        if status == reqwest::StatusCode::NOT_FOUND
            || error_text.to_lowercase().contains("model")
                && error_text.to_lowercase().contains("not found")
        {
            return LLMError::ApiError(format!(
                "{} model not found. Check the configured model name. Details: {}",
                self.provider_name, error_text
            ));
        }

        LLMError::ApiError(format!("{} API error: {}", self.provider_name, error_text))
    }

    fn request_error(&self, error: reqwest::Error) -> LLMError {
        if self.provider_id == ProviderId::Ollama && error.is_connect() {
            return LLMError::ApiError(format!(
                "Ollama server unreachable. Start Ollama and confirm the base URL (default http://localhost:11434/v1). Details: {}",
                error
            ));
        }

        LLMError::RequestError(error)
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
            .with_provider_headers(self.client.post(format!(
                "{}/chat/completions",
                self.base_url.trim_end_matches('/')
            )))
            .json(&openai_request)
            .send()
            .await
            .map_err(|error| self.request_error(error))?;

        if !response.status().is_success() {
            return Err(self.api_error_from_response(response).await);
        }

        let completion: ChatCompletionResponse = response.json().await?;
        Ok(completion)
    }

    async fn do_stream_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> impl Stream<Item = StreamEvent> + Send {
        let event_id = uuid::Uuid::new_v4().to_string();

        let has_system = request
            .messages
            .iter()
            .any(|message| message.role == MessageRole::System);

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

        match self
            .with_provider_headers(self.client.post(format!(
                "{}/chat/completions",
                self.base_url.trim_end_matches('/')
            )))
            .json(&openai_request)
            .send()
            .await
        {
            Ok(response) => {
                if !response.status().is_success() {
                    let error = self.api_error_from_response(response).await.to_string();
                    return stream::once(async move { StreamEvent::Error { message: error } })
                        .boxed();
                }

                let start = stream::once({
                    let id = event_id.clone();
                    async move { StreamEvent::Start { id } }
                });

                let stream = response
                    .bytes_stream()
                    .map(|result| match result {
                        Ok(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                        Err(error) => format!("Error reading stream: {}", error),
                    })
                    .flat_map(|chunk| {
                        let lines = chunk
                            .lines()
                            .filter(|line| !line.is_empty())
                            .map(|line| line.to_string())
                            .collect::<Vec<_>>();
                        futures_util::stream::iter(lines)
                    })
                    .filter_map(|line| async move {
                        line.strip_prefix("data: ").map(|value| value.to_string())
                    })
                    .take_while(|line| std::future::ready(line.as_str() != "[DONE]"))
                    .filter_map(|json| async move {
                        serde_json::from_str::<OpenAIStreamChunk>(&json).ok()
                    })
                    .map(|chunk| {
                        let Some(choice) = chunk.choices.first() else {
                            return StreamEvent::Content {
                                delta: String::new(),
                            };
                        };

                        if let Some(finish_reason) = choice.finish_reason.clone() {
                            return StreamEvent::Done {
                                finish_reason: Some(finish_reason),
                                usage: None,
                            };
                        }

                        if let Some(content) = choice.delta.content.clone() {
                            return StreamEvent::Content { delta: content };
                        }

                        if let Some(tool_call) = choice
                            .delta
                            .tool_calls
                            .as_ref()
                            .and_then(|tool_calls| tool_calls.first().cloned())
                        {
                            return StreamEvent::ToolCall { tool_call };
                        }

                        StreamEvent::Content {
                            delta: String::new(),
                        }
                    });

                start.chain(stream).boxed()
            }
            Err(error) => {
                let message = self.request_error(error).to_string();
                stream::once(async move { StreamEvent::Error { message } }).boxed()
            }
        }
    }
}

#[async_trait]
impl LLMProvider for OpenAIProvider {
    fn name(&self) -> &'static str {
        self.provider_name
    }

    fn provider_id(&self) -> ProviderId {
        self.provider_id
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
