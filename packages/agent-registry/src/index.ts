import { parseDocument } from 'yaml';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { Agent, AgentCapability, Tool, CollaborationRule } from '@pantheon-forge/agent-types';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  capabilities: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  tools: Array<{
    id: string;
    name: string;
    description: string;
    risk_level: string;
  }>;
  llm_preference?: string;
  collaboration_rules?: Array<{
    type: string;
    target_agent_id: string;
    conditions?: string;
  }>;
}

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private agentDir: string;

  constructor(agentDir: string = join(__dirname, '../agents')) {
    this.agentDir = agentDir;
  }

  /**
   * Load all agents from the agents directory
   */
  async loadAll(): Promise<Agent[]> {
    const agents: Agent[] = [];

    try {
      const entries = readdirSync(this.agentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const agent = await this.loadAgent(entry.name);
          if (agent) {
            agents.push(agent);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }

    return agents;
  }

  /**
   * Load a single agent by ID
   */
  async loadAgent(agentId: string): Promise<Agent | null> {
    const agentPath = join(this.agentDir, agentId, 'agent.yaml');

    try {
      const yamlContent = readFileSync(agentPath, 'utf-8');
      const doc = parseDocument(yamlContent);
      const definition = doc.toJS() as AgentDefinition;

      const agent = this.convertToAgent(definition);
      this.agents.set(agentId, agent);

      return agent;
    } catch (error) {
      console.error(`Failed to load agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all loaded agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if an agent exists
   */
  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get agents that can collaborate with a given agent
   */
  getCollaborators(agentId: string): Agent[] {
    const agent = this.getAgent(agentId);
    if (!agent?.collaborationRules) {
      return [];
    }

    const collaboratorIds = new Set(
      agent.collaborationRules
        .map((rule) => rule.targetAgentId)
        .filter((id): id is string => !!id)
    );

    return Array.from(this.agents.values()).filter((a) => collaboratorIds.has(a.id));
  }

  /**
   * Convert YAML definition to Agent type
   */
  private convertToAgent(def: AgentDefinition): Agent {
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      systemPrompt: def.system_prompt,
      capabilities: def.capabilities.map((cap) => ({
        id: cap.id,
        name: cap.name,
        description: cap.description,
      })),
      tools: def.tools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        riskLevel: tool.risk_level as 'low' | 'medium' | 'high' | 'critical',
        parameters: {},
      })),
      llmPreference: def.llm_preference as any,
      collaborationRules: def.collaboration_rules?.map((rule) => ({
        type: rule.type as any,
        targetAgentId: rule.target_agent_id,
        conditions: rule.conditions,
      })),
    };
  }
}

// Singleton instance
let registryInstance: AgentRegistry | null = null;

export function getAgentRegistry(agentDir?: string): AgentRegistry {
  if (!registryInstance) {
    registryInstance = new AgentRegistry(agentDir);
  }
  return registryInstance;
}
