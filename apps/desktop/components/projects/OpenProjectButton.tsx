'use client';

import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from 'lucide-react';
import { useIsTauriDesktop } from '@/lib/platform';
import type { ProjectAccessGrant } from '@/lib/tauri';
import { useProjectAccessStore } from '@/stores/project-access';
import ProjectPermissionDialog from './ProjectPermissionDialog';

interface OpenProjectButtonProps {
  label?: string;
  className?: string;
  disabled?: boolean;
  onGranted?: (grant: ProjectAccessGrant) => Promise<void> | void;
}

export default function OpenProjectButton({
  label = 'Open Project',
  className,
  disabled = false,
  onGranted,
}: OpenProjectButtonProps) {
  const isTauriDesktop = useIsTauriDesktop();
  const { saveGrant } = useProjectAccessStore();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = async () => {
    if (!isTauriDesktop || disabled) {
      return;
    }

    try {
      setError(null);
      const selection = await open({
        directory: true,
        multiple: false,
      });

      if (typeof selection === 'string') {
        setPendingPath(selection);
      }
    } catch (browseError) {
      setError(String(browseError));
    }
  };

  const handleConfirm = async () => {
    if (!pendingPath) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const grant = await saveGrant(pendingPath, 'read');
      await onGranted?.(grant);
      setPendingPath(null);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleBrowse()}
        disabled={!isTauriDesktop || disabled}
        className={className}
      >
        <FolderOpen size={16} />
        {label}
      </button>

      {error ? (
        <p className="text-xs leading-6 text-warning-500">{error}</p>
      ) : null}

      <ProjectPermissionDialog
        path={pendingPath}
        saving={saving}
        onCancel={() => {
          if (!saving) {
            setPendingPath(null);
          }
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
