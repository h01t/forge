// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod credentials;
mod crypto;
mod llm;
mod storage;

use credentials::{get_credential_manager, ProviderCredential};
use futures_util::StreamExt;
use llm::{
    ChatCompletionRequest, ChatCompletionResponse, LLMConfig, Message, ProviderId, StreamEvent,
};
use std::pin::Pin;
use storage::StorageManager;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

// Tauri state for shared storage manager
struct AppState {
    storage: Arc<StorageManager>,
}

/// Get the database path
fn get_db_path() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push(".pantheon-forge");
    std::fs::create_dir_all(&path).ok();
    path.push("pantheon-forge.db");
    path
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize storage manager
            let db_path = get_db_path();
            log::info!("Database path: {:?}", db_path);
            let storage = Arc::new(
                tokio::runtime::Runtime::new()
                    .unwrap()
                    .block_on(StorageManager::new(db_path))
                    .expect("Failed to initialize storage"),
            );

            app.manage(AppState { storage });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // LLM commands
            chat_completion,
            stream_chat_completion,
            // Credential commands
            store_provider_credentials,
            get_provider_credentials,
            list_stored_providers,
            remove_provider_credentials,
            clear_all_credentials,
            // Storage commands
            create_conversation,
            get_conversation,
            list_conversations,
            update_conversation_title,
            delete_conversation,
            add_message,
            get_messages,
            get_setting,
            set_setting,
            get_all_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// === LLM Commands ===

/// Perform a non-streaming chat completion
#[tauri::command]
async fn chat_completion(
    provider_id: String,
    messages: Vec<Message>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
    _state: tauri::State<'_, AppState>,
) -> Result<ChatCompletionResponse, String> {
    use llm::ProviderFactory;

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

    let model = config.model.clone().unwrap_or_else(|| {
        ProviderFactory::default_model(provider_enum).to_string()
    });

    let request = ChatCompletionRequest {
        messages,
        model,
        temperature,
        max_tokens,
        top_p: None,
        stream: Some(false),
        tools: None,
    };

    let provider = ProviderFactory::create_provider(&config)
        .map_err(|e| e.to_string())?;

    provider
        .chat_completion(request)
        .await
        .map_err(|e| e.to_string())
}

/// Stream a chat completion
#[tauri::command]
async fn stream_chat_completion(
    provider_id: String,
    messages: Vec<Message>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    use futures_util::StreamExt;
    use llm::ProviderFactory;

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

    let model = config.model.clone().unwrap_or_else(|| {
        ProviderFactory::default_model(provider_enum).to_string()
    });

    let request = ChatCompletionRequest {
        messages,
        model,
        temperature,
        max_tokens,
        top_p: None,
        stream: Some(true),
        tools: None,
    };

    let provider = ProviderFactory::create_provider(&config)
        .map_err(|e| e.to_string())?;

    let mut stream: Pin<Box<dyn futures_util::Stream<Item = StreamEvent> + Send>> =
        provider.stream_completion(request).await;

    // Collect all content chunks
    let mut full_content = String::new();

    while let Some(event) = stream.next().await {
        match event {
            StreamEvent::Content { delta } => {
                full_content.push_str(&delta);
            }
            StreamEvent::Done { .. } => break,
            StreamEvent::Error { message } => {
                return Err(format!("Stream error: {}", message));
            }
            _ => {}
        }
    }

    Ok(full_content)
}

// === Credential Commands ===

#[tauri::command]
async fn store_provider_credentials(credential: ProviderCredential) -> Result<(), String> {
    let manager = get_credential_manager();
    manager
        .store_provider(credential)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_provider_credentials(
    provider_id: String,
) -> Result<ProviderCredential, String> {
    let provider_enum = ProviderId::from_str(&provider_id)
        .ok_or_else(|| format!("Invalid provider: {}", provider_id))?;

    let manager = get_credential_manager();
    manager
        .get_provider(provider_enum)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_stored_providers() -> Result<Vec<String>, String> {
    let manager = get_credential_manager();
    let providers = manager.list_providers().map_err(|e| e.to_string())?;
    Ok(providers.into_iter().map(|p| p.as_str().to_string()).collect())
}

#[tauri::command]
async fn remove_provider_credentials(provider_id: String) -> Result<(), String> {
    let provider_enum = ProviderId::from_str(&provider_id)
        .ok_or_else(|| format!("Invalid provider: {}", provider_id))?;

    let manager = get_credential_manager();
    manager
        .remove_provider(provider_enum)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_all_credentials() -> Result<(), String> {
    let manager = get_credential_manager();
    manager.clear_all().map_err(|e| e.to_string())
}

// === Storage Commands ===

#[tauri::command]
async fn create_conversation(
    agent_id: String,
    title: String,
    state: tauri::State<'_, AppState>,
) -> Result<storage::Conversation, String> {
    state
        .storage
        .create_conversation(&agent_id, &title)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_conversation(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<storage::Conversation, String> {
    state
        .storage
        .get_conversation(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_conversations(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<storage::Conversation>, String> {
    state
        .storage
        .list_conversations()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_conversation_title(
    id: String,
    title: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state
        .storage
        .update_conversation_title(&id, &title)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_conversation(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state
        .storage
        .delete_conversation(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_message(
    conversation_id: String,
    message: Message,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    state
        .storage
        .add_message(&conversation_id, &message)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_messages(
    conversation_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<storage::StoredMessage>, String> {
    state
        .storage
        .get_messages(&conversation_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_setting(
    key: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    state
        .storage
        .get_setting(&key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_setting(
    key: String,
    value: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state
        .storage
        .set_setting(&key, &value)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_settings(
    state: tauri::State<'_, AppState>,
) -> Result<std::collections::HashMap<String, String>, String> {
    state
        .storage
        .get_all_settings()
        .await
        .map_err(|e| e.to_string())
}
