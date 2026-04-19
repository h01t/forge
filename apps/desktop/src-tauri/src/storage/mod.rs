use crate::llm::types::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::Row;
use std::path::{Path, PathBuf};
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_access_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Project access grant
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAccessGrant {
    pub id: String,
    pub path: String,
    pub display_name: String,
    pub permission_level: String,
    pub created_at: i64,
    pub updated_at: i64,
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

/// Tool execution result payload
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolExecutionResultPayload {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub execution_time: u64,
}

/// Tool execution audit log
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolExecutionLog {
    pub id: String,
    pub conversation_id: String,
    pub request_id: String,
    pub tool_call_id: String,
    pub agent_id: String,
    pub tool_id: String,
    pub tool_name: String,
    pub risk_level: String,
    pub parameters: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_access_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission_level: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<ToolExecutionResultPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub timestamp: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone)]
pub struct NewToolExecution<'a> {
    pub conversation_id: &'a str,
    pub request_id: &'a str,
    pub tool_call_id: &'a str,
    pub agent_id: &'a str,
    pub tool_id: &'a str,
    pub tool_name: &'a str,
    pub risk_level: &'a str,
    pub parameters: serde_json::Value,
    pub project_access_id: Option<&'a str>,
    pub project_display_name: Option<&'a str>,
    pub project_path: Option<&'a str>,
    pub permission_level: Option<&'a str>,
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

fn parse_conversation_row(row: sqlx::sqlite::SqliteRow) -> Result<Conversation, StorageError> {
    Ok(Conversation {
        id: row.get("id"),
        agent_id: row.get("agent_id"),
        title: row.get("title"),
        project_access_id: row.get("project_access_id"),
        created_at: DateTime::from_str(&row.get::<String, _>("created_at")).unwrap(),
        updated_at: DateTime::from_str(&row.get::<String, _>("updated_at")).unwrap(),
    })
}

fn parse_project_access_grant_row(
    row: sqlx::sqlite::SqliteRow,
) -> Result<ProjectAccessGrant, StorageError> {
    Ok(ProjectAccessGrant {
        id: row.get("id"),
        path: row.get("path"),
        display_name: row.get("display_name"),
        permission_level: row.get("permission_level"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn normalize_project_path(path: &str) -> Result<String, StorageError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(StorageError::InvalidData(
            "Project path cannot be empty".to_string(),
        ));
    }

    let canonical = Path::new(trimmed)
        .canonicalize()
        .map_err(|e| StorageError::InvalidData(format!("Failed to resolve project path: {}", e)))?;

    if !canonical.is_dir() {
        return Err(StorageError::InvalidData(
            "Project path must be a directory".to_string(),
        ));
    }

    Ok(canonical.to_string_lossy().to_string())
}

fn display_name_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| path.to_string())
}

fn parse_tool_execution_row(
    row: sqlx::sqlite::SqliteRow,
) -> Result<ToolExecutionLog, StorageError> {
    let result_json: Option<String> = row.get("result_json");
    let parameters_json: String = row.get("parameters_json");

    Ok(ToolExecutionLog {
        id: row.get("id"),
        conversation_id: row.get("conversation_id"),
        request_id: row.get("request_id"),
        tool_call_id: row.get("tool_call_id"),
        agent_id: row.get("agent_id"),
        tool_id: row.get("tool_id"),
        tool_name: row.get("tool_name"),
        risk_level: row.get("risk_level"),
        parameters: serde_json::from_str(&parameters_json)?,
        project_access_id: row.get("project_access_id"),
        project_display_name: row.get("project_display_name"),
        project_path: row.get("project_path"),
        permission_level: row.get("permission_level"),
        status: row.get("status"),
        result: result_json
            .as_deref()
            .map(serde_json::from_str::<ToolExecutionResultPayload>)
            .transpose()?,
        error: row.get("error"),
        timestamp: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
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
        MIGRATOR
            .run(&self.pool)
            .await
            .map_err(|e| StorageError::DatabaseError(e.into()))?;

        self.init_default_settings().await?;
        self.import_legacy_workspace_root().await?;

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
            let exists =
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM settings WHERE key = ?")
                    .bind(key)
                    .fetch_one(&self.pool)
                    .await?;

            if exists == 0 {
                self.set_setting(key, value).await?;
            }
        }

        Ok(())
    }

    async fn import_legacy_workspace_root(&self) -> Result<(), StorageError> {
        let Some(legacy_root) = self.get_setting("workspace_root").await? else {
            return Ok(());
        };
        let trimmed = legacy_root.trim();
        if trimmed.is_empty() {
            return Ok(());
        }

        let normalized_path = match normalize_project_path(trimmed) {
            Ok(path) => path,
            Err(_) => {
                self.set_setting("workspace_root", "").await?;
                return Ok(());
            }
        };

        let existing_id =
            sqlx::query_scalar::<_, String>("SELECT id FROM project_access_grants WHERE path = ?")
                .bind(&normalized_path)
                .fetch_optional(&self.pool)
                .await?;

        if existing_id.is_none() {
            let now = Utc::now().timestamp_millis();
            sqlx::query(
                "INSERT INTO project_access_grants
                 (id, path, display_name, permission_level, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&normalized_path)
            .bind(display_name_from_path(&normalized_path))
            .bind("read")
            .bind(now)
            .bind(now)
            .execute(&self.pool)
            .await?;
        }

        self.set_setting("workspace_root", "").await?;

        Ok(())
    }

    // === Conversations ===

    /// Create a new conversation
    pub async fn create_conversation(
        &self,
        agent_id: &str,
        title: &str,
        project_access_id: Option<&str>,
    ) -> Result<Conversation, StorageError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        if let Some(project_access_id) = project_access_id {
            self.get_project_access_grant(project_access_id).await?;
        }

        sqlx::query(
            "INSERT INTO conversations (id, agent_id, title, project_access_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(agent_id)
        .bind(title)
        .bind(project_access_id)
        .bind(&now.to_rfc3339())
        .bind(&now.to_rfc3339())
        .execute(&self.pool)
        .await?;

        Ok(Conversation {
            id,
            agent_id: agent_id.to_string(),
            title: title.to_string(),
            project_access_id: project_access_id.map(ToOwned::to_owned),
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

        parse_conversation_row(row)
    }

    /// Get all conversations
    pub async fn list_conversations(&self) -> Result<Vec<Conversation>, StorageError> {
        let rows = sqlx::query("SELECT * FROM conversations ORDER BY updated_at DESC")
            .fetch_all(&self.pool)
            .await?;

        rows.into_iter().map(parse_conversation_row).collect()
    }

    /// Update conversation title
    pub async fn update_conversation_title(
        &self,
        id: &str,
        title: &str,
    ) -> Result<(), StorageError> {
        let now = Utc::now();

        sqlx::query("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
            .bind(title)
            .bind(&now.to_rfc3339())
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn attach_project_access_to_conversation(
        &self,
        conversation_id: &str,
        project_access_id: Option<&str>,
    ) -> Result<Conversation, StorageError> {
        if let Some(project_access_id) = project_access_id {
            self.get_project_access_grant(project_access_id).await?;
        }

        let now = Utc::now();
        sqlx::query("UPDATE conversations SET project_access_id = ?, updated_at = ? WHERE id = ?")
            .bind(project_access_id)
            .bind(&now.to_rfc3339())
            .bind(conversation_id)
            .execute(&self.pool)
            .await?;

        self.get_conversation(conversation_id).await
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
        let rows =
            sqlx::query("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
                .bind(conversation_id)
                .fetch_all(&self.pool)
                .await?;

        rows.into_iter()
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

    // === Tool executions ===

    pub async fn create_tool_execution(
        &self,
        new_execution: NewToolExecution<'_>,
    ) -> Result<ToolExecutionLog, StorageError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().timestamp_millis();
        let parameters_json = serde_json::to_string(&new_execution.parameters)?;

        sqlx::query(
            "INSERT INTO tool_executions
             (id, conversation_id, request_id, tool_call_id, agent_id, tool_id, tool_name, risk_level, parameters_json, project_access_id, project_display_name, project_path, permission_level, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(new_execution.conversation_id)
        .bind(new_execution.request_id)
        .bind(new_execution.tool_call_id)
        .bind(new_execution.agent_id)
        .bind(new_execution.tool_id)
        .bind(new_execution.tool_name)
        .bind(new_execution.risk_level)
        .bind(parameters_json)
        .bind(new_execution.project_access_id)
        .bind(new_execution.project_display_name)
        .bind(new_execution.project_path)
        .bind(new_execution.permission_level)
        .bind("pending")
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await?;

        self.get_tool_execution(&id).await
    }

    pub async fn update_tool_execution_status(
        &self,
        id: &str,
        status: &str,
        result: Option<&ToolExecutionResultPayload>,
        error: Option<&str>,
    ) -> Result<(), StorageError> {
        let now = Utc::now().timestamp_millis();
        let result_json = result.map(serde_json::to_string).transpose()?;

        sqlx::query(
            "UPDATE tool_executions
             SET status = ?, result_json = ?, error = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(status)
        .bind(result_json)
        .bind(error)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_tool_execution(&self, id: &str) -> Result<ToolExecutionLog, StorageError> {
        let row = sqlx::query("SELECT * FROM tool_executions WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| StorageError::NotFound(id.to_string()))?;

        parse_tool_execution_row(row)
    }

    pub async fn list_tool_executions(
        &self,
        conversation_id: &str,
    ) -> Result<Vec<ToolExecutionLog>, StorageError> {
        let rows = sqlx::query(
            "SELECT * FROM tool_executions WHERE conversation_id = ? ORDER BY created_at ASC",
        )
        .bind(conversation_id)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(parse_tool_execution_row).collect()
    }

    // === Project access grants ===

    pub async fn save_project_access_grant(
        &self,
        path: &str,
        permission_level: &str,
    ) -> Result<ProjectAccessGrant, StorageError> {
        if permission_level != "read" {
            return Err(StorageError::InvalidData(format!(
                "Unsupported project permission level: {}",
                permission_level
            )));
        }

        let normalized_path = normalize_project_path(path)?;
        let now = Utc::now().timestamp_millis();
        let existing = sqlx::query("SELECT * FROM project_access_grants WHERE path = ?")
            .bind(&normalized_path)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = existing {
            let grant = parse_project_access_grant_row(row)?;
            sqlx::query(
                "UPDATE project_access_grants
                 SET display_name = ?, permission_level = ?, updated_at = ?
                 WHERE id = ?",
            )
            .bind(display_name_from_path(&normalized_path))
            .bind(permission_level)
            .bind(now)
            .bind(&grant.id)
            .execute(&self.pool)
            .await?;

            return self.get_project_access_grant(&grant.id).await;
        }

        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO project_access_grants
             (id, path, display_name, permission_level, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&normalized_path)
        .bind(display_name_from_path(&normalized_path))
        .bind(permission_level)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await?;

        self.get_project_access_grant(&id).await
    }

    pub async fn get_project_access_grant(
        &self,
        id: &str,
    ) -> Result<ProjectAccessGrant, StorageError> {
        let row = sqlx::query("SELECT * FROM project_access_grants WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| StorageError::NotFound(id.to_string()))?;

        parse_project_access_grant_row(row)
    }

    pub async fn list_project_access_grants(
        &self,
    ) -> Result<Vec<ProjectAccessGrant>, StorageError> {
        let rows = sqlx::query(
            "SELECT * FROM project_access_grants ORDER BY updated_at DESC, created_at DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter()
            .map(parse_project_access_grant_row)
            .collect()
    }

    pub async fn revoke_project_access_grant(&self, id: &str) -> Result<(), StorageError> {
        let now = Utc::now();

        sqlx::query(
            "UPDATE conversations SET project_access_id = NULL, updated_at = ? WHERE project_access_id = ?",
        )
        .bind(&now.to_rfc3339())
        .bind(id)
        .execute(&self.pool)
        .await?;

        sqlx::query("DELETE FROM project_access_grants WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
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
    pub async fn get_all_settings(
        &self,
    ) -> Result<std::collections::HashMap<String, String>, StorageError> {
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
        assert_eq!(
            normalize_message_role("\"assistant\"").unwrap(),
            "assistant"
        );
        assert_eq!(normalize_message_role(" tool ").unwrap(), "tool");
        assert!(normalize_message_role("invalid").is_err());
    }

    #[tokio::test]
    async fn add_message_persists_canonical_roles() {
        let db_path = test_db_path("canonical-role");
        let manager = StorageManager::new(db_path.clone()).await.unwrap();
        let conversation = manager
            .create_conversation("software-engineer", "Canonical role test", None)
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

        let stored_role =
            sqlx::query_scalar::<_, String>("SELECT role FROM messages WHERE conversation_id = ?")
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
            .create_conversation("software-engineer", "Legacy role test", None)
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

        sqlx::query(include_str!(
            "../../migrations/20250101000003_fix_message_roles.sql"
        ))
        .execute(&manager.pool)
        .await
        .unwrap();

        let migrated_role =
            sqlx::query_scalar::<_, String>("SELECT role FROM messages WHERE id = 'msg-1'")
                .fetch_one(&manager.pool)
                .await
                .unwrap();

        sqlx::query("UPDATE messages SET role = ? WHERE id = ?")
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

    #[tokio::test]
    async fn tool_execution_round_trip_persists_status_and_result() {
        let project_dir = std::env::temp_dir().join(format!(
            "pantheon-forge-tool-log-project-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&project_dir).unwrap();

        let db_path = test_db_path("tool-execution");
        let manager = StorageManager::new(db_path.clone()).await.unwrap();
        let grant = manager
            .save_project_access_grant(project_dir.to_string_lossy().as_ref(), "read")
            .await
            .unwrap();
        let conversation = manager
            .create_conversation("software-engineer", "Tool execution test", Some(&grant.id))
            .await
            .unwrap();

        let created = manager
            .create_tool_execution(NewToolExecution {
                conversation_id: &conversation.id,
                request_id: "request-1",
                tool_call_id: "call-1",
                agent_id: "software-engineer",
                tool_id: "read-file",
                tool_name: "Read File",
                risk_level: "low",
                parameters: serde_json::json!({ "path": "README.md" }),
                project_access_id: Some(&grant.id),
                project_display_name: Some(&grant.display_name),
                project_path: Some(&grant.path),
                permission_level: Some(&grant.permission_level),
            })
            .await
            .unwrap();

        manager
            .update_tool_execution_status(
                &created.id,
                "succeeded",
                Some(&ToolExecutionResultPayload {
                    success: true,
                    output: Some("done".into()),
                    error: None,
                    execution_time: 12,
                }),
                None,
            )
            .await
            .unwrap();

        let executions = manager
            .list_tool_executions(&conversation.id)
            .await
            .unwrap();
        assert_eq!(executions.len(), 1);
        assert_eq!(executions[0].status, "succeeded");
        assert_eq!(
            executions[0].project_access_id.as_deref(),
            Some(grant.id.as_str())
        );
        assert_eq!(
            executions[0].project_display_name.as_deref(),
            Some(grant.display_name.as_str())
        );
        assert_eq!(
            executions[0].project_path.as_deref(),
            Some(grant.path.as_str())
        );
        assert_eq!(executions[0].permission_level.as_deref(), Some("read"));
        assert_eq!(
            executions[0]
                .result
                .as_ref()
                .and_then(|result| result.output.clone()),
            Some("done".into())
        );

        drop(manager);
        std::fs::remove_file(db_path).ok();
        std::fs::remove_dir_all(project_dir).ok();
    }

    #[tokio::test]
    async fn save_list_and_revoke_project_access_grants() {
        let project_dir =
            std::env::temp_dir().join(format!("pantheon-forge-project-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&project_dir).unwrap();

        let db_path = test_db_path("project-grants");
        let manager = StorageManager::new(db_path.clone()).await.unwrap();

        let grant = manager
            .save_project_access_grant(project_dir.to_string_lossy().as_ref(), "read")
            .await
            .unwrap();
        let listed = manager.list_project_access_grants().await.unwrap();

        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, grant.id);
        assert_eq!(listed[0].permission_level, "read");

        manager
            .revoke_project_access_grant(&grant.id)
            .await
            .unwrap();

        let remaining = manager.list_project_access_grants().await.unwrap();
        assert!(remaining.is_empty());

        drop(manager);
        std::fs::remove_file(db_path).ok();
        std::fs::remove_dir_all(project_dir).ok();
    }

    #[tokio::test]
    async fn conversations_can_attach_and_detach_project_access() {
        let project_dir = std::env::temp_dir().join(format!(
            "pantheon-forge-attach-project-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&project_dir).unwrap();

        let db_path = test_db_path("attach-project");
        let manager = StorageManager::new(db_path.clone()).await.unwrap();
        let grant = manager
            .save_project_access_grant(project_dir.to_string_lossy().as_ref(), "read")
            .await
            .unwrap();
        let conversation = manager
            .create_conversation("software-engineer", "Project attach test", None)
            .await
            .unwrap();

        let attached = manager
            .attach_project_access_to_conversation(&conversation.id, Some(&grant.id))
            .await
            .unwrap();
        assert_eq!(
            attached.project_access_id.as_deref(),
            Some(grant.id.as_str())
        );

        let detached = manager
            .attach_project_access_to_conversation(&conversation.id, None)
            .await
            .unwrap();
        assert_eq!(detached.project_access_id, None);

        drop(manager);
        std::fs::remove_file(db_path).ok();
        std::fs::remove_dir_all(project_dir).ok();
    }

    #[tokio::test]
    async fn import_legacy_workspace_root_creates_project_grant_without_binding_conversations() {
        let project_dir = std::env::temp_dir().join(format!(
            "pantheon-forge-legacy-project-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&project_dir).unwrap();

        let db_path = test_db_path("legacy-workspace-root");
        let manager = StorageManager::new(db_path.clone()).await.unwrap();
        let conversation = manager
            .create_conversation("software-engineer", "Legacy import test", None)
            .await
            .unwrap();

        manager
            .set_setting("workspace_root", project_dir.to_string_lossy().as_ref())
            .await
            .unwrap();
        manager.import_legacy_workspace_root().await.unwrap();

        let grants = manager.list_project_access_grants().await.unwrap();
        let refreshed_conversation = manager.get_conversation(&conversation.id).await.unwrap();

        assert_eq!(grants.len(), 1);
        assert_eq!(grants[0].permission_level, "read");
        assert_eq!(refreshed_conversation.project_access_id, None);
        assert_eq!(
            manager.get_setting("workspace_root").await.unwrap(),
            Some(String::new())
        );

        drop(manager);
        std::fs::remove_file(db_path).ok();
        std::fs::remove_dir_all(project_dir).ok();
    }
}
