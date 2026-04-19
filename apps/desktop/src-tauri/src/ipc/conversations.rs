use crate::llm::Message;
use crate::storage;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn create_conversation(
    agent_id: String,
    title: String,
    project_access_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<storage::Conversation, String> {
    state
        .storage
        .create_conversation(&agent_id, &title, project_access_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_conversation(
    id: String,
    state: State<'_, AppState>,
) -> Result<storage::Conversation, String> {
    state
        .storage
        .get_conversation(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_conversations(
    state: State<'_, AppState>,
) -> Result<Vec<storage::Conversation>, String> {
    state
        .storage
        .list_conversations()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_conversation_title(
    id: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .storage
        .update_conversation_title(&id, &title)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_conversation(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state
        .storage
        .delete_conversation(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_message(
    conversation_id: String,
    message: Message,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .storage
        .add_message(&conversation_id, &message)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_messages(
    conversation_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<storage::StoredMessage>, String> {
    state
        .storage
        .get_messages(&conversation_id)
        .await
        .map_err(|e| e.to_string())
}
