import { create } from 'zustand';
import type { Conversation } from '@/lib/tauri';
import {
  listConversations,
  deleteConversation as deleteConv,
  updateConversationTitle as updateTitle,
} from '@/lib/tauri';

interface ConversationsState {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;

  loadConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
}

export const useConversationsStore = create<ConversationsState>((set) => ({
  conversations: [],
  loading: false,
  error: null,

  loadConversations: async () => {
    set({ loading: true, error: null });
    try {
      const conversations = await listConversations();
      set({ conversations, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  deleteConversation: async (id) => {
    try {
      await deleteConv(id);
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateConversationTitle: async (id, title) => {
    try {
      await updateTitle(id, title);
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, title } : c,
        ),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
