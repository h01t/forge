'use client';

import { create } from 'zustand';
import type {
  Conversation,
  Message,
  ProviderId,
  StoredMessage,
  Tool,
  ToolApprovalRequest,
  ToolExecutionLog,
} from '@/lib/tauri';
import {
  addMessage,
  createConversation,
  getMessages as fetchMessages,
  listToolExecutions,
  respondToToolApproval,
  runAgentTurn,
} from '@/lib/tauri';
import { generateRequestId, listenAgentTurn, type UnlistenFn } from '@/lib/streaming';
import { useAgentStore } from './agents';
import { useConversationsStore } from './conversations';
import { useProjectAccessStore } from './project-access';

const SUPPORTED_TOOL_IDS = new Set([
  'read-file',
  'search-files',
  'write-file',
  'execute-command',
]);

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

interface ChatState {
  messages: DisplayMessage[];
  historyMessages: Message[];
  toolExecutions: ToolExecutionLog[];
  pendingApproval: ToolApprovalRequest | null;
  approvalResolving: boolean;
  conversation: Conversation | null;
  streaming: boolean;
  error: string | null;

  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    content: string,
    providerId: ProviderId,
    model?: string,
  ) => Promise<void>;
  approvePendingTool: () => Promise<void>;
  denyPendingTool: () => Promise<void>;
  clearMessages: () => void;
  setConversation: (conv: Conversation | null) => void;
}

let msgCounter = 0;
function nextMsgId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

function parseStoredToolCalls(rawToolCalls?: string): Message['tool_calls'] {
  if (!rawToolCalls) {
    return undefined;
  }

  try {
    return JSON.parse(rawToolCalls) as Message['tool_calls'];
  } catch {
    return undefined;
  }
}

function parseStoredMessage(message: StoredMessage): Message {
  return {
    id: message.id,
    role: message.role as Message['role'],
    content: message.content,
    tool_calls: parseStoredToolCalls(message.tool_calls),
    tool_call_id: message.tool_call_id,
  };
}

function isVisibleMessage(message: Message): message is Message & {
  role: 'user' | 'assistant' | 'system';
} {
  if (message.role === 'tool') {
    return false;
  }

  if (
    message.role === 'assistant' &&
    !message.content.trim() &&
    message.tool_calls &&
    message.tool_calls.length > 0
  ) {
    return false;
  }

  return true;
}

function finalizeStreamingAssistant(messages: DisplayMessage[]): DisplayMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage?.streaming || lastMessage.role !== 'assistant') {
    return messages;
  }

  return [
    ...messages.slice(0, -1),
    {
      ...lastMessage,
      streaming: false,
    },
  ];
}

function upsertToolExecution(
  logs: ToolExecutionLog[],
  execution?: ToolExecutionLog,
): ToolExecutionLog[] {
  if (!execution) {
    return logs;
  }

  const nextLogs = [...logs];
  const index = nextLogs.findIndex((item) => item.id === execution.id);
  if (index === -1) {
    nextLogs.push(execution);
  } else {
    nextLogs[index] = execution;
  }

  nextLogs.sort((left, right) => left.timestamp - right.timestamp);
  return nextLogs;
}

function supportedAgentTools(agentTools: Tool[] | undefined): Tool[] {
  return (agentTools ?? []).filter((tool) => SUPPORTED_TOOL_IDS.has(tool.id));
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  historyMessages: [],
  toolExecutions: [],
  pendingApproval: null,
  approvalResolving: false,
  conversation: null,
  streaming: false,
  error: null,

  loadMessages: async (conversationId) => {
    try {
      const [storedMessages, toolExecutions] = await Promise.all([
        fetchMessages(conversationId),
        listToolExecutions(conversationId),
      ]);
      const historyMessages = storedMessages.map(parseStoredMessage);
      const messages = storedMessages.reduce<DisplayMessage[]>(
        (items, storedMessage, index) => {
          const historyMessage = historyMessages[index];
          if (!isVisibleMessage(historyMessage)) {
            return items;
          }

          items.push({
            id: storedMessage.id,
            role: historyMessage.role,
            content: historyMessage.content,
            timestamp: Date.parse(storedMessage.created_at) || Date.now(),
          });
          return items;
        },
        [],
      );

      set({
        messages,
        historyMessages,
        toolExecutions,
        pendingApproval: null,
        approvalResolving: false,
        streaming: false,
        error: null,
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  sendMessage: async (content, providerId, model) => {
    const state = get();
    if (state.streaming) {
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const currentAgent = useAgentStore.getState().currentAgent;
    const userTimestamp = Date.now();
    const userMessage: Message = {
      role: 'user',
      content: trimmed,
    };

    let conversation = state.conversation;
    if (!conversation) {
      const agentId = currentAgent?.id ?? 'default';
      const title = trimmed.slice(0, 60) + (trimmed.length > 60 ? '...' : '');
      const starterProjectId = useProjectAccessStore.getState().starterProjectId;
      try {
        conversation = await createConversation(agentId, title, starterProjectId);
        set({ conversation });
        void useConversationsStore.getState().loadConversations();
      } catch (e) {
        set({ error: String(e), streaming: false });
        return;
      }
    }

    set((currentState) => ({
      messages: [
        ...currentState.messages,
        {
          id: nextMsgId(),
          role: 'user',
          content: trimmed,
          timestamp: userTimestamp,
        },
      ],
      historyMessages: [...currentState.historyMessages, userMessage],
      streaming: true,
      error: null,
      pendingApproval: null,
      approvalResolving: false,
    }));

    try {
      await addMessage(conversation.id, userMessage);
    } catch (e) {
      set((currentState) => ({
        messages: [
          ...currentState.messages,
          {
            id: nextMsgId(),
            role: 'assistant',
            content: `Error: ${String(e)}`,
            timestamp: Date.now(),
          },
        ],
        streaming: false,
        error: String(e),
      }));
      return;
    }

    const turnMessages: Message[] = [];
    if (currentAgent?.systemPrompt) {
      turnMessages.push({
        role: 'system',
        content: currentAgent.systemPrompt,
      });
    }
    turnMessages.push(...get().historyMessages);

    const requestId = generateRequestId();
    let unlisten: UnlistenFn | undefined;

    try {
      unlisten = await listenAgentTurn(requestId, {
        onContent: (delta) => {
          set((currentState) => {
            const lastMessage = currentState.messages[currentState.messages.length - 1];
            if (lastMessage?.role === 'assistant' && lastMessage.streaming) {
              return {
                messages: [
                  ...currentState.messages.slice(0, -1),
                  {
                    ...lastMessage,
                    content: lastMessage.content + delta,
                  },
                ],
              };
            }

            return {
              messages: [
                ...currentState.messages,
                {
                  id: nextMsgId(),
                  role: 'assistant',
                  content: delta,
                  timestamp: Date.now(),
                  streaming: true,
                },
              ],
            };
          });
        },
        onApprovalRequested: (payload) => {
          set((currentState) => ({
            messages: finalizeStreamingAssistant(currentState.messages),
            toolExecutions: upsertToolExecution(
              currentState.toolExecutions,
              payload.tool_execution,
            ),
            pendingApproval: payload.approval_request ?? currentState.pendingApproval,
            approvalResolving: false,
          }));
        },
        onApprovalResolved: (payload) => {
          set((currentState) => ({
            toolExecutions: upsertToolExecution(
              currentState.toolExecutions,
              payload.tool_execution,
            ),
            pendingApproval: null,
            approvalResolving: false,
          }));
        },
        onToolRunning: (payload) => {
          set((currentState) => ({
            messages: finalizeStreamingAssistant(currentState.messages),
            toolExecutions: upsertToolExecution(
              currentState.toolExecutions,
              payload.tool_execution,
            ),
          }));
        },
        onToolFinished: (payload) => {
          set((currentState) => ({
            toolExecutions: upsertToolExecution(
              currentState.toolExecutions,
              payload.tool_execution,
            ),
          }));
        },
        onDone: async () => {
          set((currentState) => ({
            messages: finalizeStreamingAssistant(currentState.messages),
            streaming: false,
            pendingApproval: null,
            approvalResolving: false,
          }));

          await Promise.all([
            get().loadMessages(conversation.id),
            useConversationsStore.getState().loadConversations(),
          ]);
          unlisten?.();
        },
        onError: (message) => {
          set((currentState) => ({
            messages: [
              ...finalizeStreamingAssistant(currentState.messages),
              {
                id: nextMsgId(),
                role: 'assistant',
                content: `Error: ${message}`,
                timestamp: Date.now(),
              },
            ],
            streaming: false,
            pendingApproval: null,
            approvalResolving: false,
            error: message,
          }));
          unlisten?.();
        },
      });

      await runAgentTurn(
        requestId,
        conversation.id,
        currentAgent?.id ?? conversation.agent_id ?? 'default',
        providerId,
        turnMessages,
        supportedAgentTools(currentAgent?.tools),
        model,
      );
    } catch (e) {
      set((currentState) => ({
        messages: [
          ...finalizeStreamingAssistant(currentState.messages),
          {
            id: nextMsgId(),
            role: 'assistant',
            content: `Error: ${String(e)}`,
            timestamp: Date.now(),
          },
        ],
        streaming: false,
        pendingApproval: null,
        approvalResolving: false,
        error: String(e),
      }));
      unlisten?.();
    }
  },

  approvePendingTool: async () => {
    const pendingApproval = get().pendingApproval;
    if (!pendingApproval || get().approvalResolving) {
      return;
    }

    set({ approvalResolving: true, error: null });
    try {
      await respondToToolApproval({
        approvalId: pendingApproval.id,
        decision: 'approved',
      });
    } catch (e) {
      set({ approvalResolving: false, error: String(e) });
    }
  },

  denyPendingTool: async () => {
    const pendingApproval = get().pendingApproval;
    if (!pendingApproval || get().approvalResolving) {
      return;
    }

    set({ approvalResolving: true, error: null });
    try {
      await respondToToolApproval({
        approvalId: pendingApproval.id,
        decision: 'denied',
      });
    } catch (e) {
      set({ approvalResolving: false, error: String(e) });
    }
  },

  clearMessages: () => {
    set({
      messages: [],
      historyMessages: [],
      toolExecutions: [],
      pendingApproval: null,
      approvalResolving: false,
      conversation: null,
      error: null,
      streaming: false,
    });
  },

  setConversation: (conv) => {
    set({ conversation: conv });
  },
}));
