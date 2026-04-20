'use client';

import {
  CheckCircle2,
  CircleDashed,
  LoaderCircle,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { ToolExecutionLog } from '@/lib/tauri';

interface ToolActivityProps {
  execution: ToolExecutionLog;
  agentName?: string;
}

const statusMeta: Record<
  ToolExecutionLog['status'],
  { icon: typeof CircleDashed; label: string; tone: string }
> = {
  pending: {
    icon: CircleDashed,
    label: 'Awaiting approval',
    tone: 'text-warning-500',
  },
  approved: {
    icon: CheckCircle2,
    label: 'Approved',
    tone: 'text-primary-400',
  },
  running: {
    icon: LoaderCircle,
    label: 'Running',
    tone: 'text-primary-400',
  },
  succeeded: {
    icon: CheckCircle2,
    label: 'Completed',
    tone: 'text-accent-500',
  },
  denied: {
    icon: ShieldAlert,
    label: 'Denied',
    tone: 'text-warning-500',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    tone: 'text-error-500',
  },
};

export default function ToolActivity({ execution, agentName }: ToolActivityProps) {
  const status = statusMeta[execution.status];
  const StatusIcon = status.icon;
  const resultText =
    execution.result?.output ?? execution.result?.error ?? execution.error ?? null;

  return (
    <div className="flex w-full justify-start">
      <div
        className="w-full min-w-0"
        style={{ maxWidth: 'min(92%, 110ch)' }}
      >
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-[10px] font-display font-semibold uppercase tracking-[0.17em] text-accent-500">
            {agentName ?? execution.agentId}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Tool Activity
          </span>
        </div>

        <div className="shell-panel-muted px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-text-primary">
                <Wrench size={15} className="text-primary-400" />
                <p className="text-sm font-medium">{execution.toolName}</p>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-muted">
                {execution.toolId}
              </p>
            </div>

            <div className={`inline-flex items-center gap-2 text-xs font-medium ${status.tone}`}>
              <StatusIcon size={14} className={execution.status === 'running' ? 'animate-spin' : ''} />
              <span>{status.label}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="shell-pill">Risk: {execution.riskLevel}</span>
            {execution.projectDisplayName ? (
              <span className="shell-pill">{execution.projectDisplayName}</span>
            ) : null}
            {execution.permissionLevel ? (
              <span className="shell-pill">
                {execution.permissionLevel === 'read'
                  ? 'Project scope'
                  : execution.permissionLevel}
              </span>
            ) : null}
            {execution.result?.executionTime ? (
              <span className="shell-pill">
                {execution.result.executionTime}ms
              </span>
            ) : null}
          </div>

          {execution.projectPath ? (
            <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-primary/65 px-4 py-3">
              <p className="shell-kicker text-text-muted">Granted Project</p>
              <p className="mt-2 break-all text-xs leading-6 text-text-secondary">
                {execution.projectPath}
              </p>
            </div>
          ) : null}

          {execution.result?.summary ? (
            <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-primary/65 px-4 py-3">
              <p className="shell-kicker text-text-muted">Summary</p>
              <p className="mt-2 text-sm leading-7 text-text-primary">
                {execution.result.summary}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="min-w-0">
              <p className="shell-kicker text-text-muted">Parameters</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-border-subtle bg-surface-primary/65 px-4 py-3 text-[12px] leading-6 text-text-secondary">
                {JSON.stringify(execution.parameters, null, 2)}
              </pre>
            </div>

            <div className="min-w-0">
              <p className="shell-kicker text-text-muted">Result</p>
              <div className="mt-3 rounded-2xl border border-border-subtle bg-surface-primary/65 px-4 py-3">
                {resultText ? (
                  <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-text-secondary">
                    {resultText}
                  </pre>
                ) : (
                  <p className="text-sm leading-7 text-text-muted">
                    Waiting for the tool lifecycle to complete.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
