use crate::llm::{FunctionDefinition, ToolDefinition};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::cmp;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;

const READ_FILE_MAX_BYTES: usize = 64 * 1024;
const READ_FILE_MAX_LINES: usize = 300;
const SEARCH_MAX_MATCHES: usize = 100;
const SEARCH_MAX_FILES: usize = 40;
const WRITE_FILE_MAX_BYTES: usize = 128 * 1024;
const COMMAND_TIMEOUT_SECS: u64 = 20;
const COMMAND_OUTPUT_LIMIT_BYTES: usize = 24 * 1024;
const DIFF_PREVIEW_MAX_LINES: usize = 24;
const PREVIEW_MAX_BODY_BYTES: usize = 12 * 1024;
const EXCLUDED_DIRS: &[&str] = &[".git", "node_modules", ".next", "target", "dist", "out"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl RiskLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::Critical => "critical",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentToolSpec {
    pub id: String,
    pub name: String,
    pub description: String,
    pub risk_level: RiskLevel,
}

#[derive(Debug, Clone)]
pub struct ToolContext {
    pub project_access_id: String,
    pub project_root: PathBuf,
    pub project_display_name: String,
    pub permission_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolApprovalPreview {
    pub kind: String,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ToolExecutionOutput {
    pub output: String,
    pub summary: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct ExecutableTool {
    pub tool_id: String,
    pub tool_name: String,
    pub risk_level: RiskLevel,
    pub definition: ToolDefinition,
}

#[async_trait]
pub trait ToolExecutor: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    fn risk_level(&self) -> RiskLevel;
    fn description(&self) -> &'static str;
    fn required_permission_level(&self) -> &'static str;
    fn definition(&self) -> ToolDefinition;

    async fn preview(
        &self,
        _parameters: Value,
        _ctx: &ToolContext,
    ) -> Result<Option<ToolApprovalPreview>, String> {
        Ok(None)
    }

    async fn execute(
        &self,
        parameters: Value,
        ctx: &ToolContext,
    ) -> Result<ToolExecutionOutput, String>;
}

pub fn resolve_executable_tools(
    agent_tools: &[AgentToolSpec],
    project_context: Option<&ToolContext>,
) -> Vec<ExecutableTool> {
    let Some(project_context) = project_context else {
        return Vec::new();
    };

    agent_tools
        .iter()
        .filter_map(|tool| {
            let executor = get_tool(tool.id.as_str())?;
            if executor.required_permission_level() != project_context.permission_level {
                return None;
            }

            Some(executor)
        })
        .map(|tool| ExecutableTool {
            tool_id: tool.id().to_string(),
            tool_name: tool.name().to_string(),
            risk_level: tool.risk_level(),
            definition: tool.definition(),
        })
        .collect()
}

pub async fn preview_tool(
    tool_id: &str,
    parameters: Value,
    ctx: &ToolContext,
) -> Result<Option<ToolApprovalPreview>, String> {
    let tool = get_tool(tool_id).ok_or_else(|| format!("Unsupported tool: {}", tool_id))?;
    tool.preview(parameters, ctx).await
}

pub async fn execute_tool(
    tool_id: &str,
    parameters: Value,
    ctx: &ToolContext,
) -> Result<ToolExecutionOutput, String> {
    let tool = get_tool(tool_id).ok_or_else(|| format!("Unsupported tool: {}", tool_id))?;
    tool.execute(parameters, ctx).await
}

fn get_tool(tool_id: &str) -> Option<Box<dyn ToolExecutor>> {
    match tool_id {
        "read-file" => Some(Box::new(ReadFileTool)),
        "search-files" => Some(Box::new(SearchFilesTool)),
        "write-file" => Some(Box::new(WriteFileTool)),
        "execute-command" => Some(Box::new(ExecuteCommandTool)),
        _ => None,
    }
}

fn canonical_project_root(project_root: &Path) -> Result<PathBuf, String> {
    project_root
        .canonicalize()
        .map_err(|e| format!("Failed to resolve granted project path: {}", e))
}

fn display_project_relative(project_root: &Path, path: &Path) -> String {
    path.strip_prefix(project_root)
        .unwrap_or(path)
        .display()
        .to_string()
}

fn resolve_existing_project_path(project_root: &Path, path: &str) -> Result<PathBuf, String> {
    let project_root = canonical_project_root(project_root)?;
    let candidate = if Path::new(path).is_absolute() {
        PathBuf::from(path)
    } else {
        project_root.join(path)
    };
    let resolved = candidate
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    if !resolved.starts_with(&project_root) {
        return Err("Path escapes the granted project directory".to_string());
    }

    Ok(resolved)
}

fn resolve_project_target_path(project_root: &Path, path: &str) -> Result<PathBuf, String> {
    let project_root = canonical_project_root(project_root)?;
    let candidate = if Path::new(path).is_absolute() {
        PathBuf::from(path)
    } else {
        project_root.join(path)
    };

    if candidate.exists() {
        return resolve_existing_project_path(&project_root, candidate.to_string_lossy().as_ref());
    }

    let parent = candidate
        .parent()
        .ok_or_else(|| "Path must include a valid parent directory".to_string())?;
    let resolved_parent = parent
        .canonicalize()
        .map_err(|e| format!("Failed to resolve parent directory: {}", e))?;

    if !resolved_parent.starts_with(&project_root) {
        return Err("Path escapes the granted project directory".to_string());
    }

    if !resolved_parent.is_dir() {
        return Err("Parent path must be a directory".to_string());
    }

    Ok(candidate)
}

fn wildcard_matches(pattern: &str, text: &str) -> bool {
    fn inner(pattern: &[u8], text: &[u8]) -> bool {
        match (pattern.first(), text.first()) {
            (None, None) => true,
            (None, Some(_)) => false,
            (Some(b'*'), _) => {
                inner(&pattern[1..], text) || (!text.is_empty() && inner(pattern, &text[1..]))
            }
            (Some(b'?'), Some(_)) => inner(&pattern[1..], &text[1..]),
            (Some(ch), Some(txt)) if ch.eq_ignore_ascii_case(txt) => inner(&pattern[1..], &text[1..]),
            _ => false,
        }
    }

    inner(pattern.as_bytes(), text.as_bytes())
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn line_count(content: &str) -> usize {
    if content.is_empty() {
        0
    } else {
        content.lines().count()
    }
}

fn changed_line_count(old_content: &str, new_content: &str) -> usize {
    let old_lines: Vec<&str> = old_content.lines().collect();
    let new_lines: Vec<&str> = new_content.lines().collect();
    let shared = cmp::min(old_lines.len(), new_lines.len());
    let mut changed = 0usize;

    for index in 0..shared {
        if old_lines[index] != new_lines[index] {
            changed += 1;
        }
    }

    changed + old_lines.len().saturating_sub(shared) + new_lines.len().saturating_sub(shared)
}

fn truncate_preview_body(body: String) -> String {
    if body.len() <= PREVIEW_MAX_BODY_BYTES {
        return body;
    }

    format!(
        "{}\n… preview truncated …",
        &body[..PREVIEW_MAX_BODY_BYTES]
    )
}

fn build_diff_preview(display_path: &str, old_content: &str, new_content: &str) -> String {
    let old_lines: Vec<&str> = old_content.lines().collect();
    let new_lines: Vec<&str> = new_content.lines().collect();
    let mut preview = vec![
        format!("--- {}", display_path),
        format!("+++ {}", display_path),
    ];
    let mut diff_lines = 0usize;
    let mut truncated = false;

    for index in 0..cmp::max(old_lines.len(), new_lines.len()) {
        if diff_lines >= DIFF_PREVIEW_MAX_LINES {
            truncated = true;
            break;
        }

        match (old_lines.get(index), new_lines.get(index)) {
            (Some(old_line), Some(new_line)) if old_line == new_line => continue,
            (Some(old_line), Some(new_line)) => {
                preview.push(format!("- {}", old_line));
                preview.push(format!("+ {}", new_line));
                diff_lines += 2;
            }
            (Some(old_line), None) => {
                preview.push(format!("- {}", old_line));
                diff_lines += 1;
            }
            (None, Some(new_line)) => {
                preview.push(format!("+ {}", new_line));
                diff_lines += 1;
            }
            (None, None) => {}
        }
    }

    if diff_lines == 0 {
        preview.push("No line-level changes detected.".to_string());
    } else if truncated {
        preview.push("… diff preview truncated …".to_string());
    }

    truncate_preview_body(preview.join("\n"))
}

struct ReadFileTool;

#[async_trait]
impl ToolExecutor for ReadFileTool {
    fn id(&self) -> &'static str {
        "read-file"
    }

    fn name(&self) -> &'static str {
        "Read File"
    }

    fn risk_level(&self) -> RiskLevel {
        RiskLevel::Low
    }

    fn description(&self) -> &'static str {
        "Read a text file inside the granted project directory."
    }

    fn required_permission_level(&self) -> &'static str {
        "read"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: self.id().to_string(),
                description: self.description().to_string(),
                parameters: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative path inside the granted project directory." },
                        "startLine": { "type": "integer", "minimum": 1 },
                        "endLine": { "type": "integer", "minimum": 1 }
                    },
                    "required": ["path"]
                })),
            },
        }
    }

    async fn execute(
        &self,
        parameters: Value,
        ctx: &ToolContext,
    ) -> Result<ToolExecutionOutput, String> {
        let path = parameters
            .get("path")
            .and_then(Value::as_str)
            .ok_or_else(|| "Missing required parameter: path".to_string())?;
        let start_line = parameters
            .get("startLine")
            .and_then(Value::as_u64)
            .unwrap_or(1) as usize;
        let end_line = parameters
            .get("endLine")
            .and_then(Value::as_u64)
            .map(|value| value as usize);

        if start_line == 0 {
            return Err("startLine must be greater than 0".to_string());
        }
        if let Some(end_line) = end_line {
            if end_line < start_line {
                return Err("endLine must be greater than or equal to startLine".to_string());
            }
        }

        let resolved_path = resolve_existing_project_path(&ctx.project_root, path)?;
        if !resolved_path.is_file() {
            return Err("Path is not a file".to_string());
        }

        let bytes = fs::read(&resolved_path).map_err(|e| format!("Failed to read file: {}", e))?;
        if bytes.len() > READ_FILE_MAX_BYTES {
            return Err(format!(
                "File exceeds the {} KB read limit",
                READ_FILE_MAX_BYTES / 1024
            ));
        }

        let content = std::str::from_utf8(&bytes)
            .map_err(|_| "Binary or non-UTF-8 files are not supported".to_string())?;
        let content_hash = sha256_hex(&bytes);
        let lines: Vec<&str> = content.lines().collect();
        let total_lines = lines.len();
        let end_line = end_line
            .unwrap_or(total_lines.max(start_line))
            .min(total_lines)
            .min(start_line.saturating_add(READ_FILE_MAX_LINES - 1));
        let start_index = start_line.saturating_sub(1).min(total_lines);

        let selected = lines
            .iter()
            .enumerate()
            .skip(start_index)
            .take(end_line.saturating_sub(start_line).saturating_add(1))
            .map(|(index, line)| format!("{:>4} | {}", index + 1, line))
            .collect::<Vec<_>>()
            .join("\n");

        let project_root = canonical_project_root(&ctx.project_root)?;
        let display_path = display_project_relative(&project_root, &resolved_path);

        Ok(ToolExecutionOutput {
            output: format!(
                "FILE: {}\nSHA256: {}\nBYTES: {}\nLINES: {}-{} of {}\n\n{}",
                display_path,
                content_hash,
                bytes.len(),
                start_line.min(total_lines.max(1)),
                end_line.max(start_line.min(total_lines.max(1))),
                total_lines,
                selected
            ),
            summary: Some(format!("Read {}", display_path)),
            metadata: Some(json!({
                "path": display_path,
                "sha256": content_hash,
                "bytes": bytes.len(),
                "totalLines": total_lines,
            })),
        })
    }
}

struct SearchFilesTool;

#[async_trait]
impl ToolExecutor for SearchFilesTool {
    fn id(&self) -> &'static str {
        "search-files"
    }

    fn name(&self) -> &'static str {
        "Search Files"
    }

    fn risk_level(&self) -> RiskLevel {
        RiskLevel::Low
    }

    fn description(&self) -> &'static str {
        "Search text files inside the granted project directory."
    }

    fn required_permission_level(&self) -> &'static str {
        "read"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: self.id().to_string(),
                description: self.description().to_string(),
                parameters: Some(json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Plain-text query to search for." },
                        "fileGlob": { "type": "string", "description": "Optional wildcard pattern like src/*.ts or **/*.md." },
                        "caseSensitive": { "type": "boolean" }
                    },
                    "required": ["query"]
                })),
            },
        }
    }

    async fn execute(
        &self,
        parameters: Value,
        ctx: &ToolContext,
    ) -> Result<ToolExecutionOutput, String> {
        let query = parameters
            .get("query")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|query| !query.is_empty())
            .ok_or_else(|| "Missing required parameter: query".to_string())?;
        let file_glob = parameters.get("fileGlob").and_then(Value::as_str);
        let case_sensitive = parameters
            .get("caseSensitive")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        let mut matches = Vec::new();
        let mut files_with_matches = 0usize;
        let project_root = canonical_project_root(&ctx.project_root)?;
        search_directory(
            &project_root,
            &project_root,
            query,
            file_glob,
            case_sensitive,
            &mut matches,
            &mut files_with_matches,
        )?;

        if matches.is_empty() {
            return Ok(ToolExecutionOutput {
                output: format!("No matches found for `{}`.", query),
                summary: Some(format!("No matches for {}", query)),
                metadata: Some(json!({
                    "query": query,
                    "matches": 0,
                    "files": 0,
                })),
            });
        }

        let preview = matches.join("\n");
        Ok(ToolExecutionOutput {
            output: format!(
                "Found {} matches across {} files for `{}`:\n\n{}",
                matches.len(),
                files_with_matches,
                query,
                preview
            ),
            summary: Some(format!(
                "{} matches across {} files",
                matches.len(),
                files_with_matches
            )),
            metadata: Some(json!({
                "query": query,
                "matches": matches.len(),
                "files": files_with_matches,
            })),
        })
    }
}

#[derive(Debug, Clone)]
struct PreparedWrite {
    target_path: PathBuf,
    display_path: String,
    existed: bool,
    old_content: String,
    old_bytes: usize,
    old_hash: Option<String>,
    new_content: String,
    new_bytes: usize,
    new_hash: String,
    line_count: usize,
    changed_lines: usize,
}

struct WriteFileTool;

impl WriteFileTool {
    fn prepare(&self, parameters: &Value, ctx: &ToolContext) -> Result<PreparedWrite, String> {
        let path = parameters
            .get("path")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "Missing required parameter: path".to_string())?;
        let content = parameters
            .get("content")
            .and_then(Value::as_str)
            .ok_or_else(|| "Missing required parameter: content".to_string())?;
        let create_if_missing = parameters
            .get("createIfMissing")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let expected_hash = parameters
            .get("expectedHash")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());

        let target_path = resolve_project_target_path(&ctx.project_root, path)?;
        let project_root = canonical_project_root(&ctx.project_root)?;
        let display_path = display_project_relative(&project_root, &target_path);
        let new_bytes = content.as_bytes().len();
        if new_bytes > WRITE_FILE_MAX_BYTES {
            return Err(format!(
                "Write exceeds the {} KB limit",
                WRITE_FILE_MAX_BYTES / 1024
            ));
        }

        let existed = target_path.exists();
        if existed && !target_path.is_file() {
            return Err("Path is not a file".to_string());
        }
        if !existed && !create_if_missing {
            return Err("File does not exist and createIfMissing is false".to_string());
        }

        let (old_content, old_bytes, old_hash) = if existed {
            let bytes =
                fs::read(&target_path).map_err(|e| format!("Failed to read existing file: {}", e))?;
            if bytes.len() > WRITE_FILE_MAX_BYTES {
                return Err(format!(
                    "Existing file exceeds the {} KB overwrite limit",
                    WRITE_FILE_MAX_BYTES / 1024
                ));
            }
            let old_content = std::str::from_utf8(&bytes)
                .map_err(|_| "Binary or non-UTF-8 files are not supported".to_string())?
                .to_string();
            let old_hash = sha256_hex(&bytes);

            if let Some(expected_hash) = expected_hash {
                if expected_hash != old_hash {
                    return Err(format!(
                        "File changed since it was read. Expected hash {}, current hash {}.",
                        expected_hash, old_hash
                    ));
                }
            }

            (old_content, bytes.len(), Some(old_hash))
        } else {
            if let Some(expected_hash) = expected_hash {
                return Err(format!(
                    "File does not exist, so expectedHash {} cannot be verified.",
                    expected_hash
                ));
            }

            (String::new(), 0, None)
        };

        let new_hash = sha256_hex(content.as_bytes());
        let line_count = line_count(content);
        let changed_lines = changed_line_count(&old_content, content);

        Ok(PreparedWrite {
            target_path,
            display_path,
            existed,
            old_content,
            old_bytes,
            old_hash,
            new_content: content.to_string(),
            new_bytes,
            new_hash,
            line_count,
            changed_lines,
        })
    }
}

#[async_trait]
impl ToolExecutor for WriteFileTool {
    fn id(&self) -> &'static str {
        "write-file"
    }

    fn name(&self) -> &'static str {
        "Write File"
    }

    fn risk_level(&self) -> RiskLevel {
        RiskLevel::Medium
    }

    fn description(&self) -> &'static str {
        "Create or overwrite a UTF-8 text file inside the granted project directory."
    }

    fn required_permission_level(&self) -> &'static str {
        "read"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: self.id().to_string(),
                description: self.description().to_string(),
                parameters: Some(json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative path inside the granted project directory." },
                        "content": { "type": "string", "description": "The full UTF-8 file contents to write." },
                        "createIfMissing": { "type": "boolean", "description": "Whether to create the file if it does not already exist." },
                        "expectedHash": { "type": "string", "description": "Optional SHA-256 hash returned by read-file to guard against overwriting a stale version." }
                    },
                    "required": ["path", "content"]
                })),
            },
        }
    }

    async fn preview(
        &self,
        parameters: Value,
        ctx: &ToolContext,
    ) -> Result<Option<ToolApprovalPreview>, String> {
        let prepared = self.prepare(&parameters, ctx)?;
        let action = if prepared.existed { "Overwrite" } else { "Create" };
        let delta = prepared.new_bytes as i64 - prepared.old_bytes as i64;
        let summary = format!(
            "{} `{}` · {} -> {} bytes · {} changed lines",
            action,
            prepared.display_path,
            prepared.old_bytes,
            prepared.new_bytes,
            prepared.changed_lines
        );
        let body = build_diff_preview(
            &prepared.display_path,
            &prepared.old_content,
            &prepared.new_content,
        );

        Ok(Some(ToolApprovalPreview {
            kind: "diff".to_string(),
            summary: format!("{} (Δ {} bytes)", summary, delta),
            body: Some(body),
        }))
    }

    async fn execute(
        &self,
        parameters: Value,
        ctx: &ToolContext,
    ) -> Result<ToolExecutionOutput, String> {
        let prepared = self.prepare(&parameters, ctx)?;

        fs::write(&prepared.target_path, prepared.new_content.as_bytes())
            .map_err(|e| format!("Failed to write file: {}", e))?;

        let action = if prepared.existed { "updated" } else { "created" };
        let output = format!(
            "WRITE FILE RESULT\nPATH: {}\nSTATUS: {}\nBYTES_WRITTEN: {}\nLINES: {}\nCHANGED_LINES: {}\nSHA256: {}",
            prepared.display_path,
            action,
            prepared.new_bytes,
            prepared.line_count,
            prepared.changed_lines,
            prepared.new_hash
        );

        Ok(ToolExecutionOutput {
            output,
            summary: Some(format!(
                "{} {} ({} lines, {} bytes)",
                if prepared.existed { "Updated" } else { "Created" },
                prepared.display_path,
                prepared.line_count,
                prepared.new_bytes
            )),
            metadata: Some(json!({
                "path": prepared.display_path,
                "status": action,
                "bytesWritten": prepared.new_bytes,
                "lineCount": prepared.line_count,
                "changedLines": prepared.changed_lines,
                "sha256": prepared.new_hash,
                "previousSha256": prepared.old_hash,
            })),
        })
    }
}

#[derive(Debug, Clone)]
struct ValidatedCommand {
    command: String,
    args: Vec<String>,
    cwd: PathBuf,
    display_cwd: String,
}

#[derive(Debug, Clone)]
struct CommandExecution {
    stdout: String,
    stderr: String,
    stdout_truncated: bool,
    stderr_truncated: bool,
    timed_out: bool,
    exit_code: Option<i32>,
}

struct ExecuteCommandTool;

impl ExecuteCommandTool {
    fn validate_command(
        &self,
        parameters: &Value,
        ctx: &ToolContext,
    ) -> Result<ValidatedCommand, String> {
        let command = parameters
            .get("command")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "Missing required parameter: command".to_string())?
            .to_string();
        let args = parameters
            .get("args")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|item| {
                        item.as_str()
                            .map(ToOwned::to_owned)
                            .ok_or_else(|| "Command args must be strings".to_string())
                    })
                    .collect::<Result<Vec<_>, _>>()
            })
            .transpose()?
            .unwrap_or_default();
        let cwd = parameters.get("cwd").and_then(Value::as_str);
        let cwd_path = if let Some(cwd) = cwd {
            let resolved = resolve_existing_project_path(&ctx.project_root, cwd)?;
            if !resolved.is_dir() {
                return Err("cwd must resolve to a directory inside the granted project".to_string());
            }
            resolved
        } else {
            canonical_project_root(&ctx.project_root)?
        };

        match command.as_str() {
            "git" => {
                let subcommand = args
                    .first()
                    .map(String::as_str)
                    .ok_or_else(|| "git requires an allowed subcommand".to_string())?;
                if !matches!(subcommand, "status" | "diff" | "show" | "log") {
                    return Err(format!("git subcommand `{}` is not allowed", subcommand));
                }
            }
            "pnpm" => {
                let subcommand = args
                    .first()
                    .map(String::as_str)
                    .ok_or_else(|| "pnpm requires an allowed subcommand".to_string())?;
                if !matches!(subcommand, "test" | "lint" | "build" | "typecheck") {
                    return Err(format!("pnpm subcommand `{}` is not allowed", subcommand));
                }
            }
            "cargo" => {
                let subcommand = args
                    .first()
                    .map(String::as_str)
                    .ok_or_else(|| "cargo requires an allowed subcommand".to_string())?;
                if !matches!(subcommand, "check" | "test" | "build") {
                    return Err(format!("cargo subcommand `{}` is not allowed", subcommand));
                }
            }
            "rg" => {}
            _ => {
                return Err(format!(
                    "Command `{}` is not allowlisted. Supported commands: git, rg, pnpm, cargo.",
                    command
                ));
            }
        }

        let project_root = canonical_project_root(&ctx.project_root)?;
        let display_cwd = display_project_relative(&project_root, &cwd_path);

        Ok(ValidatedCommand {
            command,
            args,
            cwd: cwd_path,
            display_cwd,
        })
    }
}

#[async_trait]
impl ToolExecutor for ExecuteCommandTool {
    fn id(&self) -> &'static str {
        "execute-command"
    }

    fn name(&self) -> &'static str {
        "Execute Command"
    }

    fn risk_level(&self) -> RiskLevel {
        RiskLevel::High
    }

    fn description(&self) -> &'static str {
        "Run an allowlisted project command inside the granted directory."
    }

    fn required_permission_level(&self) -> &'static str {
        "read"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: self.id().to_string(),
                description: self.description().to_string(),
                parameters: Some(json!({
                    "type": "object",
                    "properties": {
                        "command": { "type": "string", "description": "Allowlisted executable to run (git, rg, pnpm, cargo)." },
                        "args": {
                            "type": "array",
                            "items": { "type": "string" },
                            "description": "Arguments passed directly to the executable."
                        },
                        "cwd": { "type": "string", "description": "Optional working directory inside the granted project." }
                    },
                    "required": ["command"]
                })),
            },
        }
    }

    async fn preview(
        &self,
        parameters: Value,
        ctx: &ToolContext,
    ) -> Result<Option<ToolApprovalPreview>, String> {
        let validated = self.validate_command(&parameters, ctx)?;
        let argv = format_argv_preview(&validated.command, &validated.args);
        let body = truncate_preview_body(format!(
            "cwd: {}\nargv: {}",
            if validated.display_cwd.is_empty() {
                ".".to_string()
            } else {
                validated.display_cwd.clone()
            },
            argv
        ));

        Ok(Some(ToolApprovalPreview {
            kind: "command".to_string(),
            summary: format!("Run {} in {}", argv, if validated.display_cwd.is_empty() { "." } else { validated.display_cwd.as_str() }),
            body: Some(body),
        }))
    }

    async fn execute(
        &self,
        parameters: Value,
        ctx: &ToolContext,
    ) -> Result<ToolExecutionOutput, String> {
        let validated = self.validate_command(&parameters, ctx)?;
        let execution = run_command_with_limits(&validated).await?;
        let argv = format_argv_preview(&validated.command, &validated.args);
        let cwd_label = if validated.display_cwd.is_empty() {
            ".".to_string()
        } else {
            validated.display_cwd.clone()
        };
        let report = format_command_report(&validated, &execution);

        if execution.timed_out {
            return Err(format!(
                "Command timed out after {}s.\n\n{}",
                COMMAND_TIMEOUT_SECS, report
            ));
        }

        if execution.exit_code.unwrap_or_default() != 0 {
            return Err(format!(
                "Command exited with status {}.\n\n{}",
                execution.exit_code.unwrap_or(-1),
                report
            ));
        }

        Ok(ToolExecutionOutput {
            output: report,
            summary: Some(format!("Ran {} in {}", argv, cwd_label)),
            metadata: Some(json!({
                "command": validated.command,
                "args": validated.args,
                "cwd": cwd_label,
                "exitCode": execution.exit_code,
                "stdoutTruncated": execution.stdout_truncated,
                "stderrTruncated": execution.stderr_truncated,
            })),
        })
    }
}

fn search_directory(
    project_root: &Path,
    current_dir: &Path,
    query: &str,
    file_glob: Option<&str>,
    case_sensitive: bool,
    matches: &mut Vec<String>,
    files_with_matches: &mut usize,
) -> Result<(), String> {
    if matches.len() >= SEARCH_MAX_MATCHES || *files_with_matches >= SEARCH_MAX_FILES {
        return Ok(());
    }

    let entries =
        fs::read_dir(current_dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();

        if path.is_dir() {
            if EXCLUDED_DIRS.iter().any(|dir| *dir == file_name) {
                continue;
            }
            search_directory(
                project_root,
                &path,
                query,
                file_glob,
                case_sensitive,
                matches,
                files_with_matches,
            )?;
            if matches.len() >= SEARCH_MAX_MATCHES || *files_with_matches >= SEARCH_MAX_FILES {
                break;
            }
            continue;
        }

        let relative = display_project_relative(project_root, &path);

        if let Some(pattern) = file_glob {
            if !wildcard_matches(pattern, &relative) {
                continue;
            }
        }

        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };
        let content = match std::str::from_utf8(&bytes) {
            Ok(content) => content,
            Err(_) => continue,
        };

        let normalized_query = if case_sensitive {
            query.to_string()
        } else {
            query.to_lowercase()
        };

        let mut file_has_match = false;
        for (line_index, line) in content.lines().enumerate() {
            let haystack = if case_sensitive {
                line.to_string()
            } else {
                line.to_lowercase()
            };

            if haystack.contains(&normalized_query) {
                if !file_has_match {
                    *files_with_matches += 1;
                    file_has_match = true;
                }
                matches.push(format!("{}:{}: {}", relative, line_index + 1, line.trim()));
                if matches.len() >= SEARCH_MAX_MATCHES || *files_with_matches >= SEARCH_MAX_FILES {
                    break;
                }
            }
        }

        if matches.len() >= SEARCH_MAX_MATCHES || *files_with_matches >= SEARCH_MAX_FILES {
            break;
        }
    }

    Ok(())
}

async fn read_stream_limited<R>(mut reader: R, limit: usize) -> Result<(Vec<u8>, bool), String>
where
    R: AsyncRead + Unpin + Send + 'static,
{
    let mut buffer = Vec::new();
    let mut temp = [0u8; 4096];
    let mut truncated = false;

    loop {
        let read = reader
            .read(&mut temp)
            .await
            .map_err(|e| format!("Failed to read process output: {}", e))?;
        if read == 0 {
            break;
        }

        let remaining = limit.saturating_sub(buffer.len());
        let to_copy = cmp::min(read, remaining);
        if to_copy > 0 {
            buffer.extend_from_slice(&temp[..to_copy]);
        }
        if read > to_copy || buffer.len() >= limit {
            truncated = true;
        }
    }

    Ok((buffer, truncated))
}

async fn run_command_with_limits(validated: &ValidatedCommand) -> Result<CommandExecution, String> {
    let mut command = Command::new(&validated.command);
    command
        .args(&validated.args)
        .current_dir(&validated.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    let stdout_task = tokio::spawn(read_stream_limited(stdout, COMMAND_OUTPUT_LIMIT_BYTES));
    let stderr_task = tokio::spawn(read_stream_limited(stderr, COMMAND_OUTPUT_LIMIT_BYTES));

    let status_result = tokio::time::timeout(Duration::from_secs(COMMAND_TIMEOUT_SECS), child.wait()).await;
    let (status, timed_out) = match status_result {
        Ok(Ok(status)) => (status, false),
        Ok(Err(e)) => return Err(format!("Failed while waiting for command: {}", e)),
        Err(_) => {
            child.kill().await.ok();
            let _ = child.wait().await;
            (
                std::process::ExitStatus::from_raw(1 << 8),
                true,
            )
        }
    };

    let (stdout, stdout_truncated) = stdout_task
        .await
        .map_err(|e| format!("Failed to join stdout reader: {}", e))??;
    let (stderr, stderr_truncated) = stderr_task
        .await
        .map_err(|e| format!("Failed to join stderr reader: {}", e))??;

    Ok(CommandExecution {
        stdout: String::from_utf8_lossy(&stdout).to_string(),
        stderr: String::from_utf8_lossy(&stderr).to_string(),
        stdout_truncated,
        stderr_truncated,
        timed_out,
        exit_code: if timed_out { None } else { status.code() },
    })
}

fn format_argv_preview(command: &str, args: &[String]) -> String {
    let mut parts = vec![command.to_string()];
    parts.extend(args.iter().map(|arg| {
        if arg.contains(' ') || arg.contains('"') {
            format!("{:?}", arg)
        } else {
            arg.clone()
        }
    }));
    parts.join(" ")
}

fn format_command_report(validated: &ValidatedCommand, execution: &CommandExecution) -> String {
    let mut sections = vec![
        format!("COMMAND: {}", format_argv_preview(&validated.command, &validated.args)),
        format!(
            "CWD: {}",
            if validated.display_cwd.is_empty() {
                ".".to_string()
            } else {
                validated.display_cwd.clone()
            }
        ),
    ];

    if let Some(code) = execution.exit_code {
        sections.push(format!("EXIT_CODE: {}", code));
    }

    let mut stdout = execution.stdout.clone();
    if execution.stdout_truncated {
        stdout.push_str("\n… stdout truncated …");
    }
    let mut stderr = execution.stderr.clone();
    if execution.stderr_truncated {
        stderr.push_str("\n… stderr truncated …");
    }

    sections.push(format!(
        "\nSTDOUT:\n{}",
        if stdout.trim().is_empty() {
            "(empty)".to_string()
        } else {
            stdout
        }
    ));
    sections.push(format!(
        "\nSTDERR:\n{}",
        if stderr.trim().is_empty() {
            "(empty)".to_string()
        } else {
            stderr
        }
    ));

    sections.join("\n")
}

#[cfg(unix)]
use std::os::unix::process::ExitStatusExt;
#[cfg(windows)]
use std::os::windows::process::ExitStatusExt;

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("pantheon-forge-tools-{}-{}", name, suffix))
    }

    fn test_context(project_root: PathBuf) -> ToolContext {
        ToolContext {
            project_access_id: "grant-1".into(),
            project_root,
            project_display_name: "Test Project".into(),
            permission_level: "read".into(),
        }
    }

    #[test]
    fn resolve_executable_tools_requires_project_access() {
        let tools = vec![
            AgentToolSpec {
                id: "read-file".into(),
                name: "Read File".into(),
                description: "Read file".into(),
                risk_level: RiskLevel::Low,
            },
            AgentToolSpec {
                id: "write-file".into(),
                name: "Write File".into(),
                description: "Write file".into(),
                risk_level: RiskLevel::Medium,
            },
            AgentToolSpec {
                id: "execute-command".into(),
                name: "Execute Command".into(),
                description: "Execute command".into(),
                risk_level: RiskLevel::High,
            },
        ];

        assert!(resolve_executable_tools(&tools, None).is_empty());
        assert_eq!(
            resolve_executable_tools(&tools, Some(&test_context(PathBuf::from("/tmp")))).len(),
            3
        );
    }

    #[tokio::test]
    async fn read_file_rejects_paths_outside_project_root() {
        let workspace_root = test_dir("escape-root");
        let outside_dir = test_dir("escape-outside");
        fs::create_dir_all(&workspace_root).unwrap();
        fs::create_dir_all(&outside_dir).unwrap();

        let outside_file = outside_dir.join("secret.txt");
        fs::write(&outside_file, "top secret").unwrap();

        let result = execute_tool(
            "read-file",
            json!({ "path": outside_file.display().to_string() }),
            &test_context(workspace_root.clone()),
        )
        .await;

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("escapes the granted project directory"));

        fs::remove_dir_all(&workspace_root).ok();
        fs::remove_dir_all(&outside_dir).ok();
    }

    #[tokio::test]
    async fn read_file_includes_hash() {
        let workspace_root = test_dir("read-hash");
        fs::create_dir_all(&workspace_root).unwrap();
        fs::write(workspace_root.join("notes.txt"), "line one\nline two\n").unwrap();

        let result = execute_tool(
            "read-file",
            json!({ "path": "notes.txt" }),
            &test_context(workspace_root.clone()),
        )
        .await
        .unwrap();

        assert!(result.output.contains("SHA256:"));

        fs::remove_dir_all(&workspace_root).ok();
    }

    #[tokio::test]
    async fn write_file_preview_and_execute() {
        let workspace_root = test_dir("write");
        fs::create_dir_all(&workspace_root).unwrap();
        fs::write(workspace_root.join("notes.txt"), "alpha\nbeta\n").unwrap();

        let existing_bytes = fs::read(workspace_root.join("notes.txt")).unwrap();
        let expected_hash = sha256_hex(&existing_bytes);
        let params = json!({
            "path": "notes.txt",
            "content": "alpha\nbeta updated\ngamma\n",
            "expectedHash": expected_hash,
        });

        let preview = preview_tool("write-file", params.clone(), &test_context(workspace_root.clone()))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(preview.kind, "diff");
        assert!(preview.summary.contains("Overwrite"));
        assert!(preview.body.unwrap().contains("--- notes.txt"));

        let result = execute_tool("write-file", params, &test_context(workspace_root.clone()))
            .await
            .unwrap();
        assert!(result.output.contains("WRITE FILE RESULT"));
        let updated = fs::read_to_string(workspace_root.join("notes.txt")).unwrap();
        assert!(updated.contains("beta updated"));

        fs::remove_dir_all(&workspace_root).ok();
    }

    #[tokio::test]
    async fn write_file_rejects_stale_expected_hash() {
        let workspace_root = test_dir("write-conflict");
        fs::create_dir_all(&workspace_root).unwrap();
        fs::write(workspace_root.join("notes.txt"), "alpha\n").unwrap();

        let result = preview_tool(
            "write-file",
            json!({
                "path": "notes.txt",
                "content": "beta\n",
                "expectedHash": "stale-hash",
            }),
            &test_context(workspace_root.clone()),
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File changed since it was read"));

        fs::remove_dir_all(&workspace_root).ok();
    }

    #[tokio::test]
    async fn search_files_skips_excluded_directories() {
        let workspace_root = test_dir("search");
        fs::create_dir_all(workspace_root.join("src")).unwrap();
        fs::create_dir_all(workspace_root.join(".git")).unwrap();
        fs::write(
            workspace_root.join("src/main.rs"),
            "hello target\nneedle here\n",
        )
        .unwrap();
        fs::write(
            workspace_root.join(".git/ignored.txt"),
            "needle should stay hidden\n",
        )
        .unwrap();

        let result = execute_tool(
            "search-files",
            json!({ "query": "needle" }),
            &test_context(workspace_root.clone()),
        )
        .await
        .unwrap();

        assert!(result.output.contains("src/main.rs:2"));
        assert!(!result.output.contains(".git/ignored.txt"));

        fs::remove_dir_all(&workspace_root).ok();
    }

    #[tokio::test]
    async fn execute_command_rejects_disallowed_commands() {
        let workspace_root = test_dir("command-reject");
        fs::create_dir_all(&workspace_root).unwrap();

        let result = preview_tool(
            "execute-command",
            json!({ "command": "bash", "args": ["-lc", "pwd"] }),
            &test_context(workspace_root.clone()),
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not allowlisted"));

        fs::remove_dir_all(&workspace_root).ok();
    }

    #[tokio::test]
    async fn execute_command_runs_allowed_git_status() {
        let workspace_root = test_dir("command-git");
        fs::create_dir_all(&workspace_root).unwrap();
        std::process::Command::new("git")
            .args(["init", "-q"])
            .current_dir(&workspace_root)
            .status()
            .unwrap();

        let preview = preview_tool(
            "execute-command",
            json!({ "command": "git", "args": ["status"] }),
            &test_context(workspace_root.clone()),
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(preview.kind, "command");
        assert!(preview.summary.contains("git status"));

        let result = execute_tool(
            "execute-command",
            json!({ "command": "git", "args": ["status"] }),
            &test_context(workspace_root.clone()),
        )
        .await
        .unwrap();
        assert!(result.output.contains("COMMAND: git status"));

        fs::remove_dir_all(&workspace_root).ok();
    }
}
