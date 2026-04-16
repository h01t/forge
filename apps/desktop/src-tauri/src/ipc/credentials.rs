use crate::credentials::{get_credential_manager, ProviderCredential};
use crate::llm::ProviderId;

#[tauri::command]
pub async fn store_provider_credentials(credential: ProviderCredential) -> Result<(), String> {
    let manager = get_credential_manager();
    manager
        .store_provider(credential)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_provider_credentials(
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
pub async fn list_stored_providers() -> Result<Vec<String>, String> {
    let manager = get_credential_manager();
    let providers = manager.list_providers().map_err(|e| e.to_string())?;
    Ok(providers.into_iter().map(|p| p.as_str().to_string()).collect())
}

#[tauri::command]
pub async fn remove_provider_credentials(provider_id: String) -> Result<(), String> {
    let provider_enum = ProviderId::from_str(&provider_id)
        .ok_or_else(|| format!("Invalid provider: {}", provider_id))?;

    let manager = get_credential_manager();
    manager
        .remove_provider(provider_enum)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_all_credentials() -> Result<(), String> {
    let manager = get_credential_manager();
    manager.clear_all().map_err(|e| e.to_string())
}
