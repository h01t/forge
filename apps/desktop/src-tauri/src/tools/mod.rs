use crate::llm::{FunctionDefinition, ToolDefinition};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

const READ_FILE_MAX_BYTES: usize = 64 * 1024;
const READ_FILE_MAX_LINES: usize = 300;
const SEARCH_MAX_MATCHES: usize = 100;
const SEARCH_MAX_FILES: usize = 40;
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

#[derive(Debug, Clone)]
pub struct ToolExecutionOutput {
    pub output: String,
}

#[derive(Debug, Clone)]
pub struct ExecutableTool {
    pub tool_id: String,
    pub tool_name: String,
    pub risk_level: RiskLevel,
    pub definition: ToolDefinition,
}

pub trait ToolExecutor: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    fn risk_level(&self) -> RiskLevel;
    fn description(&self) -> &'static str;
    fn required_permission_level(&self) -> &'static str;
    fn definition(&self) -> ToolDefinition;
    fn execute(&self, parameters: Value, ctx: &ToolContext) -> Result<ToolExecutionOutput, String>;
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

pub fn execute_tool(
    tool_id: &str,
    parameters: Value,
    ctx: &ToolContext,
) -> Result<ToolExecutionOutput, String> {
    let tool = get_tool(tool_id).ok_or_else(|| format!("Unsupported tool: {}", tool_id))?;
    tool.execute(parameters, ctx)
}

fn get_tool(tool_id: &str) -> Option<Box<dyn ToolExecutor>> {
    match tool_id {
        "read-file" => Some(Box::new(ReadFileTool)),
        "search-files" => Some(Box::new(SearchFilesTool)),
        _ => None,
    }
}

fn resolve_project_path(project_root: &Path, path: &str) -> Result<PathBuf, String> {
    let project_root = project_root
        .canonicalize()
        .map_err(|e| format!("Failed to resolve granted project path: {}", e))?;
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

fn wildcard_matches(pattern: &str, text: &str) -> bool {
    fn inner(pattern: &[u8], text: &[u8]) -> bool {
        match (pattern.first(), text.first()) {
            (None, None) => true,
            (None, Some(_)) => false,
            (Some(b'*'), _) => {
                inner(&pattern[1..], text) || (!text.is_empty() && inner(pattern, &text[1..]))
            }
            (Some(b'?'), Some(_)) => inner(&pattern[1..], &text[1..]),
            (Some(ch), Some(txt)) if ch.eq_ignore_ascii_case(txt) => {
                inner(&pattern[1..], &text[1..])
            }
            _ => false,
        }
    }

    inner(pattern.as_bytes(), text.as_bytes())
}

struct ReadFileTool;

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

    fn execute(&self, parameters: Value, ctx: &ToolContext) -> Result<ToolExecutionOutput, String> {
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

        let resolved_path = resolve_project_path(&ctx.project_root, path)?;
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

        let display_path = resolved_path
            .strip_prefix(&ctx.project_root)
            .unwrap_or(&resolved_path)
            .display()
            .to_string();

        Ok(ToolExecutionOutput {
            output: format!(
                "FILE: {}\nLINES: {}-{} of {}\n\n{}",
                display_path,
                start_line.min(total_lines.max(1)),
                end_line.max(start_line.min(total_lines.max(1))),
                total_lines,
                selected
            ),
        })
    }
}

struct SearchFilesTool;

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

    fn execute(&self, parameters: Value, ctx: &ToolContext) -> Result<ToolExecutionOutput, String> {
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
        search_directory(
            &ctx.project_root,
            &ctx.project_root,
            query,
            file_glob,
            case_sensitive,
            &mut matches,
            &mut files_with_matches,
        )?;

        if matches.is_empty() {
            return Ok(ToolExecutionOutput {
                output: format!("No matches found for `{}`.", query),
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

        let relative = path
            .strip_prefix(project_root)
            .unwrap_or(&path)
            .display()
            .to_string();

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
                risk_level: RiskLevel::High,
            },
        ];

        assert!(resolve_executable_tools(&tools, None).is_empty());
        assert_eq!(
            resolve_executable_tools(&tools, Some(&test_context(PathBuf::from("/tmp")))).len(),
            1
        );
    }

    #[test]
    fn read_file_rejects_paths_outside_project_root() {
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
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("escapes the granted project directory"));

        fs::remove_dir_all(&workspace_root).ok();
        fs::remove_dir_all(&outside_dir).ok();
    }

    #[test]
    fn search_files_skips_excluded_directories() {
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
        .unwrap();

        assert!(result.output.contains("src/main.rs:2"));
        assert!(!result.output.contains(".git/ignored.txt"));

        fs::remove_dir_all(&workspace_root).ok();
    }
}
