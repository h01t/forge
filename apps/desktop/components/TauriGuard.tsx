'use client';

import { useSyncExternalStore, useState } from 'react';
import { isTauriDesktop } from '@/lib/platform';

const emptySubscribe = () => () => {};

export default function TauriGuard({ children }: { children: React.ReactNode }) {
  const inTauri = useSyncExternalStore(emptySubscribe, isTauriDesktop, () => true);
  const [dismissed, setDismissed] = useState(false);

  if (inTauri || dismissed) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="relative z-[10000] bg-warning-500/10 border-b border-warning-500/40 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-warning-500 text-lg">&#9888;&#65039;</span>
            <div>
              <p className="text-sm text-warning-500 font-display font-semibold">
                NOT RUNNING IN TAURI SHELL
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Tauri IPC is unavailable in a regular browser. Run{' '}
                <code className="text-primary-500 bg-surface-tertiary px-1.5 py-0.5 rounded text-xs">
                  pnpm run tauri:dev
                </code>{' '}
                to launch the app inside the native webview with full backend access.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-text-tertiary hover:text-text-primary transition-colors text-sm ml-4"
          >
            DISMISS
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
