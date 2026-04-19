'use client';

import { FolderLock, ShieldCheck, Trash2 } from 'lucide-react';
import OpenProjectButton from '@/components/projects/OpenProjectButton';
import { useChatStore } from '@/stores/chat';
import { useConversationsStore } from '@/stores/conversations';
import { useProjectAccessStore } from '@/stores/project-access';

export default function ProjectAccessManager() {
  const { grants, starterProjectId, setStarterProjectId, revokeGrant } = useProjectAccessStore();
  const { conversation, setConversation } = useChatStore();
  const { loadConversations } = useConversationsStore();

  const handleRevoke = async (grantId: string) => {
    await revokeGrant(grantId);

    if (conversation?.project_access_id === grantId) {
      setConversation({
        ...conversation,
        project_access_id: null,
      });
    }

    await loadConversations();
  };

  return (
    <section className="shell-panel px-5 py-5 md:px-6 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-primary-400">
            <FolderLock size={15} />
            <span className="shell-kicker text-primary-400">Project Access</span>
          </div>
          <h2 className="mt-3 text-[1.55rem] font-display font-semibold text-text-primary">
            Remembered project grants
          </h2>
          <p className="mt-2 text-sm leading-7 text-text-secondary">
            Grants are local to this app and read-only in this version. Each conversation can bind
            one granted directory, and every tool call still asks for approval.
          </p>
        </div>

        <OpenProjectButton
          label="Open Project"
          onGranted={async (grant) => {
            await setStarterProjectId(grant.id);
          }}
          className="cyber-button inline-flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>

      {grants.length === 0 ? (
        <div className="shell-panel-muted mt-5 px-5 py-5 text-sm leading-7 text-text-secondary">
          No project grants yet. Open a directory to allow read-only file inspection tools inside
          that specific project.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {grants.map((grant) => {
            const isStarter = starterProjectId === grant.id;

            return (
              <div
                key={grant.id}
                className="shell-panel-muted flex flex-wrap items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{grant.displayName}</p>
                    <span className="shell-pill border-accent-500/25 bg-accent-500/10 text-accent-500">
                      {grant.permissionLevel === 'read' ? 'Read-only' : grant.permissionLevel}
                    </span>
                    {isStarter ? (
                      <span className="shell-pill border-primary-500/25 bg-primary-500/10 text-primary-400">
                        Next chat
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 break-all text-xs leading-6 text-text-secondary">
                    {grant.path}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void setStarterProjectId(isStarter ? null : grant.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-border-highlight bg-surface-secondary px-4 py-2.5 text-sm text-text-secondary transition-all duration-200 hover:border-primary-500/30 hover:text-text-primary"
                  >
                    <ShieldCheck size={14} />
                    {isStarter ? 'Clear Starter' : 'Use For Next Chat'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(grant.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-error-500/35 bg-error-500/8 px-4 py-2.5 text-sm text-error-500 transition-all duration-200 hover:border-error-500/50 hover:bg-error-500/12"
                  >
                    <Trash2 size={14} />
                    Revoke
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
