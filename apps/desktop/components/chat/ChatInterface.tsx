'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, Bot, PlugZap, Sparkles } from 'lucide-react';
import type { Agent, ProviderId } from '@pantheon-forge/agent-types';
import { PROVIDERS } from '@/lib/tauri';
import ConversationProjectAccessCard from '@/components/projects/ConversationProjectAccessCard';
import { useChatStore } from '@/stores/chat';
import { useProjectAccessStore } from '@/stores/project-access';
import { useSettingsStore } from '@/stores/settings';
import ApprovalBanner from './ApprovalBanner';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import StreamingIndicator from './StreamingIndicator';
import ToolActivity from './ToolActivity';

const TOOL_ENABLED_IDS = new Set(['read-file', 'search-files']);
const TERMINAL_TOOL_STATUSES = new Set(['succeeded', 'denied', 'failed']);
const AUTO_FOLLOW_THRESHOLD_PX = 48;

interface ChatInterfaceProps {
  agent: Agent | null;
}

function UtilityModule({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="shell-panel-muted px-4 py-3.5">
      <div className="flex items-center gap-2 text-primary-400">
        {icon}
        <span className="shell-kicker text-primary-400">{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
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
  const {
    providers,
    activeProvider,
    getFirstUsableProvider,
    isProviderUsable,
  } = useSettingsStore();
  const { starterProjectId, getGrantById } = useProjectAccessStore();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);

  const hasUsableProvider =
    isProviderUsable(activeProvider) || getFirstUsableProvider() !== null;
  const agentHasSupportedTools =
    (agent?.tools ?? []).some((tool) => TOOL_ENABLED_IDS.has(tool.id));
  const enabledToolCount = (agent?.tools ?? []).filter((tool) =>
    TOOL_ENABLED_IDS.has(tool.id),
  ).length;
  const projectGrant = getGrantById(conversation?.project_access_id ?? starterProjectId);
  const toolsReady = Boolean(projectGrant && agentHasSupportedTools);
  const workspaceStateMessage = !hasUsableProvider
    ? 'No usable provider is configured yet. Open Settings from the rail to connect a gateway.'
    : agentHasSupportedTools && !projectGrant
      ? 'A provider is ready. Attach a project above to unlock read-only file tools.'
      : toolsReady
        ? `Provider routing and read-only tools are ready inside ${projectGrant?.displayName ?? 'the selected project'}.`
        : 'Routing is ready. This specialist is currently operating in chat-only mode.';

  const agentPreferredProvider = useMemo(() => {
    const preferred = agent?.llmPreference as ProviderId | undefined;
    return preferred && isProviderUsable(preferred) ? preferred : null;
  }, [agent?.llmPreference, isProviderUsable]);

  const selectedUsableProvider = useMemo(
    () => (selectedProvider && isProviderUsable(selectedProvider) ? selectedProvider : null),
    [isProviderUsable, selectedProvider],
  );

  const fallbackProvider = useMemo(
    () =>
      (activeProvider && isProviderUsable(activeProvider) ? activeProvider : null) ??
      getFirstUsableProvider(),
    [activeProvider, getFirstUsableProvider, isProviderUsable],
  );

  const resolvedProvider =
    selectedUsableProvider ?? agentPreferredProvider ?? fallbackProvider;
  const usableProviders = useMemo(
    () =>
      PROVIDERS.filter(
        (provider) =>
          provider.status === 'available' && isProviderUsable(provider.id),
      ),
    [isProviderUsable],
  );
  const resolvedProviderMeta = resolvedProvider
    ? PROVIDERS.find((provider) => provider.id === resolvedProvider) ?? null
    : null;
  const model = resolvedProvider
    ? providers[resolvedProvider]?.credential?.model ??
      resolvedProviderMeta?.defaultModel
    : undefined;

  const terminalToolExecutions = useMemo(
    () =>
      toolExecutions.filter((execution) =>
        TERMINAL_TOOL_STATUSES.has(execution.status),
      ),
    [toolExecutions],
  );

  const timeline = useMemo(() => {
    const messageItems = messages.map((message) => ({
      id: message.id,
      timestamp: message.timestamp,
      kind: 'message' as const,
      message,
    }));
    const toolItems = terminalToolExecutions.map((execution) => ({
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
  }, [messages, terminalToolExecutions]);

  const activityMarker = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    const lastToolExecution = terminalToolExecutions[terminalToolExecutions.length - 1];

    return JSON.stringify({
      messageCount: messages.length,
      lastMessageId: lastMessage?.id ?? null,
      lastMessageLength: lastMessage?.content.length ?? 0,
      lastMessageStreaming: Boolean(lastMessage?.streaming),
      toolCount: terminalToolExecutions.length,
      lastToolId: lastToolExecution?.id ?? null,
      lastToolStatus: lastToolExecution?.status ?? null,
      streaming,
    });
  }, [messages, terminalToolExecutions, streaming]);

  const isNearBottom = useCallback((element: HTMLDivElement) => {
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    return distanceFromBottom <= AUTO_FOLLOW_THRESHOLD_PX;
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'auto') => {
    const element = transcriptRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });
    setAutoFollow(true);
    setShowJumpToLatest(false);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollToLatest('auto');
    });
    return () => cancelAnimationFrame(frame);
  }, [conversation?.id, scrollToLatest]);

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element) {
      return;
    }

    requestAnimationFrame(() => {
      const currentElement = transcriptRef.current;
      if (!currentElement) {
        return;
      }

      if (autoFollow || isNearBottom(currentElement)) {
        scrollToLatest('auto');
      } else {
        setShowJumpToLatest(true);
      }
    });
  }, [activityMarker, autoFollow, isNearBottom, scrollToLatest]);

  const handleTranscriptScroll = useCallback(() => {
    const element = transcriptRef.current;
    if (!element) {
      return;
    }

    const nearBottom = isNearBottom(element);
    if (nearBottom) {
      setAutoFollow(true);
      setShowJumpToLatest(false);
      return;
    }

    setAutoFollow(false);
  }, [isNearBottom]);

  return (
    <section className="shell-panel grid h-[var(--shell-content-height)] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="border-b border-border-subtle px-5 py-4 md:px-6">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
          <UtilityModule icon={<Bot size={14} />} title="Active Specialist">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-display font-semibold text-text-primary">
                    {agent ? agent.name : 'Select an agent'}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">
                    {agent
                      ? agent.description
                      : 'Choose an agent from the launchpad, then return here to start the thread.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="shell-pill border-primary-500/20 bg-primary-500/8 text-primary-300">
                  {enabledToolCount > 0
                    ? `${enabledToolCount} read-only tool${enabledToolCount === 1 ? '' : 's'}`
                    : 'Chat-only specialist'}
                </span>
                {agentPreferredProvider ? (
                  <span className="shell-pill border-border-highlight bg-surface-primary/60 text-text-secondary">
                    Prefers {PROVIDERS.find((provider) => provider.id === agentPreferredProvider)?.name ?? agentPreferredProvider}
                  </span>
                ) : null}
              </div>
            </div>
          </UtilityModule>

          <UtilityModule icon={<PlugZap size={14} />} title="Routing">
            <div className="space-y-2.5">
              <select
                value={resolvedProvider ?? ''}
                onChange={(event) =>
                  setSelectedProvider((event.target.value as ProviderId) || null)
                }
                disabled={usableProviders.length === 0}
                className="cyber-input h-11 w-full rounded-[16px] px-4 text-sm disabled:opacity-50"
              >
                {usableProviders.length === 0 ? (
                  <option value="">No usable providers configured</option>
                ) : null}
                {usableProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>

              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {resolvedProvider
                    ? resolvedProviderMeta?.name ?? resolvedProvider
                    : 'No provider selected'}
                </p>
                <p
                  title={model}
                  className="truncate text-xs leading-6 text-text-secondary"
                >
                  {resolvedProvider
                    ? model ?? 'No model configured'
                    : 'Configure a provider in Settings to start chatting.'}
                </p>
              </div>
            </div>
          </UtilityModule>

          <ConversationProjectAccessCard supportsTools={agentHasSupportedTools} />

          <UtilityModule icon={<Sparkles size={14} />} title="Workspace State">
            <div className="space-y-2.5">
              <p className="text-sm leading-6 text-text-secondary">
                {workspaceStateMessage}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="shell-pill border-border-highlight bg-surface-primary/60 text-text-secondary">
                  {hasUsableProvider ? 'Provider ready' : 'Provider needed'}
                </span>
                <span className="shell-pill border-border-highlight bg-surface-primary/60 text-text-secondary">
                  {toolsReady
                    ? 'Tools unlocked'
                    : agentHasSupportedTools
                      ? 'Project needed'
                      : 'Chat only'}
                </span>
              </div>
            </div>
          </UtilityModule>
        </div>
      </div>

      <div className="min-h-0">
        <div
          ref={transcriptRef}
          onScroll={handleTranscriptScroll}
          className="h-full overflow-y-auto px-5 py-5 md:px-6"
        >
          <div className="flex w-full flex-col gap-6">
            {timeline.length === 0 ? (
              <div className="shell-panel-muted relative flex min-h-[320px] items-center justify-center overflow-hidden px-8 py-10 text-center">
                <div className="pointer-events-none absolute inset-x-[18%] bottom-0 h-24 bg-gradient-to-t from-primary-500/10 via-primary-500/[0.03] to-transparent" />
                <div className="relative max-w-2xl space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[28px] border border-primary-500/20 bg-primary-500/8 text-primary-400 shadow-[0_0_28px_rgba(67,240,255,0.12)]">
                    <Bot size={22} />
                  </div>
                  <h3 className="text-[1.95rem] font-display font-semibold text-text-primary">
                    Ready to work
                  </h3>
                  <p className="text-sm leading-8 text-text-secondary">
                    {agent
                      ? `Chatting with ${agent.name}. Use the utility bar above to pick the route and project context, then use the composer below to frame the task, decision, or problem you want to work through.`
                      : 'Select an agent from the launchpad first, then return here to start the thread.'}
                  </p>
                  {!hasUsableProvider ? (
                    <p className="text-sm leading-7 text-warning-500">
                      Configure a usable provider in Settings before sending the first message.
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
      </div>

      <div className="shrink-0 border-t border-border-subtle bg-surface-secondary/70 px-5 py-4 md:px-6">
        {showJumpToLatest ? (
          <div className="pb-3">
            <button
              type="button"
              onClick={() => scrollToLatest('smooth')}
              className="inline-flex items-center gap-2 rounded-2xl border border-primary-500/30 bg-surface-primary/75 px-4 py-2 text-sm text-primary-300 transition-all duration-200 hover:border-primary-500/45 hover:bg-surface-hover"
            >
              <ArrowDown size={15} />
              Jump to latest
            </button>
          </div>
        ) : null}

        <ChatInput
          providerId={resolvedProvider}
          model={model}
          locked={Boolean(pendingApproval)}
          approvalPrompt={
            <ApprovalBanner
              request={pendingApproval}
              resolving={approvalResolving}
              agentName={agent?.name}
              onApprove={approvePendingTool}
              onDeny={denyPendingTool}
            />
          }
        />
      </div>
    </section>
  );
}
