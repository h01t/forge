use crate::llm::types::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::{Row, Sqlite};
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
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                tool_calls TEXT,
                tool_call_id TEXT,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Initialize default settings
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
        .bind(serde_json::to_string(&message.role)?)
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
                    role: row.get("role"),
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
