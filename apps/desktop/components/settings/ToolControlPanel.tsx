'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  FilePenLine,
  FileSearch,
  FolderTree,
  Shield,
  TerminalSquare,
} from 'lucide-react';
import type { RiskLevel, ToolExecutionLog, ToolExecutionStatus } from '@/lib/tauri';
import { listRecentToolExecutions } from '@/lib/tauri';

type ToolStatus = 'available' | 'planned';

interface ToolCatalogEntry {
  id: string;
  name: string;
  description: string;
  risk: RiskLevel;
  status: ToolStatus;
}

const toolCatalog: ToolCatalogEntry[] = [
  {
    id: 'read-file',
    name: 'Read File',
    description: 'Read UTF-8 text files inside the attached project with line and size limits.',
    risk: 'low',
    status: 'available',
  },
  {
    id: 'search-files',
    name: 'Search Files',
    description: 'Run bounded plain-text search across the attached project while skipping noisy directories.',
    risk: 'low',
    status: 'available',
  },
  {
    id: 'write-file',
    name: 'Write File',
    description: 'Create or replace a UTF-8 text file with approval previews and hash-based conflict protection.',
    risk: 'medium',
    status: 'available',
  },
  {
    id: 'execute-command',
    name: 'Execute Command',
    description: 'Run a curated allowlist of project commands with scoped working directories and bounded output.',
    risk: 'high',
    status: 'available',
  },
];

const specialistBacklog: ToolCatalogEntry[] = [
  {
    id: 'analyze-dependencies',
    name: 'Analyze Dependencies',
    description: 'Future cybersecurity workflow for dependency and package inspection.',
    risk: 'medium',
    status: 'planned',
  },
  {
    id: 'scan-network',
    name: 'Scan Network',
    description: 'Future cybersecurity workflow for controlled network and port analysis.',
    risk: 'high',
    status: 'planned',
  },
];

const riskToneClasses: Record<RiskLevel, string> = {
  low: 'border-accent-500/25 bg-accent-500/10 text-accent-500',
  medium: 'border-primary-500/25 bg-primary-500/10 text-primary-300',
  high: 'border-warning-500/30 bg-warning-500/10 text-warning-500',
  critical: 'border-error-500/35 bg-error-500/10 text-error-500',
};

const statusToneClasses: Record<ToolStatus, string> = {
  available: 'border-accent-500/25 bg-accent-500/10 text-accent-500',
  planned: 'border-warning-500/30 bg-warning-500/10 text-warning-500',
};

const executionToneClasses: Record<ToolExecutionStatus, string> = {
  pending: 'text-warning-500',
  approved: 'text-primary-300',
  running: 'text-primary-300',
  succeeded: 'text-accent-500',
  denied: 'text-warning-500',
  failed: 'text-error-500',
};

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export default function ToolControlPanel() {
  const [recentExecutions, setRecentExecutions] = useState<ToolExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentExecutions() {
      try {
        setLoading(true);
        const executions = await listRecentToolExecutions(12);
        if (!cancelled) {
          setRecentExecutions(executions);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(String(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRecentExecutions();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="shell-panel px-5 py-5 md:px-6 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-primary-400">
            <Activity size={15} />
            <span className="shell-kicker text-primary-400">Tool Control</span>
          </div>
          <h2 className="mt-3 text-[1.55rem] font-display font-semibold text-text-primary">
            Scoped tools, approvals, and execution history
          </h2>
          <p className="mt-2 text-sm leading-7 text-text-secondary">
            Phase 3 now ships the core tool surface: project-scoped file reads, search, whole-file
            writes, and curated command execution. Every tool run still requires approval from the
            chat workspace before anything touches the project.
          </p>
        </div>

        <div className="shell-panel-muted max-w-[300px] px-4 py-4">
          <div className="flex items-center gap-2 text-accent-500">
            <Shield size={15} />
            <span className="shell-kicker text-accent-500">Approval Policy</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-text-secondary">
            Project grants define the directory boundary. They do not auto-approve reads, writes,
            or commands. Each call shows its own risk and preview before execution.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="shell-panel-muted px-5 py-5">
          <div className="flex items-center gap-2 text-primary-400">
            <TerminalSquare size={15} />
            <span className="shell-kicker text-primary-400">Current Tool Catalog</span>
          </div>
          <div className="mt-4 grid gap-3">
            {toolCatalog.map((tool) => (
              <div
                key={tool.id}
                className="rounded-2xl border border-border-subtle bg-surface-primary/60 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{tool.name}</p>
                      <span className={`shell-pill ${riskToneClasses[tool.risk]}`}>
                        {tool.risk} risk
                      </span>
                      <span className={`shell-pill ${statusToneClasses[tool.status]}`}>
                        {tool.status === 'available' ? 'Available now' : 'Planned'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-muted">
                      {tool.id}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-text-secondary">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="shell-panel-muted px-5 py-5">
            <div className="flex items-center gap-2 text-primary-400">
              <FolderTree size={15} />
              <span className="shell-kicker text-primary-400">Project Grant Model</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              Conversations attach exactly one remembered project at a time. That grant scopes all
              tool resolution to a single directory tree so the agent never reaches beyond the
              project you selected.
            </p>
          </div>

          <div className="shell-panel-muted px-5 py-5">
            <div className="flex items-center gap-2 text-primary-400">
              <AlertTriangle size={15} />
              <span className="shell-kicker text-primary-400">Risk Legend</span>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-border-subtle bg-surface-primary/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`shell-pill ${riskToneClasses.low}`}>low</span>
                  <p className="text-sm text-text-primary">Inspection-only work like read and search.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-primary/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`shell-pill ${riskToneClasses.medium}`}>medium</span>
                  <p className="text-sm text-text-primary">File mutations with preview and conflict checks.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-primary/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`shell-pill ${riskToneClasses.high}`}>high</span>
                  <p className="text-sm text-text-primary">Curated command execution with strict allowlists.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="shell-panel-muted px-5 py-5">
            <div className="flex items-center gap-2 text-primary-400">
              <FileSearch size={15} />
              <span className="shell-kicker text-primary-400">Specialist Backlog</span>
            </div>
            <div className="mt-4 grid gap-3">
              {specialistBacklog.map((tool) => (
                <div
                  key={tool.id}
                  className="rounded-2xl border border-border-subtle bg-surface-primary/60 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{tool.name}</p>
                    <span className={`shell-pill ${statusToneClasses[tool.status]}`}>Planned</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-muted">
                    {tool.id}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-text-secondary">
                    {tool.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 shell-panel-muted px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary-400">
              <FilePenLine size={15} />
              <span className="shell-kicker text-primary-400">Recent Execution History</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-text-secondary">
              Recent tool runs across conversations, including approvals, denials, failures, and
              completed actions.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-primary/60 px-4 py-4 text-sm text-text-secondary">
            Loading recent tool activity…
          </div>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-error-500/30 bg-error-500/8 px-4 py-4 text-sm text-error-500">
            {error}
          </div>
        ) : recentExecutions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-primary/60 px-4 py-4 text-sm text-text-secondary">
            No tool executions yet. Activity will appear here after the first approved or denied
            tool request.
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {recentExecutions.map((execution) => (
              <div
                key={execution.id}
                className="rounded-2xl border border-border-subtle bg-surface-primary/60 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{execution.toolName}</p>
                      <span className={`shell-pill ${riskToneClasses[execution.riskLevel]}`}>
                        {execution.riskLevel} risk
                      </span>
                      <span
                        className={`text-xs font-medium capitalize ${executionToneClasses[execution.status]}`}
                      >
                        {execution.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-muted">
                      {execution.toolId}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-text-primary">
                      {execution.result?.summary ??
                        execution.result?.error ??
                        execution.error ??
                        'Execution logged without a summary.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      {execution.projectDisplayName ? (
                        <span>{execution.projectDisplayName}</span>
                      ) : null}
                      <span>{formatTimestamp(execution.updatedAt ?? execution.timestamp)}</span>
                      <span>Conversation {execution.conversationId.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
