import { invoke } from '@tauri-apps/api/core';

/** Check if the app is running inside the Tauri native webview. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: MessageRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function: FunctionCall;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage?: Usage;
}

export interface Choice {
  index: number;
  message: Message;
  finish_reason?: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ProviderCredential {
  provider_id: ProviderId;
  api_key: string;
  base_url?: string;
  model?: string;
  created_at: number;
}

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'ollama';

export interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StoredMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  tool_calls?: string;
  tool_call_id?: string;
}

export const PROVIDERS: { id: ProviderId; name: string; defaultModel: string }[] = [
  { id: 'anthropic', name: 'Anthropic', defaultModel: 'claude-3-5-sonnet-20241022' },
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o' },
  { id: 'google', name: 'Google', defaultModel: 'gemini-2.0-flash-exp' },
  { id: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-chat' },
  { id: 'ollama', name: 'Ollama', defaultModel: 'llama3.2' },
];

// === LLM Commands ===

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

// === Credential Commands ===

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

// === Storage Commands ===

export async function createConversation(
  agentId: string,
  title: string,
): Promise<Conversation> {
  return invoke('create_conversation', { agentId, title });
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
