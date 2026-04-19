'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useChatStore } from '@/stores/chat';
import { useProjectAccessStore } from '@/stores/project-access';
import { useSettingsStore } from '@/stores/settings';
import { useAgentStore } from '@/stores/agents';
import { PROVIDERS, type ProviderId } from '@/lib/tauri';

const TOOL_ENABLED_IDS = new Set(['read-file', 'search-files']);

export default function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { conversation, sendMessage, streaming } = useChatStore();
  const {
    activeProvider,
    providers,
    getFirstUsableProvider,
    isProviderConfigured,
    isProviderUsable,
  } = useSettingsStore();
  const { starterProjectId, getGrantById } = useProjectAccessStore();
  const { currentAgent } = useAgentStore();

  const agentPref = currentAgent?.llmPreference as ProviderId | undefined;
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const selectedUsableProvider =
    selectedProvider && isProviderUsable(selectedProvider) ? selectedProvider : null;
  const agentPreferredProvider =
    agentPref && isProviderUsable(agentPref) ? agentPref : null;
  const fallbackProvider =
    (activeProvider && isProviderUsable(activeProvider) ? activeProvider : null) ??
    getFirstUsableProvider();
  const resolvedProvider = selectedUsableProvider ?? agentPreferredProvider ?? fallbackProvider;
  const hasProvider = resolvedProvider !== null;
  const resolvedProviderMeta = resolvedProvider
    ? PROVIDERS.find((provider) => provider.id === resolvedProvider) ?? null
    : null;
  const model = resolvedProvider
    ? providers[resolvedProvider]?.credential?.model ??
      resolvedProviderMeta?.defaultModel
    : undefined;
  const activeRouteTitle = resolvedProvider
    ? `${resolvedProviderMeta?.name ?? 'Provider'} — ${model ?? 'No model configured'}`
    : 'Configure a usable provider in Settings to send messages.';
  const projectGrant = getGrantById(
    conversation?.project_access_id ?? starterProjectId,
  );
  const toolReady =
    Boolean(projectGrant) &&
    (currentAgent?.tools ?? []).some((tool) => TOOL_ENABLED_IDS.has(tool.id));
  const toolMessage = toolReady
    ? `Read-only file tools are available inside ${projectGrant?.displayName ?? 'the selected project'}.`
    : (currentAgent?.tools ?? []).some((tool) => TOOL_ENABLED_IDS.has(tool.id))
      ? 'Open a project to enable read-only file tools for this specialist.'
      : 'This routing surface is chat-only for the current specialist.';

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 188)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || !resolvedProvider || !hasProvider || streaming) return;
    sendMessage(trimmed, resolvedProvider, model);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary-400">
            <Sparkles size={14} />
            <span className="shell-kicker">Routing</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((provider) => {
              const configured = isProviderConfigured(provider.id);
              const selectable = provider.status === 'available' && configured;
              const selected = resolvedProvider === provider.id;
              const title = provider.status === 'planned'
                ? `${provider.name} — planned integration`
                : configured
                  ? `${provider.name} (${provider.defaultModel})`
                  : `${provider.name} — configure credentials in Settings`;

              return (
                <button
                  key={provider.id}
                  type="button"
                  title={title}
                  disabled={!selectable}
                  onClick={() => {
                    if (selectable) {
                      setSelectedProvider(provider.id);
                    }
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                    selected
                      ? 'border-primary-500/45 bg-primary-500/12 text-primary-300 shadow-[0_0_0_1px_rgba(0,240,255,0.08)]'
                      : selectable
                        ? 'border-border-highlight bg-surface-secondary text-text-secondary hover:border-primary-500/30 hover:text-text-primary'
                        : provider.status === 'planned'
                          ? 'border-warning-500/30 bg-warning-500/8 text-warning-500/80'
                          : 'border-border-subtle bg-surface-secondary text-text-muted/60'
                  }`}
                >
                  <span>{provider.name}</span>
                  {provider.status === 'planned' && <span className="ml-1">Planned</span>}
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-6 text-text-muted">{toolMessage}</p>
        </div>

        <div
          title={activeRouteTitle}
          className="shell-panel-muted flex min-h-[96px] w-full flex-col items-center justify-center px-4 py-4 text-center lg:ml-auto lg:max-w-[220px]"
        >
          <div className="flex items-center justify-center gap-2 text-accent-500">
            <CheckCircle2 size={14} />
            <span className="shell-kicker text-accent-500">Active Route</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-text-primary">
            {resolvedProvider ? resolvedProviderMeta?.name : 'No provider'}
          </p>
          <p
            title={resolvedProvider ? model : undefined}
            className="mt-1 max-w-full truncate text-[10px] leading-5 text-text-secondary"
          >
            {resolvedProvider ? model : 'Configure a usable provider in Settings to send messages.'}
          </p>
        </div>
      </div>

      <div className="shell-panel-muted px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !hasProvider
                  ? 'Configure a provider in Settings first…'
                  : 'Outline the task, question, or decision you want to work through…'
              }
              disabled={!hasProvider}
              className="cyber-input min-h-[108px] w-full resize-none rounded-[20px] text-[15px] disabled:opacity-50"
              rows={4}
            />
            <p className="mt-3 text-xs leading-6 text-text-muted">
              Press <span className="text-text-secondary">Enter</span> to send, or{' '}
              <span className="text-text-secondary">Shift + Enter</span> for a new line.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={streaming || !input.trim() || !hasProvider}
            className="cyber-button inline-flex h-[3.2rem] min-w-[160px] items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {streaming ? 'Sending…' : 'Send Message'}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
