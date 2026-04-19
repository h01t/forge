'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type MouseEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  Home,
  MessagesSquare,
  PlugZap,
  Settings2,
} from 'lucide-react';
import PantheonForgeBrand from '@/components/brand/PantheonForgeBrand';
import { useIsTauriDesktop } from '@/lib/platform';
import { PROVIDERS } from '@/lib/tauri';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useAgentStore } from '@/stores/agents';
import { useProjectAccessStore } from '@/stores/project-access';
import { useSettingsStore } from '@/stores/settings';
import { useShellStore } from '@/stores/shell';

type StageWidth = 'launchpad' | 'workspace' | 'settings';

interface AppShellProps {
  title: string;
  description: string;
  stageWidth?: StageWidth;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const navItems = [
  { href: '/', label: 'Launchpad', icon: Home },
  { href: '/chat/', label: 'Chat', icon: MessagesSquare },
  { href: '/settings/', label: 'Settings', icon: Settings2 },
];

const stageWidthClasses: Record<StageWidth, string> = {
  launchpad: 'max-w-[1040px]',
  workspace: 'max-w-[1480px]',
  settings: 'max-w-[1080px]',
};

const railStats = [
  { key: 'providers', label: 'Providers', icon: PlugZap },
  { key: 'agents', label: 'Agents', icon: Bot },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname.startsWith(href);
}

export default function AppShell({
  title,
  description,
  stageWidth = 'launchpad',
  actions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const isTauriDesktop = useIsTauriDesktop();
  const isAutoCompact = useMediaQuery('(max-width: 1279px)');
  const { railMode, toggleRailMode } = useShellStore();
  const { init: initSettings, providers } = useSettingsStore();
  const { init: initProjectAccess, grants } = useProjectAccessStore();
  const { agents, init: initAgents } = useAgentStore();

  useEffect(() => {
    initSettings();
    initProjectAccess();
    initAgents();
  }, [initAgents, initProjectAccess, initSettings]);

  const configuredProviders = PROVIDERS.filter(
    (provider) => provider.status === 'available' && providers[provider.id]?.credential !== null,
  ).length;
  const effectiveRailMode = isAutoCompact ? 'compact' : railMode;
  const compact = effectiveRailMode === 'compact';
  const shellStatus = [
    {
      key: 'agents',
      icon: Bot,
      label: `${agents.length} specialists online`,
    },
    {
      key: 'providers',
      icon: PlugZap,
      label: `${configuredProviders} gateways ready`,
    },
    {
      key: 'projects',
      icon: FolderTree,
      label: `${grants.length} projects granted`,
    },
  ];
  const railLabel = isAutoCompact
    ? 'Navigation auto-compacts below 1280px'
    : compact
      ? 'Expand navigation'
      : 'Compact navigation';

  const handleTitlebarMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!isTauriDesktop || event.button !== 0) {
      return;
    }

    void getCurrentWindow().startDragging().catch(() => {
      // Swallow drag errors so browser rendering and hydration stay resilient.
    });
  };

  return (
    <div className={`app-shell ${isTauriDesktop ? 'app-shell--tauri' : ''}`}>
      {isTauriDesktop ? (
        <div className="app-shell__titlebar">
          <div className="app-shell__titlebar-safe" />
          <div className="app-shell__titlebar-drag" onMouseDown={handleTitlebarMouseDown} />
        </div>
      ) : null}

      <div className="app-shell__body">
        <aside
          className={`app-shell__rail ${compact ? 'app-shell__rail--compact' : ''}`}
          style={{
            width: compact ? 'var(--shell-rail-compact)' : 'var(--shell-rail-expanded)',
          }}
        >
          <div className="flex h-full flex-col gap-4 px-3.5 py-4">
            <Link
              href="/"
              className={`shell-brand-panel shell-panel flex items-center gap-3 px-3.5 py-3 ${
                compact ? 'justify-center px-0' : ''
              }`}
            >
              <PantheonForgeBrand compact={compact} />
            </Link>

            <nav className="flex flex-col gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={compact ? item.label : undefined}
                    className={`shell-nav-link ${compact ? 'justify-center px-0' : ''} ${
                      active ? 'shell-nav-link--active' : ''
                    }`}
                  >
                    <Icon size={17} className="shrink-0" />
                    {!compact && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col gap-2.5">
              <div className="shell-panel-muted px-3.5 py-3.5">
                {compact ? (
                  <div className="grid grid-cols-1 gap-2">
                    {railStats.map((stat) => {
                      const Icon = stat.icon;
                      const value = stat.key === 'providers' ? configuredProviders : agents.length;

                      return (
                        <div
                          key={stat.key}
                          title={`${stat.label}: ${value}`}
                          className="rounded-[18px] border border-border-subtle bg-surface-secondary/80 px-2 py-2.5 text-center"
                        >
                          <Icon size={14} className="mx-auto text-text-muted" />
                          <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {railStats.map((stat) => {
                      const Icon = stat.icon;
                      const value = stat.key === 'providers' ? configuredProviders : agents.length;

                      return (
                        <div key={stat.key} className="flex flex-col items-center justify-center gap-1.5 text-center">
                          <div className="flex items-center justify-center gap-2 text-text-muted">
                            <Icon size={13} />
                            <span className="shell-kicker">{stat.label}</span>
                          </div>
                          <p className="text-sm font-semibold text-text-primary">{value}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                title={railLabel}
                onClick={toggleRailMode}
                className="shell-nav-link justify-center"
              >
                {compact ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
                {!compact && <span>{compact ? 'Expand Rail' : 'Compact Rail'}</span>}
              </button>
            </div>
          </div>
        </aside>

        <main className="app-shell__main">
          <div className="absolute inset-0 grid-bg pointer-events-none" />
          <div className="app-shell__nebula pointer-events-none" />
          <div className="app-shell__constellation pointer-events-none" />

          <div className="app-shell__scroll">
            <div className={`mx-auto flex w-full flex-col gap-5 ${stageWidthClasses[stageWidth]}`}>
              <section className="shell-header shell-panel sticky top-0 z-20 flex flex-wrap items-start justify-between gap-4 px-6 py-[1.125rem] backdrop-blur-xl">
                <div className="min-w-0">
                  <p className="shell-kicker text-primary-400">Command Surface</p>
                  <h1 className="mt-2 text-[1.9rem] font-display font-semibold tracking-[0.03em] text-text-primary">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary">
                    {description}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {!compact ? (
                    shellStatus.map((status) => {
                      const Icon = status.icon;

                      return (
                        <span key={status.key} className="shell-status-chip">
                          <Icon size={14} />
                          {status.label}
                        </span>
                      );
                    })
                  ) : null}
                  {actions}
                </div>
              </section>

              <div className="shell-stage-frame pb-7">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
