'use client';

import { FolderTree } from 'lucide-react';
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
    <div className="shell-panel-muted px-4 py-3.5">
      <div className="flex items-center gap-2 text-primary-400">
        <FolderTree size={14} />
        <span className="shell-kicker text-primary-400">Project Access</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <select
          value={selectedProjectId ?? ''}
          onChange={(event) => void handleSelectProject(event.target.value || null)}
          className="cyber-input h-11 min-w-[220px] flex-1 rounded-[16px] px-4 text-sm"
          title={selectedGrant?.path}
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
          label={conversation ? 'Open And Attach' : 'Open Project'}
          onGranted={async (grant) => {
            await handleSelectProject(grant.id);
          }}
          className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-border-highlight bg-surface-secondary px-4 text-sm text-text-primary transition-all duration-200 hover:border-primary-500/30 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs leading-6">
        <span className="shell-pill border-accent-500/20 bg-accent-500/8 text-accent-500">
          {selectedGrant
            ? selectedGrant.permissionLevel === 'read'
              ? 'Project scope'
              : selectedGrant.permissionLevel
            : 'No grant'}
        </span>
        <p
          title={selectedGrant?.path}
          className="min-w-0 flex-1 truncate text-text-secondary"
        >
          {selectedGrant
            ? `${selectedGrant.displayName} · ${selectedGrant.path}`
            : supportsTools
              ? 'Attach a project to expose project-scoped tools in this thread.'
              : 'Project access is optional for this specialist.'}
        </p>
      </div>
    </div>
  );
}
