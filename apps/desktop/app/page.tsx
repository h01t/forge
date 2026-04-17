'use client';

import { useSettingsStore } from '@/stores/settings';
import { useAgentStore } from '@/stores/agents';
import { useEffect } from 'react';
import Link from 'next/link';

const agentMeta: Record<string, { icon: string; color: string }> = {
  'software-engineer': { icon: '\u26A1', color: 'from-cyan-500/20 to-blue-600/10' },
  cybersecurity: { icon: '\uD83D\uDEE1\uFE0F', color: 'from-fuchsia-500/20 to-purple-600/10' },
};

export default function Home() {
  const { init, activeProvider, providers } = useSettingsStore();
  const { agents, init: initAgents } = useAgentStore();

  useEffect(() => {
    init();
    initAgents();
  }, [init, initAgents]);

  const hasConfiguredProvider = activeProvider && providers[activeProvider]?.credential !== null;

  return (
    <div className="flex h-full w-full">
      <aside className="w-72 bg-surface-secondary border-r border-border-default flex flex-col">
        <div className="px-5 py-4 border-b border-border-default">
          <h1 className="text-lg font-display font-bold text-primary-500 text-glow-cyan tracking-wider">
            PANTHEON FORGE
          </h1>
          <p className="text-xs text-text-muted mt-0.5">AI Agent Platform</p>
        </div>

        <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <h2 className="text-[10px] font-display text-text-tertiary uppercase tracking-widest px-2 py-2">
            Agents
          </h2>
          {agents.map((agent) => {
            const meta = agentMeta[agent.id] ?? { icon: '?', color: 'from-gray-500/20 to-gray-600/10' };
            return (
              <Link
                key={agent.id}
                href={`/chat/?agent=${agent.id}`}
                className="w-full px-3 py-2.5 rounded-lg text-left transition-all duration-200 hover:bg-surface-hover border border-transparent hover:border-border-default flex items-center gap-3"
              >
                <div className={`text-lg p-1.5 rounded-md bg-gradient-to-br ${meta.color} shrink-0`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {agent.name}
                    </h3>
                    {hasConfiguredProvider && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-500 pulse-glow shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-1">
                    {agent.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="p-3 border-t border-border-default">
          <Link
            href="/settings/"
            className="block w-full py-2 px-3 rounded-lg cyber-button text-xs text-center"
          >
            SETTINGS
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-surface-primary relative">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="text-center max-w-md px-8">
            <h2 className="text-2xl font-display font-bold text-primary-500 text-glow-cyan mb-3">
              Welcome to Pantheon Forge
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              {!hasConfiguredProvider ? (
                <>
                  Configure an API provider in{' '}
                  <Link href="/settings/" className="text-primary-500 hover:underline">
                    Settings
                  </Link>{' '}
                  to get started, then select an agent.
                </>
              ) : (
                <>
                  Select an agent from the sidebar to begin. Each agent specializes in different domains
                  and can collaborate on complex tasks.
                </>
              )}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/chat/"
                className="px-4 py-2.5 rounded-lg bg-surface-tertiary border border-border-default hover:border-primary-500/30 transition-colors text-sm text-text-primary"
              >
                Start Chat
              </Link>
              <Link
                href="/settings/"
                className="px-4 py-2.5 rounded-lg bg-surface-tertiary border border-border-default hover:border-primary-500/30 transition-colors text-sm text-text-primary"
              >
                Configure
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
