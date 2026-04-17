'use client';

import type { Conversation } from '@/lib/tauri';
import { useAgentStore } from '@/stores/agents';
import Link from 'next/link';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
}: ConversationListProps) {
  const { agents } = useAgentStore();

  const getAgentName = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name ?? agentId;
  };

  return (
    <aside className="w-72 bg-surface-secondary border-r border-border-default flex flex-col shrink-0">
      <div className="p-4 border-b border-border-default">
        <Link href="/" className="block">
          <h2 className="text-sm font-display font-bold text-primary-500 text-glow-cyan tracking-widest">
            PANTHEON FORGE
          </h2>
        </Link>
      </div>

      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNew}
          className="w-full cyber-button text-xs py-2"
        >
          + NEW CHAT
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
        {conversations.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">
            No conversations yet
          </p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(conv.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(conv.id); }}
              className={`w-full px-3 py-2.5 rounded-md text-left transition-all duration-150 group cursor-pointer ${
                activeId === conv.id
                  ? 'bg-surface-elevated border border-primary-500/30'
                  : 'hover:bg-surface-hover border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-primary truncate flex-1">
                  {conv.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="text-text-muted/40 hover:text-error-500 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] shrink-0"
                >
                  x
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-text-muted">
                  {relativeTime(conv.updated_at)}
                </span>
                {conv.agent_id && conv.agent_id !== 'default' && (
                  <span className="text-[9px] px-1.5 py-px rounded-sm bg-primary-500/15 text-primary-400 whitespace-nowrap font-display">
                    {getAgentName(conv.agent_id)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border-default space-y-1.5">
        <Link
          href="/settings/"
          className="block w-full py-1.5 px-4 text-center cyber-button text-xs rounded-md"
        >
          SETTINGS
        </Link>
        <Link
          href="/"
          className="block w-full py-1.5 px-4 text-center text-xs text-text-tertiary hover:text-text-primary transition-colors"
        >
          HOME
        </Link>
      </div>
    </aside>
  );
}
