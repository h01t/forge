import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RailMode = 'expanded' | 'compact';

interface ShellState {
  railMode: RailMode;
  conversationPanelOpen: boolean;
  setRailMode: (mode: RailMode) => void;
  toggleRailMode: () => void;
  setConversationPanelOpen: (open: boolean) => void;
  toggleConversationPanel: () => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      railMode: 'expanded',
      conversationPanelOpen: false,

      setRailMode: (mode) => set({ railMode: mode }),

      toggleRailMode: () =>
        set((state) => ({
          railMode: state.railMode === 'expanded' ? 'compact' : 'expanded',
        })),

      setConversationPanelOpen: (open) => set({ conversationPanelOpen: open }),

      toggleConversationPanel: () =>
        set((state) => ({
          conversationPanelOpen: !state.conversationPanelOpen,
        })),
    }),
    {
      name: 'pantheon-forge-shell',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ railMode: state.railMode }),
    },
  ),
);
