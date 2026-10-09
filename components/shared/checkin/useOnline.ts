'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * `navigator.onLine`, live. False only when the browser is sure there is no network (airplane
 * mode, no Wi-Fi); true can still mean "connected to a router with no internet", so a failed
 * request is handled separately (describePunchError, status undefined). The server snapshot is
 * true so the first paint never flashes an offline banner.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
