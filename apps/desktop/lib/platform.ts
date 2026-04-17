'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function useIsTauriDesktop(): boolean {
  return useSyncExternalStore(emptySubscribe, isTauriDesktop, () => false);
}
