CREATE TABLE IF NOT EXISTS project_access_grants (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    permission_level TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_access_grants_updated
    ON project_access_grants(updated_at DESC);

ALTER TABLE conversations ADD COLUMN project_access_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_project_access
    ON conversations(project_access_id);

ALTER TABLE tool_executions ADD COLUMN project_access_id TEXT;
ALTER TABLE tool_executions ADD COLUMN project_display_name TEXT;
ALTER TABLE tool_executions ADD COLUMN project_path TEXT;
ALTER TABLE tool_executions ADD COLUMN permission_level TEXT;
