'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Code2,
  FolderOpen,
  MessageSquareText,
  PlugZap,
  ShieldCheck,
} from 'lucide-react';
import PantheonForgeBrand from '@/components/brand/PantheonForgeBrand';
import AppShell from '@/components/layout/AppShell';
import OpenProjectButton from '@/components/projects/OpenProjectButton';
import { useAgentStore } from '@/stores/agents';
import { useConversationsStore } from '@/stores/conversations';
import { useProjectAccessStore } from '@/stores/project-access';
import { useSettingsStore } from '@/stores/settings';
import { PROVIDERS } from '@/lib/tauri';

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

const agentMeta: Record<
  string,
  { icon: typeof Code2; badge: string; accent: string }
> = {
  'software-engineer': {
    icon: Code2,
    badge: 'Build & Debug',
    accent: 'from-cyan-500/20 to-sky-500/5',
  },
  cybersecurity: {
    icon: ShieldCheck,
    badge: 'Review & Protect',
    accent: 'from-fuchsia-500/20 to-violet-500/5',
  },
};

export default function Home() {
  const { agents } = useAgentStore();
  const { conversations, loadConversations } = useConversationsStore();
  const { starterProjectId, setStarterProjectId, getGrantById } = useProjectAccessStore();
  const { activeProvider, getFirstUsableProvider, isProviderUsable, providers } = useSettingsStore();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const hasConfiguredProvider =
    isProviderUsable(activeProvider) || getFirstUsableProvider() !== null;
  const configuredProviderCount = PROVIDERS.filter(
    (provider) => provider.status === 'available' && providers[provider.id]?.credential !== null,
  ).length;
  const starterProjectGrant = getGrantById(starterProjectId);
  const recentConversations = conversations.slice(0, 4);
  const getAgentName = (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId);
    return agent?.name ?? agentId;
  };

  return (
    <AppShell
      title="Launchpad"
      description="Pick the right specialist, check system readiness, and jump back into active work from one consistent command surface."
      stageWidth="launchpad"
    >
      <div className="space-y-5">
        <section className="shell-panel relative overflow-hidden px-7 py-7 md:px-9 md:py-9">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_top_left,rgba(0,245,255,0.16),transparent_54%),linear-gradient(180deg,rgba(32,71,88,0.1),transparent)] opacity-90" />
          <div className="pointer-events-none absolute inset-x-[36%] bottom-0 h-px bg-gradient-to-r from-transparent via-primary-500/35 to-transparent" />

          <div className="relative grid gap-6 md:grid-cols-[1.06fr_0.94fr] md:items-stretch">
            <div className="space-y-6">
              <div className="inline-flex rounded-[26px] border border-border-highlight bg-surface-secondary/75 px-4 py-3 backdrop-blur-xl">
                <PantheonForgeBrand />
              </div>

              <div className="space-y-4">
                <p className="shell-kicker text-primary-300">Unified Agent Command Deck</p>
                <h2 className="max-w-[11ch] text-[2.75rem] font-display font-semibold leading-[1.02] text-text-primary md:text-[3.15rem]">
                  Build with the right specialist, not a blank screen.
                </h2>
                <p className="max-w-[35rem] text-[15px] leading-8 text-text-secondary">
                  Pantheon Forge keeps your specialists, gateways, project grants, and recent
                  threads aligned inside one calm command surface, so each session feels like a
                  deliberate mission start instead of a cold blank canvas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link href="/chat/" className="cyber-button inline-flex items-center gap-2 text-sm">
                  Enter Chat Workspace
                  <ArrowRight size={16} />
                </Link>
                <OpenProjectButton
                  label="Open Project"
                  onGranted={async (grant) => {
                    await setStarterProjectId(grant.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border-highlight bg-surface-secondary px-5 py-3 text-sm text-text-primary transition-all duration-200 hover:border-primary-500/40 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                />
                <Link
                  href="/settings/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border-highlight bg-surface-secondary px-5 py-3 text-sm text-text-primary transition-all duration-200 hover:border-primary-500/40 hover:bg-surface-hover"
                >
                  Configure Gateways
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="shell-panel-muted px-5 py-4">
                  <div className="flex items-center gap-2 text-primary-400">
                    <FolderOpen size={15} />
                    <span className="shell-kicker">Project Scope</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    {starterProjectGrant ? (
                      <>
                        Next chat opens with{' '}
                        <span className="text-text-primary">
                          {starterProjectGrant.displayName}
                        </span>{' '}
                        attached as the scoped project for approved tool work.
                      </>
                    ) : (
                      'Open a project when you want the next conversation to include project-scoped tool access.'
                    )}
                  </p>
                </div>

                <div className="shell-panel-muted px-5 py-4">
                  <div className="flex items-center gap-2 text-primary-400">
                    <MessageSquareText size={15} />
                    <span className="shell-kicker">Mission Start</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    Choose a specialist below, then move directly into the workspace with routing,
                    project context, and recent threads already in view.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
              <div className="shell-panel-muted flex h-full flex-col items-center justify-center px-6 py-6 text-center">
                <div className="flex items-center justify-center gap-2 text-primary-400">
                  <PlugZap size={16} />
                  <span className="shell-kicker">Provider Readiness</span>
                </div>
                <p className="mt-4 text-[2.1rem] font-display font-semibold text-text-primary">
                  {configuredProviderCount}
                </p>
                <p className="mt-2 max-w-[15rem] text-sm leading-7 text-text-secondary">
                  Available gateways configured and ready for routing.
                </p>
              </div>

              <div className="shell-panel-muted flex h-full flex-col items-center justify-center px-6 py-6 text-center">
                <div className="flex items-center justify-center gap-2 text-primary-400">
                  <Bot size={16} />
                  <span className="shell-kicker">Specialists Online</span>
                </div>
                <p className="mt-4 text-[2.1rem] font-display font-semibold text-text-primary">
                  {agents.length}
                </p>
                <p className="mt-2 max-w-[15rem] text-sm leading-7 text-text-secondary">
                  Domain-focused agents ready to take the lead on your next task.
                </p>
              </div>

              <div className="shell-panel-muted space-y-3 px-6 py-6 sm:col-span-2">
                <div className="flex items-center gap-2 text-primary-400">
                  {starterProjectGrant ? <FolderOpen size={16} /> : <MessageSquareText size={16} />}
                  <span className="shell-kicker">Current State</span>
                </div>
                <div className="space-y-2 text-sm leading-7 text-text-secondary">
                  <p>
                    {hasConfiguredProvider
                      ? 'At least one usable gateway is online. Pick a specialist and move directly into the live workspace.'
                      : 'No usable provider is configured yet. Set up a gateway first, then launch into a specialist workspace.'}
                  </p>
                  {starterProjectGrant ? (
                    <p>
                      Starter project armed:{' '}
                      <span className="text-text-primary">{starterProjectGrant.displayName}</span>
                    </p>
                  ) : (
                    <p>No starter project is armed yet for the next conversation.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="shell-panel px-6 py-6 md:px-7">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="shell-kicker text-primary-400">Agent Selection</p>
                <h3 className="mt-2 text-[1.8rem] font-display font-semibold text-text-primary">
                  Choose your specialist
                </h3>
              </div>
              <span className="shell-pill">{agents.length} ready</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {agents.map((agent) => {
                const meta = agentMeta[agent.id] ?? agentMeta['software-engineer'];
                const Icon = meta.icon;
                const preferredProvider = agent.llmPreference ?? 'shared routing';

                return (
                  <Link
                    key={agent.id}
                    href={`/chat/?agent=${agent.id}`}
                    className="group shell-panel-muted relative flex h-full overflow-hidden px-5 py-5 transition-all duration-200 hover:border-primary-500/30 hover:bg-surface-hover"
                  >
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-primary-500/10 via-transparent to-transparent opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
                    <div className="flex w-full items-start gap-4">
                      <div className={`rounded-2xl bg-gradient-to-br ${meta.accent} p-3 text-primary-400`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex min-h-full min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-display font-semibold text-text-primary">
                            {agent.name}
                          </h4>
                          <span className="shell-pill">{meta.badge}</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-text-secondary">
                          {agent.description}
                        </p>
                        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                            Prefers {preferredProvider}
                          </span>
                          <span className="inline-flex items-center gap-2 text-sm text-primary-400 transition-transform duration-200 group-hover:translate-x-1">
                            Enter workspace
                            <ArrowRight size={15} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <section className="shell-panel px-6 py-6 md:px-7 md:py-7">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="shell-kicker text-primary-400">Recent Work</p>
                  <h3 className="mt-2 text-[1.8rem] font-display font-semibold text-text-primary">
                    Return to active threads
                  </h3>
                </div>
                <Link href="/chat/" className="text-sm text-primary-400 hover:text-primary-300">
                  View all
                </Link>
              </div>

              {recentConversations.length === 0 ? (
                <div className="shell-panel-muted px-6 py-6 text-sm leading-7 text-text-secondary">
                  No conversations yet. Launch an agent from the left to start your first working thread.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentConversations.map((conversation) => (
                    <Link
                      key={conversation.id}
                      href={`/chat/?conversation=${conversation.id}${conversation.agent_id && conversation.agent_id !== 'default' ? `&agent=${conversation.agent_id}` : ''}`}
                      className="shell-panel-muted block px-5 py-4 transition-all duration-200 hover:border-primary-500/30 hover:bg-surface-hover"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {conversation.title}
                        </p>
                        <span className="pt-0.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                          {relativeTime(conversation.updated_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] text-text-secondary">
                        {conversation.agent_id === 'default'
                          ? 'General chat'
                          : getAgentName(conversation.agent_id)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="shell-panel-muted px-6 py-6 md:px-7 md:py-7">
              <p className="shell-kicker text-primary-400">Operational Notes</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-text-secondary">
                <p>
                  The command deck now keeps brand, routing, project scope, and recent work inside
                  one shared shell, so every surface feels like part of the same station instead of
                  separate pages stitched together.
                </p>
                <p>
                  Use the rail toggle on the left to switch between expanded and compact navigation,
                  or let the shell auto-compact itself below the desktop threshold.
                </p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
