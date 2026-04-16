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
        <div className="px-6 py-3 border-b border-border-default bg-surface-secondary/60 backdrop-blur-sm flex items-center gap-3">
          <span className="text-lg">&#9889;</span>
          <span className="text-sm font-display font-bold text-primary-500">{agent.name}</span>
          <span className="text-xs text-text-muted">— {agent.description}</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg p-8">
              <div className="text-4xl mb-4 animate-pulse">&#9889;</div>
              <h2 className="text-2xl font-display font-bold text-primary-500 text-glow-cyan mb-3">
                Ready to Chat
              </h2>
              <p className="text-text-secondary text-sm">
                {agent
                  ? `Chatting with ${agent.name}. Type a message below.`
                  : 'Type a message below to start a conversation.'}
                {!activeProvider && (
                  <span className="block mt-2 text-warning-500">
                    Configure a provider in Settings first.
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} agentName={agent?.name} />
          ))
        )}
        {streaming && !messages.some((m) => m.streaming) && <StreamingIndicator />}
      </div>
      <ChatInput />
    </div>
  );
}
