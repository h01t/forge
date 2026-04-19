'use client';

import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ToolApprovalRequest } from '@/lib/tauri';

interface ApprovalDialogProps {
  request: ToolApprovalRequest | null;
  resolving: boolean;
  onApprove: () => Promise<void>;
  onDeny: () => Promise<void>;
}

const riskToneClasses: Record<string, string> = {
  low: 'risk-low',
  medium: 'risk-medium',
  high: 'risk-high',
  critical: 'risk-critical',
};

export default function ApprovalDialog({
  request,
  resolving,
  onApprove,
  onDeny,
}: ApprovalDialogProps) {
  if (!request) {
    return null;
  }

  const riskClass = riskToneClasses[request.riskLevel] ?? 'risk-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-primary/60 px-4 backdrop-blur-md">
      <div
        className={`approval-dialog ${riskClass} w-full max-w-[640px] rounded-[22px] px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.55)]`}
      >
        <div className="flex items-start gap-4">
          <div className="shell-icon-chip mt-1">
            <ShieldAlert size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="shell-kicker text-primary-400">Approval Required</p>
            <h3 className="mt-2 text-[1.55rem] font-display font-semibold text-text-primary">
              {request.toolName}
            </h3>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              {request.description ??
                'The active agent wants to run a tool and needs approval before continuing the turn.'}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="shell-panel-muted px-4 py-4">
            <p className="shell-kicker text-text-muted">Agent</p>
            <p className="mt-2 text-sm font-medium text-text-primary">{request.agentId}</p>
          </div>
          <div className="shell-panel-muted px-4 py-4">
            <p className="shell-kicker text-text-muted">Risk Level</p>
            <p className="mt-2 text-sm font-medium capitalize text-text-primary">
              {request.riskLevel}
            </p>
          </div>
        </div>

        {request.projectDisplayName || request.projectPath ? (
          <div className="mt-4 shell-panel-muted px-4 py-4">
            <p className="shell-kicker text-text-muted">Granted Project</p>
            <p className="mt-2 text-sm font-medium text-text-primary">
              {request.projectDisplayName ?? 'Selected project'}
            </p>
            {request.projectPath ? (
              <p className="mt-2 break-all text-xs leading-6 text-text-secondary">
                {request.projectPath}
              </p>
            ) : null}
            {request.permissionLevel ? (
              <p className="mt-2 text-xs leading-6 text-text-muted">
                Permission: {request.permissionLevel === 'read' ? 'Read-only' : request.permissionLevel}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 shell-panel-muted px-4 py-4">
          <p className="shell-kicker text-text-muted">Parameters</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-text-secondary">
            {JSON.stringify(request.parameters, null, 2)}
          </pre>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => void onDeny()}
            disabled={resolving}
            className="inline-flex items-center gap-2 rounded-2xl border border-error-500/35 bg-error-500/8 px-5 py-3 text-sm text-error-500 transition-all duration-200 hover:border-error-500/50 hover:bg-error-500/12 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <AlertTriangle size={15} />
            Deny
          </button>
          <button
            type="button"
            onClick={() => void onApprove()}
            disabled={resolving}
            className="cyber-button inline-flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 size={15} />
            {resolving ? 'Responding…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
