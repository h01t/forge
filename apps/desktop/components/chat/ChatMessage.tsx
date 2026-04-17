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
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[68%] min-w-0 ${isUser ? 'message-user' : 'message-assistant'}`}>
        <div className="mb-2 flex items-center gap-2 px-1">
          <span
            className={`text-[10px] font-display font-semibold uppercase tracking-[0.17em] ${
              isUser ? 'text-secondary-400' : 'text-primary-400'
            }`}
          >
            {displayName}
          </span>
        </div>
        <div className="msg-bubble px-4.5 py-3.5">
          <div
            className={`whitespace-pre-wrap break-words text-[14.5px] leading-7 text-text-primary ${
              message.streaming ? 'typing-cursor' : ''
            }`}
          >
            {message.content || (message.streaming ? '' : '(empty)')}
          </div>
        </div>
      </div>
    </div>
  );
}
