'use client';

import { useMemo, useState, type ComponentType } from 'react';
import { Brain, Gem, Search, Settings2, Waypoints } from 'lucide-react';
import type { ProviderId } from '@/lib/tauri';
import { PROVIDERS } from '@/lib/tauri';
import ProjectAccessManager from '@/components/projects/ProjectAccessManager';
import { useSettingsStore } from '@/stores/settings';
import AppShell from '@/components/layout/AppShell';
import ProviderForm from './ProviderForm';
import ToolControlPanel from './ToolControlPanel';

const providerIcons: Record<ProviderId, ComponentType<{ size?: number; className?: string }>> = {
  anthropic: Brain,
  openai: Waypoints,
  google: Gem,
  deepseek: Search,
  ollama: Settings2,
};

export default function SettingsLayout() {
  const { providers, setActiveProvider } = useSettingsStore();
  const [tab, setTab] = useState<ProviderId>('anthropic');
  const activeProvider = useMemo(
    () => PROVIDERS.find((provider) => provider.id === tab) ?? PROVIDERS[0],
    [tab],
  );

  const handleSelectProvider = (providerId: ProviderId) => {
    setTab(providerId);

    const provider = PROVIDERS.find((entry) => entry.id === providerId);
    if (provider?.status === 'available') {
      setActiveProvider(providerId);
    }
  };

  return (
    <AppShell
      title="Provider Settings"
      description="Configure the gateways and project grants that feed the command deck. Available providers are fully operational, while planned integrations remain visible as real roadmap status."
      stageWidth="settings"
    >
      <div className="space-y-5">
        <ToolControlPanel />
        <ProjectAccessManager />

        <section className="shell-panel relative overflow-hidden px-4 py-4 md:px-5 md:py-5">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[34%] bg-[radial-gradient(circle_at_left,rgba(0,245,255,0.1),transparent_72%)]" />
          <div className="grid gap-5 xl:grid-cols-[296px_minmax(0,1fr)]">
            <aside className="shell-panel-muted flex flex-col gap-4 px-4 py-4">
              <div>
                <p className="shell-kicker text-primary-400">Gateway Directory</p>
                <h2 className="mt-2 text-[1.65rem] font-display font-semibold text-text-primary">
                  Provider registry
                </h2>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  Select a gateway to tune routing, inspect readiness, or review planned support.
                </p>
              </div>

              <nav className="grid gap-2">
                {PROVIDERS.map((provider) => {
                  const Icon = providerIcons[provider.id];
                  const configured =
                    provider.status === 'available' &&
                    providers[provider.id]?.credential !== null;

                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => handleSelectProvider(provider.id)}
                      className={`rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
                        tab === provider.id
                          ? 'border-primary-500/40 bg-primary-500/10 shadow-[0_0_0_1px_rgba(0,240,255,0.08)]'
                          : 'border-border-subtle bg-surface-secondary/75 hover:border-border-highlight hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shell-icon-chip">
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-text-primary">{provider.name}</p>
                            {provider.status === 'planned' ? (
                              <span className="shell-pill border-warning-500/30 bg-warning-500/10 text-warning-500">
                                Planned
                              </span>
                            ) : null}
                            {configured ? (
                              <span className="shell-pill border-accent-500/25 bg-accent-500/10 text-accent-500">
                                Ready
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-text-secondary">
                            {provider.status === 'planned'
                              ? 'Roadmap integration'
                              : provider.defaultModel}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div className="shell-panel-muted min-h-[var(--shell-content-height)] px-5 py-5">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-border-subtle pb-4">
                <div>
                  <p className="shell-kicker text-primary-400">Selected Gateway</p>
                  <h3 className="mt-2 text-[1.95rem] font-display font-semibold text-text-primary">
                    {activeProvider.name}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-text-secondary">
                    {activeProvider.status === 'planned'
                      ? 'Visible to reflect the platform roadmap, but intentionally not configurable yet.'
                      : 'Credentials live locally, and the workspace can route turns through this gateway immediately after configuration.'}
                  </p>
                </div>
                <span className="shell-pill">
                  {activeProvider.status === 'planned' ? 'Roadmap' : 'Configurable'}
                </span>
              </div>

              <ProviderForm key={tab} providerId={tab} />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
