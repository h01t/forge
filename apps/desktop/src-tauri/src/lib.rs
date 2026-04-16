#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod credentials;
mod crypto;
mod ipc;
mod llm;
mod storage;

use std::sync::Arc;
use storage::StorageManager;
use tauri::Manager;

pub struct AppState {
    pub storage: Arc<StorageManager>,
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

            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("pantheon-forge.db");
            log::info!("Database path: {:?}", db_path);

            let storage = Arc::new(
                tauri::async_runtime::block_on(StorageManager::new(db_path))
                    .expect("Failed to initialize storage"),
            );

            app.manage(AppState { storage });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::llm::chat_completion,
            ipc::llm::stream_chat_completion,
            ipc::credentials::store_provider_credentials,
            ipc::credentials::get_provider_credentials,
            ipc::credentials::list_stored_providers,
            ipc::credentials::remove_provider_credentials,
            ipc::credentials::clear_all_credentials,
            ipc::conversations::create_conversation,
            ipc::conversations::get_conversation,
            ipc::conversations::list_conversations,
            ipc::conversations::update_conversation_title,
            ipc::conversations::delete_conversation,
            ipc::conversations::add_message,
            ipc::conversations::get_messages,
            ipc::settings::get_setting,
            ipc::settings::set_setting,
            ipc::settings::get_all_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
