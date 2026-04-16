import { create } from 'zustand';
import { getAgentsData } from '@pantheon-forge/agent-registry';
import type { Agent, ProviderId } from '@pantheon-forge/agent-types';

interface AgentState {
  agents: Agent[];
  currentAgent: Agent | null;

  init: () => void;
  setAgent: (agentId: string) => void;
  clearAgent: () => void;
  getProviderForAgent: (agent: Agent | null, fallback: ProviderId | null) => ProviderId | null;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  currentAgent: null,

  init: () => {
    const agents = getAgentsData();
    set({ agents });
  },

  setAgent: (agentId: string) => {
    const agent = get().agents.find((a) => a.id === agentId) ?? null;
    set({ currentAgent: agent });
  },

  clearAgent: () => {
    set({ currentAgent: null });
  },

  getProviderForAgent: (agent: Agent | null, fallback: ProviderId | null) => {
    if (agent?.llmPreference) {
      return agent.llmPreference as ProviderId;
    }
    return fallback;
  },
}));
