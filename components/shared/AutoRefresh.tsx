'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, RefreshCw } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';

export interface AutoRefreshProps {
  /** Milliseconds between refreshes. Default 15 s. */
  intervalMs?: number;
  /** When the server rendered the data being shown (ISO). It changes on every refresh, which is
   * what the "Diperbarui" stamp reads; a value from the server (not `new Date()` on the client)
   * keeps server and client markup identical, so nothing mismatches on hydration. */
  generatedAt: string;
  /** organizations.timezone: the stamp is in the org's own clock, not the viewer's. */
  timeZone: string;
}

/** A tab that comes back to the front within this window of the last refresh does not refresh again. */
const MIN_GAP_MS = 5_000;

/**
 * Keeps a Server Component page live: every `intervalMs` it calls router.refresh() (the server
 * re-renders the page's data, the client keeps its state and scroll), paused while the tab is in
 * the background or the device is offline, refreshed right away when the tab returns to the front.
 * The person can pause it (a feed they are reading must not move under them) or refresh by hand.
 * Shows "Diperbarui HH.MM.SS" so a stale screen is never mistaken for a quiet office.
 */
export default function AutoRefresh({ intervalMs = 15_000, generatedAt, timeZone }: AutoRefreshProps) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lastRefreshRef = useRef(0);

  const refresh = useCallback(() => {
    lastRefreshRef.current = Date.now();
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (paused) return;
    const tick = window.setInterval(() => {
      if (document.hidden || !navigator.onLine) return;
      refresh();
    }, intervalMs);
    const onVisible = () => {
      if (document.hidden || !navigator.onLine) return;
      if (Date.now() - lastRefreshRef.current < MIN_GAP_MS) return;
      refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [paused, intervalMs, refresh]);

  const stamp = new Date(generatedAt).toLocaleTimeString('id-ID', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-2 pr-1 text-xs text-muted">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${paused ? 'bg-muted' : 'bg-success animate-pulse motion-reduce:animate-none'}`}
        />
        <span className="tabular-nums">{paused ? `Dijeda · ${stamp}` : `Diperbarui ${stamp}`}</span>
      </span>
      <IconButton label="Muat ulang sekarang" variant="outline" size="sm" onClick={refresh} disabled={isPending}>
        <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
      </IconButton>
      <IconButton
        label={paused ? 'Lanjutkan pembaruan otomatis' : 'Jeda pembaruan otomatis'}
        variant="outline"
        size="sm"
        aria-pressed={paused}
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
      </IconButton>
    </div>
  );
}
