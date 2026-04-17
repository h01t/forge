export type ProviderId = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'ollama';
export type ProviderStatus = 'available' | 'planned';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function: FunctionCall;
}

export interface Message {
  id?: string;
  role: MessageRole;
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
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

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage?: Usage;
}

export interface ProviderCredential {
  provider_id: ProviderId;
  api_key: string;
  base_url?: string;
  model?: string;
  created_at: number;
}

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

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  defaultModel: string;
  status: ProviderStatus;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    status: 'available',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    status: 'available',
  },
  {
    id: 'google',
    name: 'Google',
    defaultModel: 'gemini-2.0-flash-exp',
    status: 'planned',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    status: 'available',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    defaultModel: 'llama3.2',
    status: 'planned',
  },
];

export interface LLMProviderConfig {
  id: ProviderId;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  parameters?: Record<string, unknown>;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: AgentCapability[];
  tools: Tool[];
  llmPreference?: ProviderId;
  collaborationRules?: CollaborationRule[];
}

export interface CollaborationRule {
  type: 'can-delegate-to' | 'can-consult' | 'can-handoff-to';
  targetAgentId: string;
  conditions?: string;
}

export interface CollaborationEvent {
  id: string;
  fromAgentId: string;
  toAgentId?: string;
  type: 'delegation' | 'handoff' | 'consultation' | 'broadcast';
  message: string;
  timestamp: number;
}

export type CollaborationMessageType =
  | 'direct'
  | 'broadcast'
  | 'delegation-request'
  | 'delegation-response'
  | 'handoff';

export interface CollaborationMessage {
  type: CollaborationMessageType;
  from: string;
  to?: string | string[];
  content: string;
  context?: Record<string, unknown>;
}

export interface ToolExecutionRequest {
  toolId: string;
  parameters: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ToolExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}

export interface ToolApprovalRequest {
  id: string;
  agentId: string;
  toolId: string;
  toolName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  parameters: Record<string, unknown>;
  description?: string;
  timestamp: number;
}

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'modified';

export interface ToolExecutionLog {
  id: string;
  agentId: string;
  toolId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status: ApprovalStatus;
  result?: ToolExecutionResult;
  timestamp: number;
}

export interface Settings {
  theme: 'cyberpunk' | 'minimal' | 'professional';
  defaultProvider: ProviderId;
  providers: LLMProviderConfig[];
  autoApproveLowRisk: boolean;
  requireApprovalForHighRisk: boolean;
}
