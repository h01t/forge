// Core types for Pantheon Forge

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'ollama';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

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
