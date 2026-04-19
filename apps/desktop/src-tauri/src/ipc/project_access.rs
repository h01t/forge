use crate::storage;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_project_access_grants(
    state: State<'_, AppState>,
) -> Result<Vec<storage::ProjectAccessGrant>, String> {
    state
        .storage
        .list_project_access_grants()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_project_access_grant(
    path: String,
    permission_level: String,
    state: State<'_, AppState>,
) -> Result<storage::ProjectAccessGrant, String> {
    state
        .storage
        .save_project_access_grant(&path, &permission_level)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn revoke_project_access_grant(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .storage
        .revoke_project_access_grant(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn attach_project_access_to_conversation(
    conversation_id: String,
    project_access_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<storage::Conversation, String> {
    state
        .storage
        .attach_project_access_to_conversation(&conversation_id, project_access_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}
