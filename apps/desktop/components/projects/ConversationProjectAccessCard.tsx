'use client';

import { FolderTree, ShieldCheck } from 'lucide-react';
import { attachProjectAccessToConversation } from '@/lib/tauri';
import OpenProjectButton from '@/components/projects/OpenProjectButton';
import { useChatStore } from '@/stores/chat';
import { useConversationsStore } from '@/stores/conversations';
import { useProjectAccessStore } from '@/stores/project-access';

interface ConversationProjectAccessCardProps {
  supportsTools: boolean;
}

export default function ConversationProjectAccessCard({
  supportsTools,
}: ConversationProjectAccessCardProps) {
  const { conversation, setConversation } = useChatStore();
  const { loadConversations } = useConversationsStore();
  const {
    grants,
    starterProjectId,
    setStarterProjectId,
    getGrantById,
  } = useProjectAccessStore();
  const selectedProjectId = conversation?.project_access_id ?? starterProjectId ?? null;
  const selectedGrant = getGrantById(selectedProjectId);

  const handleSelectProject = async (projectAccessId: string | null) => {
    if (conversation) {
      const updatedConversation = await attachProjectAccessToConversation(
        conversation.id,
        projectAccessId,
      );
      setConversation(updatedConversation);
      await loadConversations();
      return;
    }

    await setStarterProjectId(projectAccessId);
  };

  return (
    <div className="shell-panel-muted px-5 py-4">
      <div className="flex items-center gap-2 text-primary-400">
        <FolderTree size={15} />
        <span className="shell-kicker text-primary-400">Project Access</span>
      </div>

      <p className="mt-2 text-sm leading-7 text-text-secondary">
        {conversation
          ? supportsTools
            ? 'This conversation can use read-only tools only inside its attached project.'
            : 'This conversation is attached to a project, but the current specialist does not expose read-only file tools.'
          : supportsTools
            ? 'Pick a starter project now if you want the next conversation to open with read-only tool scope already attached.'
            : 'You can still choose a starter project now, even though the current specialist does not expose read-only file tools.'}
      </p>

      <div className="mt-4 space-y-3">
        <label className="shell-kicker text-text-muted">
          {conversation ? 'Bound Project' : 'Starter Project'}
        </label>

        <select
          value={selectedProjectId ?? ''}
          onChange={(event) =>
            void handleSelectProject(event.target.value || null)
          }
          className="cyber-input h-12 w-full rounded-[18px] px-4"
        >
          <option value="">
            {conversation ? 'No project attached' : 'No starter project selected'}
          </option>
          {grants.map((grant) => (
            <option key={grant.id} value={grant.id}>
              {grant.displayName}
            </option>
          ))}
        </select>

        <OpenProjectButton
          label={conversation ? 'Open And Attach Project' : 'Open Project'}
          onGranted={async (grant) => {
            await handleSelectProject(grant.id);
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-border-highlight bg-surface-secondary px-4 py-2.5 text-sm text-text-primary transition-all duration-200 hover:border-primary-500/30 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-primary/55 px-4 py-3">
        <div className="flex items-center gap-2 text-accent-500">
          <ShieldCheck size={14} />
          <span className="shell-kicker text-accent-500">Active Grant</span>
        </div>
        {selectedGrant ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-text-primary">{selectedGrant.displayName}</p>
            <p className="break-all text-xs leading-6 text-text-secondary">{selectedGrant.path}</p>
            <p className="text-xs leading-6 text-text-muted">
              Permission: {selectedGrant.permissionLevel === 'read' ? 'Read-only' : selectedGrant.permissionLevel}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-7 text-text-secondary">
            {supportsTools
              ? 'No project is selected, so read-only tools stay hidden from the model for this thread.'
              : 'No project is selected. Regular chat remains available without tool access.'}
          </p>
        )}
      </div>
    </div>
  );
}
