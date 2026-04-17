'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        return emptySubscribe();
      }

      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', onStoreChange);

      return () => mediaQueryList.removeEventListener('change', onStoreChange);
    },
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    () => false,
  );
}
