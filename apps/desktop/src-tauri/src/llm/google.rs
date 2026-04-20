use super::types::*;
use super::LLMProvider;
use async_trait::async_trait;
use futures_util::{stream, Stream, StreamExt};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::pin::Pin;

const GOOGLE_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleResponse {
    #[serde(default)]
    candidates: Vec<GoogleCandidate>,
    #[serde(default)]
    usage_metadata: Option<GoogleUsageMetadata>,
    #[serde(default)]
    model_version: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct GoogleCandidate {
    #[serde(default)]
    content: Option<GoogleContent>,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct GoogleContent {
    #[serde(default)]
    parts: Vec<GooglePart>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleFunctionCall {
    name: String,
    #[serde(default)]
    args: Value,
    #[serde(default)]
    id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GooglePart {
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    function_call: Option<GoogleFunctionCall>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleUsageMetadata {
    #[serde(default)]
    prompt_token_count: Option<u32>,
    #[serde(default)]
    candidates_token_count: Option<u32>,
    #[serde(default)]
    total_token_count: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct GoogleProvider {
    api_key: String,
    base_url: String,
    client: Client,
}

impl GoogleProvider {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        Self {
            api_key,
            base_url: base_url.unwrap_or_else(|| GOOGLE_BASE_URL.to_string()),
            client: Client::new(),
        }
    }

    fn missing_key_error(&self) -> LLMError {
        LLMError::MissingApiKey("google".to_string())
    }

    fn endpoint(&self, model: &str, stream: bool) -> String {
        let base = self.base_url.trim_end_matches('/');
        let action = if stream {
            "streamGenerateContent?alt=sse"
        } else {
            "generateContent"
        };
        format!("{base}/models/{model}:{action}&key={key}",
            key = self.api_key,
        )
        .replace(":generateContent&", ":generateContent?")
    }

    fn system_instruction(messages: &[Message]) -> Option<Value> {
        let system = messages
            .iter()
            .filter(|message| message.role == MessageRole::System)
            .map(|message| message.content.trim())
            .filter(|content| !content.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n");

        if system.is_empty() {
            None
        } else {
            Some(json!({
                "parts": [{ "text": system }]
            }))
        }
    }

    fn tool_call_name_map(messages: &[Message]) -> HashMap<String, String> {
        let mut map = HashMap::new();

        for message in messages {
            if let Some(tool_calls) = &message.tool_calls {
                for tool_call in tool_calls {
                    map.insert(tool_call.id.clone(), tool_call.function.name.clone());
                }
            }
        }

        map
    }

    fn tool_result_payload(content: &str) -> Value {
        serde_json::from_str(content).unwrap_or_else(|_| json!({ "content": content }))
    }

    fn convert_message(message: &Message, tool_names: &HashMap<String, String>) -> Option<Value> {
        match message.role {
            MessageRole::System => None,
            MessageRole::User => Some(json!({
                "role": "user",
                "parts": [{ "text": message.content }]
            })),
            MessageRole::Assistant => {
                let mut parts = Vec::new();

                if !message.content.is_empty() {
                    parts.push(json!({ "text": message.content }));
                }

                if let Some(tool_calls) = &message.tool_calls {
                    for tool_call in tool_calls {
                        let args = serde_json::from_str::<Value>(&tool_call.function.arguments)
                            .unwrap_or_else(|_| json!({}));
                        parts.push(json!({
                            "functionCall": {
                                "name": tool_call.function.name,
                                "args": args
                            }
                        }));
                    }
                }

                if parts.is_empty() {
                    parts.push(json!({ "text": "" }));
                }

                Some(json!({
                    "role": "model",
                    "parts": parts
                }))
            }
            MessageRole::Tool => {
                let tool_call_id = message.tool_call_id.clone()?;
                let tool_name = tool_names
                    .get(&tool_call_id)
                    .cloned()
                    .unwrap_or_else(|| "tool".to_string());

                Some(json!({
                    "role": "user",
                    "parts": [{
                        "functionResponse": {
                            "name": tool_name,
                            "response": Self::tool_result_payload(&message.content)
                        }
                    }]
                }))
            }
        }
    }

    fn normalize_schema(value: Value) -> Value {
        match value {
            Value::Object(map) => {
                let mut next = Map::new();
                for (key, value) in map {
                    if key == "type" {
                        next.insert(key, Value::String(Self::schema_type_name(&value)));
                    } else {
                        next.insert(key, Self::normalize_schema(value));
                    }
                }
                Value::Object(next)
            }
            Value::Array(values) => Value::Array(values.into_iter().map(Self::normalize_schema).collect()),
            other => other,
        }
    }

    fn schema_type_name(value: &Value) -> String {
        match value.as_str().unwrap_or_default() {
            "object" => "OBJECT".to_string(),
            "array" => "ARRAY".to_string(),
            "string" => "STRING".to_string(),
            "number" => "NUMBER".to_string(),
            "integer" => "INTEGER".to_string(),
            "boolean" => "BOOLEAN".to_string(),
            "null" => "NULL".to_string(),
            other => other.to_ascii_uppercase(),
        }
    }

    fn convert_tools(tools: &[ToolDefinition]) -> Option<Value> {
        if tools.is_empty() {
            return None;
        }

        Some(json!([{
            "functionDeclarations": tools.iter().map(|tool| json!({
                "name": tool.function.name,
                "description": tool.function.description,
                "parameters": Self::normalize_schema(
                    tool.function.parameters.clone().unwrap_or_else(|| json!({
                        "type": "object",
                        "properties": {}
                    }))
                )
            })).collect::<Vec<_>>()
        }]))
    }

    fn build_request(&self, request: &ChatCompletionRequest) -> Value {
        let tool_names = Self::tool_call_name_map(&request.messages);
        let contents = request
            .messages
            .iter()
            .filter_map(|message| Self::convert_message(message, &tool_names))
            .collect::<Vec<_>>();

        let mut body = json!({
            "contents": contents,
        });

        if let Some(system_instruction) = Self::system_instruction(&request.messages) {
            body["systemInstruction"] = system_instruction;
        }

        if let Some(tools) = request.tools.as_ref().and_then(|tools| Self::convert_tools(tools)) {
            body["tools"] = tools;
        }

        let mut generation_config = Map::new();
        if let Some(temperature) = request.temperature {
            generation_config.insert("temperature".to_string(), json!(temperature));
        }
        if let Some(top_p) = request.top_p {
            generation_config.insert("topP".to_string(), json!(top_p));
        }
        if let Some(max_tokens) = request.max_tokens {
            generation_config.insert("maxOutputTokens".to_string(), json!(max_tokens));
        }
        if !generation_config.is_empty() {
            body["generationConfig"] = Value::Object(generation_config);
        }

        body
    }

    fn parse_response(
        &self,
        response: GoogleResponse,
        requested_model: &str,
    ) -> Result<ChatCompletionResponse, LLMError> {
        let candidate = response
            .candidates
            .into_iter()
            .next()
            .ok_or_else(|| LLMError::ApiError("Google returned an invalid response.".to_string()))?;

        let content = candidate.content.unwrap_or_default();
        let mut text = String::new();
        let mut tool_calls = Vec::new();

        for part in content.parts {
            if let Some(part_text) = part.text {
                text.push_str(&part_text);
            }

            if let Some(function_call) = part.function_call {
                tool_calls.push(ToolCall {
                    id: function_call
                        .id
                        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
                    r#type: "function".to_string(),
                    function: FunctionCall {
                        name: function_call.name,
                        arguments: serde_json::to_string(&function_call.args)?,
                    },
                });
            }
        }

        Ok(ChatCompletionResponse {
            id: uuid::Uuid::new_v4().to_string(),
            object: "chat.completion".to_string(),
            created: chrono::Utc::now().timestamp() as u64,
            model: response
                .model_version
                .unwrap_or_else(|| requested_model.to_string()),
            choices: vec![Choice {
                index: 0,
                message: Message {
                    role: MessageRole::Assistant,
                    content: text,
                    tool_calls: if tool_calls.is_empty() {
                        None
                    } else {
                        Some(tool_calls)
                    },
                    tool_call_id: None,
                },
                finish_reason: candidate.finish_reason,
            }],
            usage: response.usage_metadata.map(|usage| Usage {
                prompt_tokens: usage.prompt_token_count.unwrap_or_default(),
                completion_tokens: usage.candidates_token_count.unwrap_or_default(),
                total_tokens: usage.total_token_count.unwrap_or_default(),
            }),
        })
    }

    async fn api_error_from_response(&self, response: reqwest::Response) -> LLMError {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let lower = body.to_lowercase();

        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return LLMError::ApiError(format!(
                "Google API key rejected. Check the configured key and Gemini API access. Details: {}",
                body
            ));
        }

        if lower.contains("model") && lower.contains("not found") {
            return LLMError::ApiError(format!(
                "Google model not found. Check the configured Gemini model name. Details: {}",
                body
            ));
        }

        if lower.contains("function") && lower.contains("unsupported") {
            return LLMError::ApiError(format!(
                "Google returned an unsupported tool-call response shape. Details: {}",
                body
            ));
        }

        LLMError::ApiError(format!("Google API error: {}", body))
    }

    async fn do_chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, LLMError> {
        if self.api_key.trim().is_empty() {
            return Err(self.missing_key_error());
        }

        let requested_model = request.model.clone();
        let response = self
            .client
            .post(self.endpoint(&request.model, false))
            .header("content-type", "application/json")
            .json(&self.build_request(&request))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(self.api_error_from_response(response).await);
        }

        let google_response: GoogleResponse = response.json().await?;
        self.parse_response(google_response, &requested_model)
    }

    async fn do_stream_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Pin<Box<dyn Stream<Item = StreamEvent> + Send>> {
        if self.api_key.trim().is_empty() {
            return stream::once(async move {
                StreamEvent::Error {
                    message: "Google API key is required. Add it in Provider Settings.".to_string(),
                }
            })
            .boxed();
        }

        let requested_model = request.model.clone();
        let event_id = uuid::Uuid::new_v4().to_string();
        let provider = self.clone();

        match self
            .client
            .post(self.endpoint(&request.model, true))
            .header("content-type", "application/json")
            .json(&self.build_request(&request))
            .send()
            .await
        {
            Ok(response) => {
                if !response.status().is_success() {
                    let message = self.api_error_from_response(response).await.to_string();
                    return stream::once(async move { StreamEvent::Error { message } }).boxed();
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
                    .filter_map(|json| async move {
                        serde_json::from_str::<GoogleResponse>(&json).ok()
                    })
                    .flat_map(move |response| {
                        let requested_model = requested_model.clone();
                        match provider.parse_response(response, &requested_model) {
                            Ok(parsed) => {
                                let Some(choice) = parsed.choices.into_iter().next() else {
                                    return futures_util::stream::iter(vec![StreamEvent::Content {
                                        delta: String::new(),
                                    }]);
                                };

                                let mut events = Vec::new();
                                if !choice.message.content.is_empty() {
                                    events.push(StreamEvent::Content {
                                        delta: choice.message.content,
                                    });
                                }

                                if let Some(tool_call) = choice
                                    .message
                                    .tool_calls
                                    .and_then(|tool_calls| tool_calls.into_iter().next())
                                {
                                    events.push(StreamEvent::ToolCall { tool_call });
                                }

                                if let Some(finish_reason) = choice.finish_reason {
                                    events.push(StreamEvent::Done {
                                        finish_reason: Some(finish_reason),
                                        usage: parsed.usage,
                                    });
                                }

                                if events.is_empty() {
                                    events.push(StreamEvent::Content {
                                        delta: String::new(),
                                    });
                                }

                                futures_util::stream::iter(events)
                            }
                            Err(error) => futures_util::stream::iter(vec![StreamEvent::Error {
                                message: error.to_string(),
                            }]),
                        }
                    });

                start.chain(stream).boxed()
            }
            Err(error) => stream::once(async move {
                StreamEvent::Error {
                    message: format!("Google request failed: {}", error),
                }
            })
            .boxed(),
        }
    }
}

#[async_trait]
impl LLMProvider for GoogleProvider {
    fn name(&self) -> &'static str {
        "Google Gemini"
    }

    fn provider_id(&self) -> ProviderId {
        ProviderId::Google
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
        self.do_stream_completion(request).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_google_schema_types() {
        let schema = json!({
            "type": "object",
            "properties": {
                "path": { "type": "string" },
                "tags": {
                    "type": "array",
                    "items": { "type": "string" }
                }
            }
        });

        let normalized = GoogleProvider::normalize_schema(schema);
        assert_eq!(normalized["type"], "OBJECT");
        assert_eq!(normalized["properties"]["path"]["type"], "STRING");
        assert_eq!(normalized["properties"]["tags"]["type"], "ARRAY");
        assert_eq!(normalized["properties"]["tags"]["items"]["type"], "STRING");
    }

    #[test]
    fn parses_tool_calls_from_google_response() {
        let provider = GoogleProvider::new("test".to_string(), None);
        let response = GoogleResponse {
            candidates: vec![GoogleCandidate {
                content: Some(GoogleContent {
                    parts: vec![GooglePart {
                        text: None,
                        function_call: Some(GoogleFunctionCall {
                            name: "read-file".to_string(),
                            args: json!({ "path": "README.md" }),
                            id: Some("call-1".to_string()),
                        }),
                    }],
                }),
                finish_reason: Some("STOP".to_string()),
            }],
            usage_metadata: None,
            model_version: Some("gemini-2.5-flash".to_string()),
        };

        let parsed = provider
            .parse_response(response, "gemini-2.5-flash")
            .expect("parse response");
        let tool_calls = parsed.choices[0]
            .message
            .tool_calls
            .clone()
            .expect("tool calls");

        assert_eq!(tool_calls[0].function.name, "read-file");
        assert_eq!(tool_calls[0].function.arguments, r#"{"path":"README.md"}"#);
    }
}
