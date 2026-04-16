import { create } from 'zustand';
import type { Message, ProviderId, Conversation } from '@/lib/tauri';
import {
  streamChatCompletion,
  createConversation,
  addMessage,
  getMessages as fetchMessages,
} from '@/lib/tauri';
import { listenStream, generateRequestId, type UnlistenFn } from '@/lib/streaming';
import { useAgentStore } from './agents';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
}

interface ChatState {
  messages: DisplayMessage[];
  conversation: Conversation | null;
  streaming: boolean;
  error: string | null;

  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    content: string,
    providerId: ProviderId,
    model?: string,
  ) => Promise<void>;
  clearMessages: () => void;
  setConversation: (conv: Conversation | null) => void;
}

let msgCounter = 0;
function nextMsgId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversation: null,
  streaming: false,
  error: null,

  loadMessages: async (conversationId) => {
    try {
      const stored = await fetchMessages(conversationId);
      const messages: DisplayMessage[] = stored.map((m) => ({
        id: m.id,
        role: m.role as DisplayMessage['role'],
        content: m.content,
      }));
      set({ messages, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  sendMessage: async (content, providerId, model) => {
    const state = get();
    if (state.streaming) return;

    const currentAgent = useAgentStore.getState().currentAgent;

    const userMsg: DisplayMessage = {
      id: nextMsgId(),
      role: 'user',
      content,
    };

    const assistantMsg: DisplayMessage = {
      id: nextMsgId(),
      role: 'assistant',
      content: '',
      streaming: true,
    };

    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      streaming: true,
      error: null,
    }));

    let conversation = state.conversation;
    if (!conversation) {
      const agentId = currentAgent?.id ?? 'default';
      const title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
      try {
        conversation = await createConversation(agentId, title);
        set({ conversation });
      } catch (e) {
        set({ error: String(e), streaming: false });
        return;
      }
    }

    try {
      await addMessage(conversation.id, { role: 'user', content });
    } catch {
    }

    const historyMessages: Message[] = get()
      .messages.filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }));

    const allMessages: Message[] = [];
    if (currentAgent?.systemPrompt) {
      allMessages.push({ role: 'system', content: currentAgent.systemPrompt });
    }
    allMessages.push(...historyMessages);

    const effectiveProvider = currentAgent?.llmPreference
      ? (currentAgent.llmPreference as ProviderId)
      : providerId;

    const requestId = generateRequestId();
    let unlisten: UnlistenFn | undefined;

    try {
      unlisten = await listenStream(requestId, {
        onContent: (delta) => {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + delta }
                : m,
            ),
          }));
        },
        onDone: async () => {
          const finalContent = get().messages.find(
            (m) => m.id === assistantMsg.id,
          )?.content;

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id ? { ...m, streaming: false } : m,
            ),
            streaming: false,
          }));

          if (finalContent && conversation) {
            try {
              await addMessage(conversation.id, {
                role: 'assistant',
                content: finalContent,
              });
            } catch {
            }
          }

          unlisten?.();
        },
        onError: (message) => {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: `Error: ${message}`, streaming: false }
                : m,
            ),
            streaming: false,
            error: message,
          }));
          unlisten?.();
        },
      });

      await streamChatCompletion(
        requestId,
        effectiveProvider,
        allMessages,
        model,
      );
    } catch (e) {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `Error: ${String(e)}`, streaming: false }
            : m,
        ),
        streaming: false,
        error: String(e),
      }));
      unlisten?.();
    }
  },

  clearMessages: () => {
    set({ messages: [], conversation: null, error: null });
  },

  setConversation: (conv) => {
    set({ conversation: conv });
  },
}));
