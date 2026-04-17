'use client';

import { useChatStore } from '@/stores/chat';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import StreamingIndicator from './StreamingIndicator';
import { useSettingsStore } from '@/stores/settings';
import type { Agent } from '@pantheon-forge/agent-types';

interface ChatInterfaceProps {
  agent: Agent | null;
}

export default function ChatInterface({ agent }: ChatInterfaceProps) {
  const { messages, streaming } = useChatStore();
  const { activeProvider } = useSettingsStore();

  return (
    <div className="flex flex-col h-full w-full">
      {agent && (
        <div className="px-4 py-2 border-b border-border-default bg-surface-secondary/80 backdrop-blur-sm flex items-center gap-2 shrink-0">
          <span className="text-base">&#9889;</span>
          <span className="text-xs font-display font-bold text-primary-500 tracking-wider">{agent.name.toUpperCase()}</span>
          <span className="text-[11px] text-text-muted truncate">— {agent.description}</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md p-8">
              <div className="text-5xl mb-4 opacity-60">&#9889;</div>
              <h2 className="text-xl font-display font-bold text-primary-500 text-glow-cyan mb-2">
                Ready to Chat
              </h2>
              <p className="text-text-secondary text-sm">
                {agent
                  ? `Chatting with ${agent.name}. Type a message below.`
                  : 'Select an agent from the home page, then type a message.'}
                {!activeProvider && (
                  <span className="block mt-2 text-warning-500 text-xs">
                    Configure a provider in Settings first.
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} agentName={agent?.name} />
            ))}
          </div>
        )}
        {streaming && !messages.some((m) => m.streaming) && (
          <div className="max-w-4xl mx-auto">
            <StreamingIndicator agentName={agent?.name} />
          </div>
        )}
      </div>
      <ChatInput />
    </div>
  );
}
