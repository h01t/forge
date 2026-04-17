'use client';

import { useState, useEffect } from 'react';
import type { ProviderId } from '@/lib/tauri';
import { PROVIDERS } from '@/lib/tauri';
import { useSettingsStore } from '@/stores/settings';
import ProviderForm from './ProviderForm';
import Link from 'next/link';

const providerIcons: Record<ProviderId, string> = {
  anthropic: '\u{1F9E0}',
  openai: '\u26A1',
  google: '\u{1F48E}',
  deepseek: '\u{1F50D}',
  ollama: '\u{1F999}',
};

export default function SettingsLayout() {
  const { init, providers, setActiveProvider } = useSettingsStore();
  const [tab, setTab] = useState<ProviderId>('anthropic');

  useEffect(() => {
    init();
  }, [init]);

  const handleSelectProvider = (providerId: ProviderId) => {
    setTab(providerId);

    const provider = PROVIDERS.find((entry) => entry.id === providerId);
    if (provider?.status === 'available') {
      setActiveProvider(providerId);
    }
  };

  return (
    <div className="flex h-full w-full">
      <aside className="w-72 bg-surface-secondary border-r border-border-default flex flex-col">
        <div className="p-6 border-b border-border-default">
          <h1 className="text-xl font-display font-bold text-primary-500 text-glow-cyan tracking-wider">
            SETTINGS
          </h1>
          <p className="text-sm text-text-muted mt-1">Configure providers</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {PROVIDERS.map((p) => {
            const configured = p.status === 'available' && providers[p.id]?.credential !== null;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectProvider(p.id)}
                className={`w-full p-3 rounded-lg text-left transition-all duration-200 flex items-center gap-3 ${
                  tab === p.id
                    ? 'bg-surface-elevated border border-primary-500/40'
                    : 'hover:bg-surface-hover border border-transparent'
                }`}
              >
                <span className="text-lg">{providerIcons[p.id]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-display text-text-primary">{p.name}</div>
                  <div className="text-xs text-text-tertiary">
                    {p.status === 'planned' ? 'Planned integration' : p.defaultModel}
                  </div>
                </div>
                {configured && (
                  <span className="w-2 h-2 rounded-full bg-accent-500 pulse-glow" />
                )}
                {p.status === 'planned' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-sm border border-warning-500/40 text-warning-500">
                    PLANNED
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border-default">
          <Link
            href="/chat/"
            className="block w-full py-2 px-4 text-center cyber-button text-sm rounded-lg"
          >
            BACK TO CHAT
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-surface-primary relative">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="relative z-10 flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <ProviderForm key={tab} providerId={tab} />
          </div>
        </div>
      </main>
    </div>
  );
}
