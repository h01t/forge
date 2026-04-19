'use client';

import { Plus, Trash2, X } from 'lucide-react';
import type { Conversation } from '@/lib/tauri';
import { useAgentStore } from '@/stores/agents';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  drawer?: boolean;
  onClose?: () => void;
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

function ConversationPanel({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  onClose,
}: Omit<ConversationListProps, 'drawer'>) {
  const { agents } = useAgentStore();

  const getAgentName = (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId);
    return agent?.name ?? agentId;
  };

  return (
    <section className="shell-panel shell-panel-clip flex h-full min-h-[var(--shell-content-height)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-[1.125rem]">
        <div>
          <p className="shell-kicker text-primary-400">Workspace Threads</p>
          <h2 className="mt-2 text-[1.15rem] font-display font-semibold text-text-primary">
            Conversations
          </h2>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-text-muted">
            {conversations.length} active thread{conversations.length === 1 ? '' : 's'}
          </p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default bg-surface-secondary text-text-secondary transition-colors hover:border-primary-500/30 hover:text-text-primary"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="px-5 py-3.5">
        <button
          onClick={onNew}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary-500/35 bg-primary-500/10 px-4 py-2.5 text-sm font-medium text-primary-400 transition-all duration-200 hover:border-primary-400/50 hover:bg-primary-500/15"
        >
          <Plus size={16} />
          New Conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {conversations.length === 0 ? (
          <div className="shell-panel-muted px-5 py-6 text-sm leading-7 text-text-secondary">
            No conversations yet. Start a new thread to anchor the workspace.
          </div>
        ) : (
          <div className="space-y-2.5">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(conversation.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(conversation.id);
                  }
                }}
                className={`group relative overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
                  activeId === conversation.id
                    ? 'border-primary-500/40 bg-primary-500/10 shadow-[0_0_0_1px_rgba(0,240,255,0.08)]'
                    : 'border-border-subtle bg-surface-secondary/75 hover:border-border-highlight hover:bg-surface-hover'
                }`}
              >
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-primary-500/[0.08] to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {conversation.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                      <span>{relativeTime(conversation.updated_at)}</span>
                      {conversation.agent_id && conversation.agent_id !== 'default' ? (
                        <span className="shell-pill">{getAgentName(conversation.agent_id)}</span>
                      ) : (
                        <span className="text-[10px] tracking-[0.16em] text-text-muted">
                          General chat
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(conversation.id);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-text-muted opacity-60 transition-all duration-200 hover:border-error-500/30 hover:bg-error-500/10 hover:text-error-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ConversationList({
  drawer = false,
  onClose,
  ...props
}: ConversationListProps) {
  if (!drawer) {
    return <ConversationPanel {...props} onClose={onClose} />;
  }

  return (
    <div className="absolute inset-0 z-30 flex bg-surface-primary/45 backdrop-blur-md">
      <div className="w-full max-w-[340px] p-4">
        <ConversationPanel {...props} onClose={onClose} />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="h-full flex-1"
        aria-label="Close conversations panel"
      />
    </div>
  );
}
