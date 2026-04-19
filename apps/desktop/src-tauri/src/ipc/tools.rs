use crate::credentials::get_credential_manager;
use crate::llm::{
    ChatCompletionRequest, LLMConfig, Message, MessageRole, ProviderFactory, ProviderId,
};
use crate::storage::{
    NewToolExecution, ProjectAccessGrant, ToolExecutionLog, ToolExecutionResultPayload,
};
use crate::tools::{execute_tool, resolve_executable_tools, AgentToolSpec, ToolContext};
use crate::AppState;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Instant;
use tauri::{Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolApprovalRequestPayload {
    pub id: String,
    pub request_id: String,
    pub conversation_id: String,
    pub agent_id: String,
    pub tool_call_id: String,
    pub tool_id: String,
    pub tool_name: String,
    pub risk_level: String,
    pub parameters: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_access_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolApprovalDecisionPayload {
    pub approval_id: String,
    pub decision: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTurnPayload {
    pub request_id: String,
    pub event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delta: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_request: Option<ToolApprovalRequestPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_execution: Option<ToolExecutionLog>,
}

fn emit_turn_event(app_handle: &tauri::AppHandle, payload: AgentTurnPayload) {
    let _ = app_handle.emit("agent-turn-event", payload);
}

fn provider_config(provider_id: ProviderId, model: Option<String>) -> Result<LLMConfig, String> {
    let cred_manager = get_credential_manager();
    let credential = cred_manager
        .get_provider(provider_id)
        .map_err(|e| format!("Failed to get credentials: {}", e))?;

    Ok(LLMConfig {
        provider_id,
        api_key: credential.api_key,
        base_url: credential.base_url,
        model: model.or(credential.model),
    })
}

fn build_tool_context(grant: &ProjectAccessGrant) -> ToolContext {
    ToolContext {
        project_access_id: grant.id.clone(),
        project_root: grant.path.clone().into(),
        project_display_name: grant.display_name.clone(),
        permission_level: grant.permission_level.clone(),
    }
}

#[tauri::command]
pub async fn respond_to_tool_approval(
    approval: ToolApprovalDecisionPayload,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sender = {
        let mut pending = state.pending_approvals.lock().await;
        pending.remove(&approval.approval_id)
    }
    .ok_or_else(|| format!("Approval {} is no longer pending", approval.approval_id))?;

    sender
        .send(approval)
        .map_err(|_| "Failed to deliver approval decision".to_string())
}

#[tauri::command]
pub async fn list_tool_executions(
    conversation_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ToolExecutionLog>, String> {
    state
        .storage
        .list_tool_executions(&conversation_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_agent_turn(
    app_handle: tauri::AppHandle,
    request_id: String,
    conversation_id: String,
    agent_id: String,
    provider_id: String,
    messages: Vec<Message>,
    agent_tools: Vec<AgentToolSpec>,
    model: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let provider_enum = ProviderId::from_str(&provider_id)
        .ok_or_else(|| format!("Invalid provider: {}", provider_id))?;
    let config = provider_config(provider_enum, model)?;
    let model = config
        .model
        .clone()
        .unwrap_or_else(|| ProviderFactory::default_model(provider_enum).to_string());
    let conversation = state
        .storage
        .get_conversation(&conversation_id)
        .await
        .map_err(|e| e.to_string())?;
    let project_access = match conversation.project_access_id.as_deref() {
        Some(project_access_id) => Some(
            state
                .storage
                .get_project_access_grant(project_access_id)
                .await
                .map_err(|e| e.to_string())?,
        ),
        None => None,
    };
    let tool_context = project_access.as_ref().map(build_tool_context);
    let executable_tools = resolve_executable_tools(&agent_tools, tool_context.as_ref());
    let tool_definitions = if executable_tools.is_empty() {
        None
    } else {
        Some(
            executable_tools
                .iter()
                .map(|tool| tool.definition.clone())
                .collect::<Vec<_>>(),
        )
    };

    let provider = ProviderFactory::create_provider(&config).map_err(|e| e.to_string())?;

    emit_turn_event(
        &app_handle,
        AgentTurnPayload {
            request_id: request_id.clone(),
            event_type: "start".into(),
            delta: None,
            finish_reason: None,
            error: None,
            approval_request: None,
            tool_execution: None,
        },
    );

    let mut turn_messages = messages;
    let mut final_response = String::new();

    loop {
        let request = ChatCompletionRequest {
            messages: turn_messages.clone(),
            model: model.clone(),
            temperature: None,
            max_tokens: None,
            top_p: None,
            stream: Some(false),
            tools: tool_definitions.clone(),
        };

        let response = provider
            .chat_completion(request)
            .await
            .map_err(|e| e.to_string())?;
        let choice = response
            .choices
            .first()
            .cloned()
            .ok_or_else(|| "Provider returned no choices".to_string())?;
        let assistant_message = choice.message.clone();

        if !assistant_message.content.is_empty() {
            final_response.push_str(&assistant_message.content);
            emit_turn_event(
                &app_handle,
                AgentTurnPayload {
                    request_id: request_id.clone(),
                    event_type: "content".into(),
                    delta: Some(assistant_message.content.clone()),
                    finish_reason: None,
                    error: None,
                    approval_request: None,
                    tool_execution: None,
                },
            );
        }

        if !assistant_message.content.is_empty() || assistant_message.tool_calls.is_some() {
            state
                .storage
                .add_message(&conversation_id, &assistant_message)
                .await
                .map_err(|e| e.to_string())?;
            turn_messages.push(assistant_message.clone());
        }

        let tool_calls = assistant_message.tool_calls.clone().unwrap_or_default();
        if tool_calls.is_empty() {
            emit_turn_event(
                &app_handle,
                AgentTurnPayload {
                    request_id: request_id.clone(),
                    event_type: "done".into(),
                    delta: None,
                    finish_reason: choice.finish_reason,
                    error: None,
                    approval_request: None,
                    tool_execution: None,
                },
            );
            return Ok(final_response);
        }

        let tool_context = tool_context
            .as_ref()
            .ok_or_else(|| "Project access is required for tools".to_string())?;

        for tool_call in tool_calls {
            let executable = executable_tools
                .iter()
                .find(|tool| tool.tool_id == tool_call.function.name)
                .ok_or_else(|| format!("Tool {} is not available", tool_call.function.name))?;
            let parameters: Value = serde_json::from_str(&tool_call.function.arguments)
                .map_err(|e| format!("Invalid tool call parameters: {}", e))?;
            let project_path = tool_context.project_root.to_string_lossy().to_string();
            let log = state
                .storage
                .create_tool_execution(NewToolExecution {
                    conversation_id: &conversation_id,
                    request_id: &request_id,
                    tool_call_id: &tool_call.id,
                    agent_id: &agent_id,
                    tool_id: &executable.tool_id,
                    tool_name: &executable.tool_name,
                    risk_level: executable.risk_level.as_str(),
                    parameters: parameters.clone(),
                    project_access_id: Some(tool_context.project_access_id.as_str()),
                    project_display_name: Some(tool_context.project_display_name.as_str()),
                    project_path: Some(project_path.as_str()),
                    permission_level: Some(tool_context.permission_level.as_str()),
                })
                .await
                .map_err(|e| e.to_string())?;

            let approval_id = log.id.clone();
            let approval_request = ToolApprovalRequestPayload {
                id: approval_id.clone(),
                request_id: request_id.clone(),
                conversation_id: conversation_id.clone(),
                agent_id: agent_id.clone(),
                tool_call_id: tool_call.id.clone(),
                tool_id: executable.tool_id.clone(),
                tool_name: executable.tool_name.clone(),
                risk_level: executable.risk_level.as_str().to_string(),
                parameters: parameters.clone(),
                project_access_id: Some(tool_context.project_access_id.clone()),
                project_display_name: Some(tool_context.project_display_name.clone()),
                project_path: Some(project_path),
                permission_level: Some(tool_context.permission_level.clone()),
                description: Some(executable.definition.function.description.clone()),
                timestamp: log.timestamp,
            };

            let (tx, rx) = tokio::sync::oneshot::channel();
            {
                let mut pending = state.pending_approvals.lock().await;
                pending.insert(approval_id.clone(), tx);
            }

            emit_turn_event(
                &app_handle,
                AgentTurnPayload {
                    request_id: request_id.clone(),
                    event_type: "approval_requested".into(),
                    delta: None,
                    finish_reason: None,
                    error: None,
                    approval_request: Some(approval_request),
                    tool_execution: Some(log.clone()),
                },
            );

            let decision = rx
                .await
                .map_err(|_| "Approval flow was interrupted".to_string())?;

            let approval_status = if decision.decision == "approved" {
                "approved"
            } else {
                "denied"
            };
            state
                .storage
                .update_tool_execution_status(&log.id, approval_status, None, None)
                .await
                .map_err(|e| e.to_string())?;
            let approved_log = state
                .storage
                .get_tool_execution(&log.id)
                .await
                .map_err(|e| e.to_string())?;
            emit_turn_event(
                &app_handle,
                AgentTurnPayload {
                    request_id: request_id.clone(),
                    event_type: "approval_resolved".into(),
                    delta: None,
                    finish_reason: None,
                    error: None,
                    approval_request: None,
                    tool_execution: Some(approved_log.clone()),
                },
            );

            let (tool_message, final_log) = if decision.decision == "approved" {
                state
                    .storage
                    .update_tool_execution_status(&log.id, "running", None, None)
                    .await
                    .map_err(|e| e.to_string())?;
                let running_log = state
                    .storage
                    .get_tool_execution(&log.id)
                    .await
                    .map_err(|e| e.to_string())?;
                emit_turn_event(
                    &app_handle,
                    AgentTurnPayload {
                        request_id: request_id.clone(),
                        event_type: "tool_running".into(),
                        delta: None,
                        finish_reason: None,
                        error: None,
                        approval_request: None,
                        tool_execution: Some(running_log),
                    },
                );

                let started_at = Instant::now();
                match execute_tool(&executable.tool_id, parameters.clone(), tool_context) {
                    Ok(output) => {
                        let result = ToolExecutionResultPayload {
                            success: true,
                            output: Some(output.output.clone()),
                            error: None,
                            execution_time: started_at.elapsed().as_millis() as u64,
                        };
                        state
                            .storage
                            .update_tool_execution_status(&log.id, "succeeded", Some(&result), None)
                            .await
                            .map_err(|e| e.to_string())?;
                        let final_log = state
                            .storage
                            .get_tool_execution(&log.id)
                            .await
                            .map_err(|e| e.to_string())?;
                        (
                            Message {
                                role: MessageRole::Tool,
                                content: output.output,
                                tool_calls: None,
                                tool_call_id: Some(tool_call.id.clone()),
                            },
                            final_log,
                        )
                    }
                    Err(error_message) => {
                        let result = ToolExecutionResultPayload {
                            success: false,
                            output: None,
                            error: Some(error_message.clone()),
                            execution_time: started_at.elapsed().as_millis() as u64,
                        };
                        state
                            .storage
                            .update_tool_execution_status(
                                &log.id,
                                "failed",
                                Some(&result),
                                Some(&error_message),
                            )
                            .await
                            .map_err(|e| e.to_string())?;
                        let final_log = state
                            .storage
                            .get_tool_execution(&log.id)
                            .await
                            .map_err(|e| e.to_string())?;
                        (
                            Message {
                                role: MessageRole::Tool,
                                content: format!("Tool execution failed: {}", error_message),
                                tool_calls: None,
                                tool_call_id: Some(tool_call.id.clone()),
                            },
                            final_log,
                        )
                    }
                }
            } else {
                let result = ToolExecutionResultPayload {
                    success: false,
                    output: None,
                    error: Some("Denied by user".to_string()),
                    execution_time: 0,
                };
                state
                    .storage
                    .update_tool_execution_status(
                        &log.id,
                        "denied",
                        Some(&result),
                        Some("Denied by user"),
                    )
                    .await
                    .map_err(|e| e.to_string())?;
                let final_log = state
                    .storage
                    .get_tool_execution(&log.id)
                    .await
                    .map_err(|e| e.to_string())?;
                (
                    Message {
                        role: MessageRole::Tool,
                        content: "Tool request denied by user.".to_string(),
                        tool_calls: None,
                        tool_call_id: Some(tool_call.id.clone()),
                    },
                    final_log,
                )
            };

            state
                .storage
                .add_message(&conversation_id, &tool_message)
                .await
                .map_err(|e| e.to_string())?;
            turn_messages.push(tool_message);

            emit_turn_event(
                &app_handle,
                AgentTurnPayload {
                    request_id: request_id.clone(),
                    event_type: "tool_finished".into(),
                    delta: None,
                    finish_reason: None,
                    error: None,
                    approval_request: None,
                    tool_execution: Some(final_log),
                },
            );
        }
    }
}
