use crate::credentials::get_credential_manager;
use crate::llm::{
    ChatCompletionRequest, ChatCompletionResponse, LLMConfig, Message, ProviderFactory, ProviderId,
    StreamEvent,
};
use crate::AppState;
use futures_util::StreamExt;
use std::pin::Pin;
use tauri::{Emitter, State};

#[tauri::command]
pub async fn chat_completion(
    provider_id: String,
    messages: Vec<Message>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
    _state: State<'_, AppState>,
) -> Result<ChatCompletionResponse, String> {
    let provider_enum = ProviderId::from_str(&provider_id)
        .ok_or_else(|| format!("Invalid provider: {}", provider_id))?;

    let cred_manager = get_credential_manager();
    let credential = cred_manager
        .get_provider(provider_enum)
        .map_err(|e| format!("Failed to get credentials: {}", e))?;

    let config = LLMConfig {
        provider_id: provider_enum,
        api_key: credential.api_key,
        base_url: credential.base_url,
        model: model.or(credential.model),
    };

    let model = config
        .model
        .clone()
        .unwrap_or_else(|| ProviderFactory::default_model(provider_enum).to_string());

    let request = ChatCompletionRequest {
        messages,
        model,
        temperature,
        max_tokens,
        top_p: None,
        stream: Some(false),
        tools: None,
    };

    let provider = ProviderFactory::create_provider(&config).map_err(|e| e.to_string())?;

    provider
        .chat_completion(request)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Clone, serde::Serialize)]
pub struct StreamPayload {
    pub request_id: String,
    pub event_type: String,
    pub delta: Option<String>,
    pub finish_reason: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn stream_chat_completion(
    app_handle: tauri::AppHandle,
    request_id: String,
    provider_id: String,
    messages: Vec<Message>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    let provider_enum = ProviderId::from_str(&provider_id)
        .ok_or_else(|| format!("Invalid provider: {}", provider_id))?;

    let cred_manager = get_credential_manager();
    let credential = cred_manager
        .get_provider(provider_enum)
        .map_err(|e| format!("Failed to get credentials: {}", e))?;

    let config = LLMConfig {
        provider_id: provider_enum,
        api_key: credential.api_key,
        base_url: credential.base_url,
        model: model.or(credential.model),
    };

    let model = config
        .model
        .clone()
        .unwrap_or_else(|| ProviderFactory::default_model(provider_enum).to_string());

    let request = ChatCompletionRequest {
        messages,
        model,
        temperature,
        max_tokens,
        top_p: None,
        stream: Some(true),
        tools: None,
    };

    let provider = ProviderFactory::create_provider(&config).map_err(|e| e.to_string())?;

    let mut stream: Pin<Box<dyn futures_util::Stream<Item = StreamEvent> + Send>> =
        provider.stream_completion(request).await;

    let mut full_content = String::new();

    while let Some(event) = stream.next().await {
        match event {
            StreamEvent::Start { .. } => {
                let _ = app_handle.emit(
                    "stream-event",
                    StreamPayload {
                        request_id: request_id.clone(),
                        event_type: "start".into(),
                        delta: None,
                        finish_reason: None,
                        error: None,
                    },
                );
            }
            StreamEvent::Content { delta } => {
                full_content.push_str(&delta);
                let _ = app_handle.emit(
                    "stream-event",
                    StreamPayload {
                        request_id: request_id.clone(),
                        event_type: "content".into(),
                        delta: Some(delta),
                        finish_reason: None,
                        error: None,
                    },
                );
            }
            StreamEvent::Done { finish_reason, .. } => {
                let _ = app_handle.emit(
                    "stream-event",
                    StreamPayload {
                        request_id: request_id.clone(),
                        event_type: "done".into(),
                        delta: None,
                        finish_reason,
                        error: None,
                    },
                );
                break;
            }
            StreamEvent::Error { message } => {
                let _ = app_handle.emit(
                    "stream-event",
                    StreamPayload {
                        request_id: request_id.clone(),
                        event_type: "error".into(),
                        delta: None,
                        finish_reason: None,
                        error: Some(message.clone()),
                    },
                );
                return Err(format!("Stream error: {}", message));
            }
            _ => {}
        }
    }

    Ok(full_content)
}
