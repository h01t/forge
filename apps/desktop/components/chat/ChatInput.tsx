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
  const { activeProvider, providers } = useSettingsStore();
  const { currentAgent } = useAgentStore();

  const agentPref = currentAgent?.llmPreference as ProviderId | undefined;
  const defaultProvider = (agentPref && providers[agentPref]?.credential)
    ? agentPref
    : activeProvider;

  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const resolvedProvider = selectedProvider ?? defaultProvider;

  useEffect(() => {
    if (!selectedProvider && defaultProvider) {
      setSelectedProvider(defaultProvider);
    }
  }, [defaultProvider, selectedProvider]);

  const hasProvider = resolvedProvider && providers[resolvedProvider]?.credential !== null;
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
    <div className="p-4 border-t border-border-default bg-surface-secondary/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Provider</span>
          <div className="flex gap-1">
            {PROVIDERS.map((p) => {
              const configured = providers[p.id]?.credential !== null;
              const isSelected = resolvedProvider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  disabled={!configured}
                  className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                    isSelected
                      ? 'bg-primary-500/30 text-primary-500 border border-primary-500/60'
                      : configured
                        ? 'text-text-muted hover:text-text-secondary border border-transparent hover:border-border-default'
                        : 'text-text-muted/40 border border-transparent cursor-not-allowed'
                  }`}
                  title={configured ? `${p.name} (${p.defaultModel})` : `${p.name} — not configured`}
                >
                  {p.name}
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
            className="w-full cyber-input rounded-lg resize-none pr-24 disabled:opacity-40"
            rows={3}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={streaming || !input.trim() || !hasProvider}
              className="px-4 py-2 cyber-button text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {streaming ? 'STREAMING...' : 'SEND'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
