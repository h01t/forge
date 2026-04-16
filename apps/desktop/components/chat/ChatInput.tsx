'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/chat';
import { useSettingsStore } from '@/stores/settings';
import { useAgentStore } from '@/stores/agents';
import { PROVIDERS } from '@/lib/tauri';

export default function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, streaming } = useChatStore();
  const { activeProvider, providers } = useSettingsStore();
  const { currentAgent } = useAgentStore();

  const resolvedProvider = currentAgent?.llmPreference
    ? (currentAgent.llmPreference as typeof activeProvider)
    : activeProvider;

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
