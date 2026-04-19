'use client';

import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ToolApprovalRequest } from '@/lib/tauri';

interface ApprovalBannerProps {
  request: ToolApprovalRequest | null;
  resolving: boolean;
  agentName?: string;
  onApprove: () => Promise<void>;
  onDeny: () => Promise<void>;
}

const riskToneClasses: Record<string, string> = {
  low: 'risk-low',
  medium: 'risk-medium',
  high: 'risk-high',
  critical: 'risk-critical',
};

export default function ApprovalBanner({
  request,
  resolving,
  agentName,
  onApprove,
  onDeny,
}: ApprovalBannerProps) {
  if (!request) {
    return null;
  }

  const riskClass = riskToneClasses[request.riskLevel] ?? 'risk-medium';

  return (
    <div
      className={`approval-dialog ${riskClass} shell-panel-muted overflow-hidden px-4 py-4 md:px-5 md:py-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="shell-icon-chip mt-0.5">
            <ShieldAlert size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="shell-kicker text-primary-400">Approval Required</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h3 className="text-[1.15rem] font-display font-semibold text-text-primary">
                {request.toolName}
              </h3>
              <span className="shell-pill border-warning-500/25 bg-warning-500/10 text-warning-500">
                {request.riskLevel} risk
              </span>
              <span className="shell-pill border-primary-500/20 bg-primary-500/8 text-primary-300">
                {agentName ?? request.agentId}
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              {request.description ??
                'The active agent wants to run a tool and needs approval before continuing the turn.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onDeny()}
            disabled={resolving}
            className="inline-flex items-center gap-2 rounded-2xl border border-error-500/35 bg-error-500/8 px-4 py-2.5 text-sm text-error-500 transition-all duration-200 hover:border-error-500/50 hover:bg-error-500/12 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <AlertTriangle size={14} />
            Deny
          </button>
          <button
            type="button"
            onClick={() => void onApprove()}
            disabled={resolving}
            className="cyber-button inline-flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 size={14} />
            {resolving ? 'Responding…' : 'Approve'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-subtle bg-surface-primary/65 px-4 py-3">
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
        </div>

        <div className="min-w-0">
          <p className="shell-kicker text-text-muted">Parameters</p>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border-subtle bg-surface-primary/65 px-4 py-3 text-[12px] leading-6 text-text-secondary">
            {JSON.stringify(request.parameters, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
