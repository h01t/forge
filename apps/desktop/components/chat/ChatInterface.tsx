'use client';

import { useChatStore } from '@/stores/chat';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import StreamingIndicator from './StreamingIndicator';
import { useSettingsStore } from '@/stores/settings';

export default function ChatInterface() {
  const { messages, streaming } = useChatStore();
  const { activeProvider } = useSettingsStore();

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg p-8">
              <div className="text-4xl mb-4 animate-pulse">&#9889;</div>
              <h2 className="text-2xl font-display font-bold text-primary-500 text-glow-cyan mb-3">
                Ready to Chat
              </h2>
              <p className="text-text-secondary text-sm">
                Type a message below to start a conversation.
                {!activeProvider && (
                  <span className="block mt-2 text-warning-500">
                    Configure a provider in Settings first.
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        {streaming && !messages.some((m) => m.streaming) && <StreamingIndicator />}
      </div>
      <ChatInput />
    </div>
  );
}
