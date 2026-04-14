'use client';

import { useSettingsStore } from '@/stores/settings';
import { useEffect } from 'react';
import Link from 'next/link';

const agents = [
  {
    id: 'software-engineer',
    name: 'Software Engineer',
    description: 'Expert in code generation, debugging, and best practices',
    icon: '\u26A1',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity Specialist',
    description: 'Expert in vulnerability analysis and secure coding',
    icon: '\uD83D\uDEE1\uFE0F',
    color: 'from-magenta-500 to-purple-600',
  },
];

export default function Home() {
  const { init, activeProvider, providers } = useSettingsStore();

  useEffect(() => {
    init();
  }, [init]);

  const hasConfiguredProvider = activeProvider && providers[activeProvider]?.credential !== null;

  return (
    <div className="flex h-full w-full">
      <aside className="w-72 bg-surface-secondary border-r border-border-default flex flex-col">
        <div className="p-6 border-b border-border-default">
          <h1 className="text-2xl font-display font-bold text-primary-500 text-glow-cyan tracking-wider">
            PANTHEON FORGE
          </h1>
          <p className="text-sm text-text-muted mt-1">AI Agent Platform</p>
        </div>

        <div className="flex-1 p-4 space-y-3">
          <h2 className="text-xs font-display text-text-tertiary uppercase tracking-widest mb-4">
            Available Agents
          </h2>
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href="/chat/"
              className="w-full p-4 rounded-lg text-left transition-all duration-300 cyber-card block"
            >
              <div className="flex items-start gap-3">
                <div className={`text-2xl p-2 rounded-lg bg-gradient-to-br ${agent.color} bg-opacity-20`}>
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-text-primary truncate">
                      {agent.name}
                    </h3>
                    {hasConfiguredProvider && (
                      <span className="w-2 h-2 rounded-full bg-accent-500 pulse-glow" />
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {agent.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="p-4 border-t border-border-default">
          <Link
            href="/settings/"
            className="block w-full py-3 px-4 rounded-lg cyber-button text-sm text-center"
          >
            SETTINGS
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-surface-primary relative">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="text-center max-w-lg p-8">
            <div className="text-6xl mb-6 animate-pulse">&#9889;</div>
            <h2 className="text-3xl font-display font-bold text-primary-500 text-glow-cyan mb-4">
              Welcome to Pantheon Forge
            </h2>
            <p className="text-text-secondary mb-8">
              {!hasConfiguredProvider ? (
                <>
                  Configure an API provider in{' '}
                  <Link href="/settings/" className="text-primary-500 hover:underline">
                    Settings
                  </Link>{' '}
                  to get started, then select an agent to begin chatting.
                </>
              ) : (
                <>
                  Select an agent from the sidebar to begin. Each agent specializes in different domains
                  and can collaborate to solve complex tasks.
                </>
              )}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/chat/"
                className="p-4 rounded-lg bg-surface-tertiary border border-border-default hover:border-primary-500/40 transition-colors block"
              >
                <div className="text-2xl mb-2">&#128172;</div>
                <h3 className="font-display text-sm text-text-primary mb-1">Start Chat</h3>
                <p className="text-xs text-text-tertiary">Begin a conversation</p>
              </Link>
              <Link
                href="/settings/"
                className="p-4 rounded-lg bg-surface-tertiary border border-border-default hover:border-primary-500/40 transition-colors block"
              >
                <div className="text-2xl mb-2">&#128274;</div>
                <h3 className="font-display text-sm text-text-primary mb-1">Configure</h3>
                <p className="text-xs text-text-tertiary">Set up API keys</p>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
