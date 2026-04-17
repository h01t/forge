'use client';

import type { DisplayMessage } from '@/stores/chat';

interface ChatMessageProps {
  message: DisplayMessage;
  agentName?: string;
}

export default function ChatMessage({ message, agentName }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const displayName = isUser ? 'You' : (agentName ?? 'Assistant');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`${isUser ? 'message-user' : 'message-assistant'} max-w-[75%]`}>
        <div className="msg-bubble px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-xs font-display font-semibold tracking-wider ${isUser ? 'text-secondary-400' : 'text-primary-500'}`}>
              {displayName.toUpperCase()}
            </span>
          </div>
          <div className={`text-sm text-text-primary whitespace-pre-wrap leading-relaxed ${message.streaming ? 'typing-cursor' : ''}`}>
            {message.content || (message.streaming ? '' : '(empty)')}
          </div>
        </div>
      </div>
    </div>
  );
}
