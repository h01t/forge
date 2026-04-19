'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useChatStore } from '@/stores/chat';
import type { ProviderId } from '@/lib/tauri';

interface ChatInputProps {
  approvalPrompt?: ReactNode;
  locked?: boolean;
  providerId: ProviderId | null;
  model?: string;
}

export default function ChatInput({
  approvalPrompt,
  locked = false,
  providerId,
  model,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, streaming } = useChatStore();
  const hasProvider = providerId !== null;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 188)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || !providerId || !hasProvider || streaming || locked) return;
    sendMessage(trimmed, providerId, model);
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
      {approvalPrompt}

      <div className="shell-panel-muted px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                locked
                  ? 'Resolve the approval request above to continue…'
                  : !hasProvider
                  ? 'Configure a provider in the utility bar above before sending a message…'
                  : 'Outline the task, question, or decision you want to work through…'
              }
              disabled={!hasProvider || locked}
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
            disabled={streaming || locked || !input.trim() || !hasProvider}
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
