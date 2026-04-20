import { invoke } from '@tauri-apps/api/core';
import type {
  ChatCompletionResponse,
  Conversation,
  Message,
  ProjectAccessGrant,
  ProjectPermissionLevel,
  ProviderCredential,
  ProviderId,
  StoredMessage,
  Tool,
  ToolApprovalDecision,
  ToolExecutionLog,
} from '@pantheon-forge/agent-types';
import { PROVIDERS } from '@pantheon-forge/agent-types';

export type {
  AgentTurnStreamPayload,
  ApprovalStatus,
  ChatCompletionResponse,
  Conversation,
  Message,
  MessageRole,
  ProjectAccessGrant,
  ProjectPermissionLevel,
  ProviderCredential,
  ProviderDefinition,
  ProviderId,
  ProviderStatus,
  RiskLevel,
  StoredMessage,
  Tool,
  ToolApprovalRequest,
  ToolApprovalDecision,
  ToolApprovalPreview,
  ToolExecutionLog,
  ToolExecutionStatus,
} from '@pantheon-forge/agent-types';
export { PROVIDERS };

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function chatCompletion(
  providerId: ProviderId,
  messages: Message[],
  model?: string,
  temperature?: number,
  maxTokens?: number,
): Promise<ChatCompletionResponse> {
  return invoke('chat_completion', {
    providerId,
    messages,
    model: model ?? null,
    temperature: temperature ?? null,
    maxTokens: maxTokens ?? null,
  });
}

export async function streamChatCompletion(
  requestId: string,
  providerId: ProviderId,
  messages: Message[],
  model?: string,
  temperature?: number,
  maxTokens?: number,
): Promise<string> {
  return invoke('stream_chat_completion', {
    requestId,
    providerId,
    messages,
    model: model ?? null,
    temperature: temperature ?? null,
    maxTokens: maxTokens ?? null,
  });
}

export async function runAgentTurn(
  requestId: string,
  conversationId: string,
  agentId: string,
  providerId: ProviderId,
  messages: Message[],
  agentTools: Tool[],
  model?: string,
): Promise<string> {
  return invoke('run_agent_turn', {
    requestId,
    conversationId,
    agentId,
    providerId,
    messages,
    agentTools,
    model: model ?? null,
  });
}

export async function respondToToolApproval(
  approval: ToolApprovalDecision,
): Promise<void> {
  return invoke('respond_to_tool_approval', { approval });
}

export async function listToolExecutions(
  conversationId: string,
): Promise<ToolExecutionLog[]> {
  return invoke('list_tool_executions', { conversationId });
}

export async function listRecentToolExecutions(
  limit = 12,
): Promise<ToolExecutionLog[]> {
  return invoke('list_recent_tool_executions', { limit });
}

export async function storeProviderCredentials(
  credential: ProviderCredential,
): Promise<void> {
  return invoke('store_provider_credentials', { credential });
}

export async function getProviderCredentials(
  providerId: ProviderId,
): Promise<ProviderCredential> {
  return invoke('get_provider_credentials', { providerId });
}

export async function listStoredProviders(): Promise<string[]> {
  return invoke('list_stored_providers');
}

export async function removeProviderCredentials(
  providerId: ProviderId,
): Promise<void> {
  return invoke('remove_provider_credentials', { providerId });
}

export async function clearAllCredentials(): Promise<void> {
  return invoke('clear_all_credentials');
}

export async function createConversation(
  agentId: string,
  title: string,
  projectAccessId?: string | null,
): Promise<Conversation> {
  return invoke('create_conversation', {
    agentId,
    title,
    projectAccessId: projectAccessId ?? null,
  });
}

export async function getConversation(id: string): Promise<Conversation> {
  return invoke('get_conversation', { id });
}

export async function listConversations(): Promise<Conversation[]> {
  return invoke('list_conversations');
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<void> {
  return invoke('update_conversation_title', { id, title });
}

export async function deleteConversation(id: string): Promise<void> {
  return invoke('delete_conversation', { id });
}

export async function addMessage(
  conversationId: string,
  message: Message,
): Promise<string> {
  return invoke('add_message', { conversationId, message });
}

export async function getMessages(
  conversationId: string,
): Promise<StoredMessage[]> {
  return invoke('get_messages', { conversationId });
}

export async function getSetting(key: string): Promise<string | null> {
  return invoke('get_setting', { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke('set_setting', { key, value });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return invoke('get_all_settings');
}

export async function listProjectAccessGrants(): Promise<ProjectAccessGrant[]> {
  return invoke('list_project_access_grants');
}

export async function saveProjectAccessGrant(
  path: string,
  permissionLevel: ProjectPermissionLevel = 'read',
): Promise<ProjectAccessGrant> {
  return invoke('save_project_access_grant', {
    path,
    permissionLevel,
  });
}

export async function revokeProjectAccessGrant(id: string): Promise<void> {
  return invoke('revoke_project_access_grant', { id });
}

export async function attachProjectAccessToConversation(
  conversationId: string,
  projectAccessId: string | null,
): Promise<Conversation> {
  return invoke('attach_project_access_to_conversation', {
    conversationId,
    projectAccessId,
  });
}
