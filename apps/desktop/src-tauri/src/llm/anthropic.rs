use super::types::*;
use super::LLMProvider;
use async_trait::async_trait;
use futures_util::{stream, Stream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

const ANTHROPIC_BASE_URL: &str = "https://api.anthropic.com";
const DEFAULT_MODEL: &str = "claude-3-5-sonnet-20241022";

/// Anthropic-specific message format
#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnthropicMessage {
    role: String,
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum AnthropicContent {
    Text {
        text: String,
    },
    Image {
        source: AnthropicImageSource,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnthropicImageSource {
    #[serde(rename = "type")]
    media_type: String,
    data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnthropicTool {
    name: String,
    description: String,
    input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<AnthropicTool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
}

#[derive(Debug, Clone, Deserialize)]
struct AnthropicResponse {
    id: String,
    #[serde(rename = "type")]
    response_type: String,
    role: String,
    content: Vec<AnthropicContent>,
    stop_reason: Option<String>,
    usage: Option<AnthropicUsage>,
    model: String,
}

#[derive(Debug, Clone, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct AnthropicStreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    index: Option<u32>,
    delta: Option<AnthropicDelta>,
    usage: Option<AnthropicUsage>,
    stop_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct AnthropicDelta {
    #[serde(rename = "type")]
    delta_type: Option<String>,
    text: Option<String>,
    partial_json: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AnthropicProvider {
    api_key: String,
    base_url: String,
    client: Client,
}

impl AnthropicProvider {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        Self {
            api_key,
            base_url: base_url.unwrap_or(ANTHROPIC_BASE_URL.to_string()),
            client: Client::new(),
        }
    }

    fn convert_message(msg: &Message) -> AnthropicMessage {
        match msg.role {
            MessageRole::User => AnthropicMessage {
                role: "user".to_string(),
                content: vec![AnthropicContent::Text {
                    text: msg.content.clone(),
                }],
            },
            MessageRole::Assistant => {
                let mut content = Vec::new();

                if !msg.content.is_empty() {
                    content.push(AnthropicContent::Text {
                        text: msg.content.clone(),
                    });
                }

                if let Some(tool_calls) = &msg.tool_calls {
                    content.extend(tool_calls.iter().filter_map(|tool_call| {
                        serde_json::from_str::<serde_json::Value>(&tool_call.function.arguments)
                            .ok()
                            .map(|input| AnthropicContent::ToolUse {
                                id: tool_call.id.clone(),
                                name: tool_call.function.name.clone(),
                                input,
                            })
                    }));
                }

                if content.is_empty() {
                    content.push(AnthropicContent::Text {
                        text: String::new(),
                    });
                }

                AnthropicMessage {
                    role: "assistant".to_string(),
                    content,
                }
            }
            MessageRole::System => AnthropicMessage {
                role: "user".to_string(),
                content: vec![AnthropicContent::Text {
                    text: format!("<system>{}</system>", msg.content),
                }],
            },
            MessageRole::Tool => {
                let tool_use_id = msg
                    .tool_call_id
                    .clone()
                    .unwrap_or_else(|| "tool_result".to_string());
                let is_error = msg.content.starts_with("Tool execution failed:")
                    || msg.content == "Tool request denied by user.";

                AnthropicMessage {
                    role: "user".to_string(),
                    content: vec![AnthropicContent::ToolResult {
                        tool_use_id,
                        content: msg.content.clone(),
                        is_error: if is_error { Some(true) } else { None },
                    }],
                }
            }
        }
    }

    fn convert_tools(tools: &[ToolDefinition]) -> Option<Vec<AnthropicTool>> {
        if tools.is_empty() {
            return None;
        }
        Some(
            tools
                .iter()
                .map(|t| AnthropicTool {
                    name: t.function.name.clone(),
                    description: t.function.description.clone(),
                    input_schema: t
                        .function
                        .parameters
                        .clone()
                        .unwrap_or(serde_json::json!({})),
                })
                .collect(),
        )
    }

    async fn do_chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, LLMError> {
        let system_message = request
            .messages
            .iter()
            .find(|m| m.role == MessageRole::System);

        let messages: Vec<_> = request
            .messages
            .iter()
            .filter(|m| m.role != MessageRole::System)
            .map(Self::convert_message)
            .collect();

        let anthropic_request = AnthropicRequest {
            model: request.model,
            max_tokens: request.max_tokens.unwrap_or(4096),
            messages,
            system: system_message.map(|m| m.content.clone()),
            tools: Self::convert_tools(&request.tools.unwrap_or_default()),
            stream: Some(false),
            temperature: request.temperature,
            top_p: request.top_p,
        };

        let response = self
            .client
            .post(format!("{}/v1/messages", self.base_url))
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&anthropic_request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(LLMError::ApiError(format!(
                "Anthropic API error: {}",
                error_text
            )));
        }

        let anthropic_response: AnthropicResponse = response.json().await?;

        // Convert Anthropic response to standard format
        let assistant_content: String = anthropic_response
            .content
            .iter()
            .filter_map(|c| match c {
                AnthropicContent::Text { text } => Some(text.clone()),
                _ => None,
            })
            .collect();

        let tool_calls: Option<Vec<ToolCall>> = if anthropic_response
            .content
            .iter()
            .any(|c| matches!(c, AnthropicContent::ToolUse { .. }))
        {
            Some(
                anthropic_response
                    .content
                    .iter()
                    .filter_map(|c| match c {
                        AnthropicContent::ToolUse { id, name, input } => Some(ToolCall {
                            id: id.clone(),
                            r#type: "function".to_string(),
                            function: FunctionCall {
                                name: name.clone(),
                                arguments: serde_json::to_string(input).unwrap_or_default(),
                            },
                        }),
                        _ => None,
                    })
                    .collect(),
            )
        } else {
            None
        };

        Ok(ChatCompletionResponse {
            id: anthropic_response.id,
            object: "chat.completion".to_string(),
            created: chrono::Utc::now().timestamp() as u64,
            model: anthropic_response.model,
            choices: vec![Choice {
                index: 0,
                message: Message {
                    role: MessageRole::Assistant,
                    content: assistant_content,
                    tool_calls,
                    tool_call_id: None,
                },
                finish_reason: anthropic_response.stop_reason,
            }],
            usage: anthropic_response.usage.map(|u| Usage {
                prompt_tokens: u.input_tokens,
                completion_tokens: u.output_tokens,
                total_tokens: u.input_tokens + u.output_tokens,
            }),
        })
    }

    async fn do_stream_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> impl Stream<Item = StreamEvent> + Send {
        let system_message = request
            .messages
            .iter()
            .find(|m| m.role == MessageRole::System);

        let messages: Vec<_> = request
            .messages
            .iter()
            .filter(|m| m.role != MessageRole::System)
            .map(Self::convert_message)
            .collect();

        let anthropic_request = AnthropicRequest {
            model: request.model,
            max_tokens: request.max_tokens.unwrap_or(4096),
            messages,
            system: system_message.map(|m| m.content.clone()),
            tools: Self::convert_tools(&request.tools.unwrap_or_default()),
            stream: Some(true),
            temperature: request.temperature,
            top_p: request.top_p,
        };

        let id = uuid::Uuid::new_v4().to_string();
        let event_id = id.clone();

        let result = async move {
            match self
                .client
                .post(format!("{}/v1/messages", self.base_url))
                .header("x-api-key", &self.api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&anthropic_request)
                .send()
                .await
            {
                Ok(response) => {
                    if !response.status().is_success() {
                        let error_text = response.text().await.unwrap_or_default();
                        return stream::once(async move {
                            StreamEvent::Error {
                                message: format!("Anthropic API error: {}", error_text),
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
                        .filter_map(|json| async move {
                            serde_json::from_str::<AnthropicStreamEvent>(&json).ok()
                        })
                        .map(move |event| {
                            match event.event_type.as_str() {
                                "message_start" => StreamEvent::Start {
                                    id: event_id.clone(),
                                },
                                "content_block_start" => {
                                    if let Some(delta) = event.delta {
                                        if let Some(ref t) = delta.delta_type {
                                            if t == "tool_use" {
                                                // Tool use start - would need to collect full tool
                                                StreamEvent::Content {
                                                    delta: String::new(),
                                                }
                                            } else {
                                                StreamEvent::Content {
                                                    delta: String::new(),
                                                }
                                            }
                                        } else {
                                            StreamEvent::Content {
                                                delta: String::new(),
                                            }
                                        }
                                    } else {
                                        StreamEvent::Content {
                                            delta: String::new(),
                                        }
                                    }
                                }
                                "content_block_delta" => {
                                    if let Some(delta) = event.delta {
                                        if let Some(text) = delta.text {
                                            StreamEvent::Content { delta: text }
                                        } else if let Some(partial_json) = delta.partial_json {
                                            StreamEvent::Content {
                                                delta: partial_json,
                                            }
                                        } else {
                                            StreamEvent::Content {
                                                delta: String::new(),
                                            }
                                        }
                                    } else {
                                        StreamEvent::Content {
                                            delta: String::new(),
                                        }
                                    }
                                }
                                "message_stop" => StreamEvent::Done {
                                    finish_reason: event.stop_reason,
                                    usage: event.usage.map(|u| Usage {
                                        prompt_tokens: u.input_tokens,
                                        completion_tokens: u.output_tokens,
                                        total_tokens: u.input_tokens + u.output_tokens,
                                    }),
                                },
                                "error" => StreamEvent::Error {
                                    message: "Anthropic stream error".to_string(),
                                },
                                _ => StreamEvent::Content {
                                    delta: String::new(),
                                },
                            }
                        });

                    stream.boxed()
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
impl LLMProvider for AnthropicProvider {
    fn name(&self) -> &'static str {
        "Anthropic Claude"
    }

    fn provider_id(&self) -> ProviderId {
        ProviderId::Anthropic
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

impl Default for AnthropicProvider {
    fn default() -> Self {
        Self::new(String::new(), None)
    }
}
