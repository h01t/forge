'use client';

import { FolderOpen, ShieldCheck } from 'lucide-react';

interface ProjectPermissionDialogProps {
  path: string | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export default function ProjectPermissionDialog({
  path,
  saving,
  onCancel,
  onConfirm,
}: ProjectPermissionDialogProps) {
  if (!path) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-primary/60 px-4 backdrop-blur-md">
      <div className="approval-dialog relative w-full max-w-[620px] overflow-hidden rounded-[22px] px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-44 bg-[radial-gradient(circle_at_left,rgba(0,245,255,0.12),transparent_68%)]" />
        <div className="flex items-start gap-4">
          <div className="shell-icon-chip mt-1">
            <FolderOpen size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="shell-kicker text-primary-400">Project Access</p>
            <h3 className="mt-2 text-[1.55rem] font-display font-semibold text-text-primary">
              Grant read-only access
            </h3>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              Pantheon Forge will remember this directory as a project the agent can inspect with
              read-only tools. Tool calls inside the project will still require approval one by
              one.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="shell-panel-muted px-4 py-4">
            <p className="shell-kicker text-text-muted">Selected Directory</p>
            <p className="mt-3 break-all text-sm leading-7 text-text-primary">{path}</p>
          </div>

          <div className="shell-panel-muted px-4 py-4">
            <div className="flex items-center gap-2 text-accent-500">
              <ShieldCheck size={15} />
              <span className="shell-kicker text-accent-500">Permission</span>
            </div>
            <p className="mt-3 text-sm font-medium text-text-primary">Read-only</p>
            <p className="mt-2 text-xs leading-6 text-text-secondary">
              File inspection only in this version.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-2xl border border-border-highlight bg-surface-secondary px-5 py-3 text-sm text-text-secondary transition-all duration-200 hover:border-primary-500/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={saving}
            className="cyber-button text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Granting…' : 'Grant Read-only Access'}
          </button>
        </div>
      </div>
    </div>
  );
}
