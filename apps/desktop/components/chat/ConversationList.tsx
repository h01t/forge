'use client';

import type { Conversation } from '@/lib/tauri';
import Link from 'next/link';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
}: ConversationListProps) {
  return (
    <aside className="w-72 bg-surface-secondary border-r border-border-default flex flex-col">
      <div className="p-4 border-b border-border-default">
        <h2 className="text-lg font-display font-bold text-primary-500 text-glow-cyan tracking-wider">
          PANTHEON FORGE
        </h2>
      </div>

      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full cyber-button text-sm py-2"
        >
          + NEW CHAT
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {conversations.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">
            No conversations yet
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full p-3 rounded-lg text-left transition-all duration-200 group ${
                activeId === conv.id
                  ? 'bg-surface-elevated border border-primary-500/40'
                  : 'hover:bg-surface-hover border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-primary truncate flex-1">
                  {conv.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="text-text-muted hover:text-error-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs ml-2"
                >
                  x
                </button>
              </div>
              <div className="text-xs text-text-tertiary mt-1">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border-default space-y-2">
        <Link
          href="/settings/"
          className="block w-full py-2 px-4 text-center cyber-button text-sm rounded-lg"
        >
          SETTINGS
        </Link>
        <Link
          href="/"
          className="block w-full py-2 px-4 text-center text-sm text-text-tertiary hover:text-text-primary transition-colors"
        >
          HOME
        </Link>
      </div>
    </aside>
  );
}
