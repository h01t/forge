'use client';

import { useMemo } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import ConversationProjectAccessCard from '@/components/projects/ConversationProjectAccessCard';
import { useChatStore } from '@/stores/chat';
import { useProjectAccessStore } from '@/stores/project-access';
import { useSettingsStore } from '@/stores/settings';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import StreamingIndicator from './StreamingIndicator';
import ToolActivity from './ToolActivity';
import ApprovalDialog from './ApprovalDialog';
import type { Agent } from '@pantheon-forge/agent-types';

const TOOL_ENABLED_IDS = new Set(['read-file', 'search-files']);

interface ChatInterfaceProps {
  agent: Agent | null;
}

export default function ChatInterface({ agent }: ChatInterfaceProps) {
  const {
    messages,
    toolExecutions,
    pendingApproval,
    approvalResolving,
    streaming,
    conversation,
    approvePendingTool,
    denyPendingTool,
  } = useChatStore();
  const { activeProvider, getFirstUsableProvider, isProviderUsable } = useSettingsStore();
  const { starterProjectId, getGrantById } = useProjectAccessStore();
  const hasUsableProvider =
    isProviderUsable(activeProvider) || getFirstUsableProvider() !== null;
  const agentHasSupportedTools =
    (agent?.tools ?? []).some((tool) => TOOL_ENABLED_IDS.has(tool.id));
  const projectGrant = getGrantById(
    conversation?.project_access_id ?? starterProjectId,
  );
  const toolsReady = Boolean(projectGrant && agentHasSupportedTools);
  const workspaceStateMessage = !hasUsableProvider
    ? 'No usable provider is configured yet. Open Settings from the rail to connect a gateway.'
    : agentHasSupportedTools && !projectGrant
      ? 'A provider is ready. Open a project to unlock read-only file tools for this specialist.'
      : toolsReady
        ? `Provider routing and read-only tools are ready inside ${projectGrant?.displayName ?? 'the selected project'}.`
        : 'At least one provider is ready. Use the composer below to route the message intentionally.';
  const timeline = useMemo(() => {
    const messageItems = messages.map((message) => ({
      id: message.id,
      timestamp: message.timestamp,
      kind: 'message' as const,
      message,
    }));
    const toolItems = toolExecutions.map((execution) => ({
      id: execution.id,
      timestamp: execution.timestamp,
      kind: 'tool' as const,
      execution,
    }));

    return [...messageItems, ...toolItems].sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }

      return left.kind === 'message' ? -1 : 1;
    });
  }, [messages, toolExecutions]);

  return (
    <section className="shell-panel shell-panel-clip flex min-h-[var(--shell-content-height)] flex-col">
      <div className="border-b border-border-subtle px-6 py-5">
        <div className="mx-auto grid w-full max-w-[880px] gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary-400">
              <Bot size={15} />
              <span className="shell-kicker text-primary-400">Active Specialist</span>
            </div>
            <div>
              <h2 className="text-[1.95rem] font-display font-semibold text-text-primary">
                {agent ? agent.name : 'Select an agent'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary">
                {agent
                  ? agent.description
                  : 'Choose an agent from the launchpad, then start the conversation from this shared workspace.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="shell-panel-muted px-5 py-4">
              <div className="flex items-center gap-2 text-primary-400">
                <Sparkles size={15} />
                <span className="shell-kicker text-primary-400">Workspace State</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                {workspaceStateMessage}
              </p>
            </div>

            <ConversationProjectAccessCard supportsTools={agentHasSupportedTools} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
          {timeline.length === 0 ? (
            <div className="shell-panel-muted flex min-h-[300px] items-center justify-center px-8 py-9 text-center">
              <div className="max-w-xl space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-primary-500/20 bg-primary-500/8 text-primary-400">
                  <Bot size={22} />
                </div>
                <h3 className="text-[1.95rem] font-display font-semibold text-text-primary">
                  Ready to work
                </h3>
                <p className="text-sm leading-8 text-text-secondary">
                  {agent
                    ? `Chatting with ${agent.name}. Use the composer below to frame the task, decision, or problem you want to work through.`
                    : 'Select an agent from the launchpad first, then return here to start the thread.'}
                </p>
                {!hasUsableProvider ? (
                  <p className="text-sm leading-7 text-warning-500">
                    Configure a provider in Settings before sending the first message.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            timeline.map((item) =>
              item.kind === 'message' ? (
                <ChatMessage key={item.id} message={item.message} agentName={agent?.name} />
              ) : (
                <ToolActivity
                  key={item.id}
                  execution={item.execution}
                  agentName={agent?.name}
                />
              ),
            )
          )}

          {streaming && !messages.some((message) => message.streaming) ? (
            <StreamingIndicator agentName={agent?.name} />
          ) : null}
        </div>
      </div>

      <div className="border-t border-border-subtle bg-surface-secondary/70 px-6 py-[1.125rem]">
        <div className="mx-auto w-full max-w-[880px]">
          <ChatInput />
        </div>
      </div>

      <ApprovalDialog
        request={pendingApproval}
        resolving={approvalResolving}
        onApprove={approvePendingTool}
        onDeny={denyPendingTool}
      />
    </section>
  );
}
