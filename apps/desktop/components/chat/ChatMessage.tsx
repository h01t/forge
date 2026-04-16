'use client';

import type { DisplayMessage } from '@/stores/chat';

interface ChatMessageProps {
  message: DisplayMessage;
  agentName?: string;
}

export default function ChatMessage({ message, agentName }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`${isUser ? 'message-user' : 'message-assistant'} p-4 max-w-3xl`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-display text-primary-500">
          {isUser ? 'YOU' : (agentName ?? 'ASSISTANT').toUpperCase()}
        </span>
      </div>
      <div className={`text-text-secondary whitespace-pre-wrap ${message.streaming ? 'typing-cursor' : ''}`}>
        {message.content || (message.streaming ? '' : '(empty)')}
      </div>
    </div>
  );
}
