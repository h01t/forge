use crate::llm::types::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::Row;
use std::path::PathBuf;
use std::str::FromStr;

/// Storage error
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid data: {0}")]
    InvalidData(String),
}

/// Conversation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub agent_id: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Message record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

/// Settings record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub id: i64,
    pub key: String,
    pub value: String,
    pub updated_at: DateTime<Utc>,
}

/// Storage manager for SQLite database
pub struct StorageManager {
    pool: SqlitePool,
}

fn normalize_message_role(raw_role: &str) -> Result<String, StorageError> {
    MessageRole::from_persisted_str(raw_role)
        .map(|role| role.as_str().to_string())
        .ok_or_else(|| StorageError::InvalidData(format!("Invalid message role: {}", raw_role)))
}

impl StorageManager {
    /// Create a new storage manager with the database at the given path
    pub async fn new(db_path: PathBuf) -> Result<Self, StorageError> {
        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;

        let manager = Self { pool };
        manager.init().await?;
        Ok(manager)
    }

    /// Initialize database schema
    async fn init(&self) -> Result<(), StorageError> {
        static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
        MIGRATOR.run(&self.pool).await.map_err(|e| StorageError::DatabaseError(e.into()))?;

        self.init_default_settings().await?;

        Ok(())
    }

    async fn init_default_settings(&self) -> Result<(), StorageError> {
        let default_settings = vec![
            ("theme", "cyberpunk"),
            ("default_provider", "anthropic"),
            ("auto_approve_low_risk", "false"),
            ("require_approval_for_high_risk", "true"),
        ];

        for (key, value) in default_settings {
            let exists = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM settings WHERE key = ?",
            )
            .bind(key)
            .fetch_one(&self.pool)
            .await?;

            if exists == 0 {
                self.set_setting(key, value).await?;
            }
        }

        Ok(())
    }

    // === Conversations ===

    /// Create a new conversation
    pub async fn create_conversation(
        &self,
        agent_id: &str,
        title: &str,
    ) -> Result<Conversation, StorageError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        sqlx::query(
            "INSERT INTO conversations (id, agent_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(agent_id)
        .bind(title)
        .bind(&now.to_rfc3339())
        .bind(&now.to_rfc3339())
        .execute(&self.pool)
        .await?;

        Ok(Conversation {
            id,
            agent_id: agent_id.to_string(),
            title: title.to_string(),
            created_at: now,
            updated_at: now,
        })
    }

    /// Get a conversation by ID
    pub async fn get_conversation(&self, id: &str) -> Result<Conversation, StorageError> {
        let row = sqlx::query("SELECT * FROM conversations WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| StorageError::NotFound(id.to_string()))?;

        Ok(Conversation {
            id: row.get("id"),
            agent_id: row.get("agent_id"),
            title: row.get("title"),
            created_at: DateTime::from_str(&row.get::<String, _>("created_at")).unwrap(),
            updated_at: DateTime::from_str(&row.get::<String, _>("updated_at")).unwrap(),
        })
    }

    /// Get all conversations
    pub async fn list_conversations(&self) -> Result<Vec<Conversation>, StorageError> {
        let rows = sqlx::query("SELECT * FROM conversations ORDER BY updated_at DESC")
            .fetch_all(&self.pool)
            .await?;

        rows
            .into_iter()
            .map(|row| {
                Ok(Conversation {
                    id: row.get("id"),
                    agent_id: row.get("agent_id"),
                    title: row.get("title"),
                    created_at: DateTime::from_str(&row.get::<String, _>("created_at")).unwrap(),
                    updated_at: DateTime::from_str(&row.get::<String, _>("updated_at")).unwrap(),
                })
            })
            .collect()
    }

    /// Update conversation title
    pub async fn update_conversation_title(
        &self,
        id: &str,
        title: &str,
    ) -> Result<(), StorageError> {
        let now = Utc::now();

        sqlx::query(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
        )
        .bind(title)
        .bind(&now.to_rfc3339())
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Delete a conversation
    pub async fn delete_conversation(&self, id: &str) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM conversations WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // === Messages ===

    /// Add a message to a conversation
    pub async fn add_message(
        &self,
        conversation_id: &str,
        message: &Message,
    ) -> Result<String, StorageError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        let tool_calls_json = message
            .tool_calls
            .as_ref()
            .map(|tc| serde_json::to_string(tc).unwrap());

        sqlx::query(
            "INSERT INTO messages (id, conversation_id, role, content, created_at, tool_calls, tool_call_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(conversation_id)
        .bind(message.role.as_str())
        .bind(&message.content)
        .bind(&now.to_rfc3339())
        .bind(tool_calls_json)
        .bind(&message.tool_call_id)
        .execute(&self.pool)
        .await?;

        // Update conversation's updated_at
        sqlx::query("UPDATE conversations SET updated_at = ? WHERE id = ?")
            .bind(&now.to_rfc3339())
            .bind(conversation_id)
            .execute(&self.pool)
            .await?;

        Ok(id)
    }

    /// Get all messages for a conversation
    pub async fn get_messages(
        &self,
        conversation_id: &str,
    ) -> Result<Vec<StoredMessage>, StorageError> {
        let rows = sqlx::query(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        )
        .bind(conversation_id)
        .fetch_all(&self.pool)
        .await?;

        rows
            .into_iter()
            .map(|row| {
                Ok(StoredMessage {
                    id: row.get("id"),
                    conversation_id: row.get("conversation_id"),
                    role: normalize_message_role(&row.get::<String, _>("role"))?,
                    content: row.get("content"),
                    created_at: DateTime::from_str(&row.get::<String, _>("created_at")).unwrap(),
                    tool_calls: row.get("tool_calls"),
                    tool_call_id: row.get("tool_call_id"),
                })
            })
            .collect()
    }

    // === Settings ===

    /// Get a setting value
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, StorageError> {
        let value = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(value)
    }

    /// Set a setting value
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<(), StorageError> {
        let now = Utc::now();

        sqlx::query(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(key)
        .bind(value)
        .bind(&now.to_rfc3339())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get all settings
    pub async fn get_all_settings(&self) -> Result<std::collections::HashMap<String, String>, StorageError> {
        let rows = sqlx::query("SELECT key, value FROM settings")
            .fetch_all(&self.pool)
            .await?;

        Ok(rows
            .into_iter()
            .map(|row| (row.get("key"), row.get("value")))
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "pantheon-forge-storage-{}-{}.db",
            name,
            uuid::Uuid::new_v4()
        ))
    }

    #[test]
    fn normalize_message_role_accepts_canonical_and_legacy_values() {
        assert_eq!(normalize_message_role("user").unwrap(), "user");
        assert_eq!(normalize_message_role("\"assistant\"").unwrap(), "assistant");
        assert_eq!(normalize_message_role(" tool ").unwrap(), "tool");
        assert!(normalize_message_role("invalid").is_err());
    }

    #[tokio::test]
    async fn add_message_persists_canonical_roles() {
        let db_path = test_db_path("canonical-role");
        let manager = StorageManager::new(db_path.clone()).await.unwrap();
        let conversation = manager
            .create_conversation("software-engineer", "Canonical role test")
            .await
            .unwrap();

        manager
            .add_message(
                &conversation.id,
                &Message {
                    role: MessageRole::User,
                    content: "hello".into(),
                    tool_calls: None,
                    tool_call_id: None,
                },
            )
            .await
            .unwrap();

        let stored_role = sqlx::query_scalar::<_, String>(
            "SELECT role FROM messages WHERE conversation_id = ?",
        )
        .bind(&conversation.id)
        .fetch_one(&manager.pool)
        .await
        .unwrap();

        assert_eq!(stored_role, "user");

        drop(manager);
        std::fs::remove_file(db_path).ok();
    }

    #[tokio::test]
    async fn get_messages_normalizes_legacy_quoted_roles() {
        let db_path = test_db_path("legacy-role");
        let manager = StorageManager::new(db_path.clone()).await.unwrap();
        let conversation = manager
            .create_conversation("software-engineer", "Legacy role test")
            .await
            .unwrap();

        sqlx::query(
            "INSERT INTO messages (id, conversation_id, role, content, created_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind("msg-1")
        .bind(&conversation.id)
        .bind("\"assistant\"")
        .bind("legacy payload")
        .bind("2025-01-01T00:00:00Z")
        .execute(&manager.pool)
        .await
        .unwrap();

        sqlx::query(include_str!("../../migrations/20250101000003_fix_message_roles.sql"))
            .execute(&manager.pool)
            .await
            .unwrap();

        let migrated_role = sqlx::query_scalar::<_, String>(
            "SELECT role FROM messages WHERE id = 'msg-1'",
        )
        .fetch_one(&manager.pool)
        .await
        .unwrap();

        sqlx::query(
            "UPDATE messages SET role = ? WHERE id = ?",
        )
        .bind("\"assistant\"")
        .bind("msg-1")
        .execute(&manager.pool)
        .await
        .unwrap();

        let messages = manager.get_messages(&conversation.id).await.unwrap();

        assert_eq!(messages[0].role, "assistant");
        assert_eq!(migrated_role, "assistant");

        drop(manager);
        std::fs::remove_file(db_path).ok();
    }
}
