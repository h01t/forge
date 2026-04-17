'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/chat';
import { useSettingsStore } from '@/stores/settings';
import { useAgentStore } from '@/stores/agents';
import { PROVIDERS, type ProviderId } from '@/lib/tauri';

export default function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, streaming } = useChatStore();
  const {
    activeProvider,
    providers,
    getFirstUsableProvider,
    isProviderConfigured,
    isProviderUsable,
  } = useSettingsStore();
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
  const model = resolvedProvider
    ? providers[resolvedProvider]?.credential?.model ??
      PROVIDERS.find((p) => p.id === resolvedProvider)?.defaultModel
    : undefined;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="shrink-0 border-t border-border-default bg-surface-secondary/80 backdrop-blur-sm px-4 py-3">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] text-text-muted uppercase tracking-widest font-display">Model</span>
          <div className="flex gap-1 flex-wrap">
            {PROVIDERS.map((p) => {
              const configured = isProviderConfigured(p.id);
              const selectable = p.status === 'available' && configured;
              const isSelected = resolvedProvider === p.id;
              const title = p.status === 'planned'
                ? `${p.name} — planned integration`
                : configured
                  ? `${p.name} (${p.defaultModel})`
                  : `${p.name} — configure credentials in Settings`;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (selectable) {
                      setSelectedProvider(p.id);
                    }
                  }}
                  disabled={!selectable}
                  className={`px-2.5 py-0.5 text-xs rounded-sm transition-all font-display ${
                    isSelected
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
                      : selectable
                        ? 'text-text-tertiary hover:text-text-secondary border border-transparent hover:border-border-default'
                        : p.status === 'planned'
                          ? 'text-warning-500/70 border border-warning-500/20 cursor-not-allowed'
                          : 'text-text-muted/30 border border-transparent cursor-not-allowed'
                  }`}
                  title={title}
                >
                  <span>{p.name}</span>
                  {p.status === 'planned' && <span className="ml-1 text-[9px]">PLANNED</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !hasProvider
                ? 'Configure a provider in Settings first...'
                : 'Type your message...'
            }
            disabled={!hasProvider}
            className="w-full cyber-input rounded-lg resize-none pr-28 disabled:opacity-40 text-sm"
            rows={2}
          />
          <div className="absolute bottom-2.5 right-2.5">
            <button
              onClick={handleSubmit}
              disabled={streaming || !input.trim() || !hasProvider}
              className="px-4 py-1.5 cyber-button text-xs rounded disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {streaming ? 'SENDING...' : 'SEND'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
