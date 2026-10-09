'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import LoadingPill from './LoadingPill';

// Thresholds. NN/g's response-time limits (0.1s feels instant, 1s keeps the flow of thought, 10s
// keeps attention) drive them: nothing at all shows for a navigation that settles inside
// REVEAL_MS (a cached or prefetched page), a thin bar covers the 0.12 to 1s band, and a pill that
// says "Memuat…" joins it from PILL_MS so a slow page never looks like a dead click.
const REVEAL_MS = 120;
const PILL_MS = 500;
/** Once the pill is up it stays at least this long, so a page that lands a moment later does not
 * leave a flash of "Memuat…" behind. */
const PILL_MIN_MS = 350;
/** A click that never turns into router activity (a link another handler took over) is dropped. */
const ARM_MS = 1200;
/** After the last navigation request has answered, how long to wait for the route to change. */
const GRACE_MS = 1500;
/** Hard stop: the bar never outlives a navigation by more than this. */
const MAX_MS = 15000;
const POLL_MS = 50;
const TRICKLE_MS = 260;

type Phase = 'idle' | 'armed' | 'loading' | 'settling';

// ---- the one place that watches Next's own navigation requests --------------------------------
//
// A router.push() (login -> dashboard, logout -> home, a filter that changes the URL) has no click
// to listen to, and Next 16 has no router events. What every navigation does have is one fetch of
// the destination's RSC payload (header `RSC: 1`, no `Next-Router-Prefetch`, no `Next-Action`).
// That request is the start signal. A request for the page the person is already on is a
// router.refresh() (AutoRefresh polls every 15s), not a navigation, and is ignored.
interface RscHook {
  onRequest: () => void;
  onSettled: () => void;
}
let rscHook: RscHook | null = null;
let fetchPatched = false;

function headerOf(input: RequestInfo | URL, init: RequestInit | undefined, name: string): string | null {
  const headers = init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) return headers.find(([key]) => key.toLowerCase() === name)?.[1] ?? null;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) return (headers as Record<string, string>)[key] ?? null;
  }
  return null;
}

function samePage(href: string): boolean {
  try {
    const url = new URL(href, location.href);
    url.searchParams.delete('_rsc');
    return url.origin === location.origin && url.pathname === location.pathname && url.search === location.search;
  } catch {
    return true;
  }
}

function isNavigationRequest(input: RequestInfo | URL, init: RequestInit | undefined): boolean {
  if (headerOf(input, init, 'rsc') !== '1') return false;
  if (headerOf(input, init, 'next-router-prefetch') || headerOf(input, init, 'next-action')) return false;
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return !samePage(href);
}

function patchFetch() {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const original = window.fetch;
  window.fetch = function patchedFetch(this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    let counted = false;
    try {
      if (rscHook && isNavigationRequest(input, init)) {
        counted = true;
        rscHook.onRequest();
      }
    } catch {
      // Detection must never get in the way of a request.
    }
    const promise = original.call(window, input, init);
    if (counted) {
      const settled = () => rscHook?.onSettled();
      promise.then(settled, settled);
    }
    return promise;
  } as typeof window.fetch;
}

/** A page that is still showing its loading skeleton (TableSkeleton, loading.tsx, DashboardSkeleton
 * all mark their frame aria-busy). A busy BUTTON is a form submitting, not a page loading. */
function pageIsBusy(): boolean {
  return document.querySelector('[aria-busy="true"]:not(button):not(input)') !== null;
}

function RouteWatcher({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const first = useRef(true);
  useEffect(() => {
    // The first run is the page that is already there, not a navigation.
    if (first.current) {
      first.current = false;
      return;
    }
    onChange();
  }, [pathname, search, onChange]);
  return null;
}

/**
 * Global navigation feedback, mounted once in app/layout.tsx. A 3px bar along the top edge starts
 * on an internal link click, a router.push / replace (login -> dashboard, logout -> home, a filter)
 * or a back/forward, trickles toward 90% while the page loads, and completes when the route has
 * settled: the URL changed AND the page is no longer showing its loading skeleton. After half a
 * second a "Memuat…" pill joins it (and a polite live region announces it), so a slow page, a
 * redirect chain or a cold serverless function never looks like a dead click.
 *
 * It never blocks: pointer-events none, no overlay, no delay added to the navigation itself, and it
 * lives in the top layer (a manual popover, like the toasts) so it still shows above an open
 * dialog. No package: a click listener, a wrapper around fetch for Next's navigation requests (see
 * above) and usePathname/useSearchParams to know when the route has changed.
 */
export default function NavigationProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState(false);
  const routeChangedRef = useRef<() => void>(() => {});
  const notifyRouteChanged = useCallback(() => routeChangedRef.current(), []);

  useEffect(() => {
    const bar = barRef.current;
    const root = rootRef.current;
    if (!bar || !root) return;

    let phase: Phase = 'idle';
    let progress = 0;
    let shown = false;
    let inflight = 0;
    const timers = new Set<number>();
    let fadeTimer: number | undefined;
    let pillTimer: number | undefined;
    let pillAt = 0;

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };
    const clearTimers = () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };

    const setBar = (value: number, transition: string) => {
      progress = value;
      bar.style.transition = transition;
      bar.style.transform = `scaleX(${value})`;
    };

    const resetBar = () => {
      window.clearTimeout(fadeTimer);
      bar.style.transition = 'none';
      bar.style.opacity = '0';
      bar.style.transform = 'scaleX(0)';
      progress = 0;
      shown = false;
      try {
        if (root.matches(':popover-open')) root.hidePopover();
      } catch {
        // No Popover API: the bar just stays at opacity 0.
      }
    };

    const trickle = () => {
      if (phase !== 'loading' && phase !== 'settling') return;
      setBar(progress + (0.9 - progress) * 0.12, `transform ${TRICKLE_MS}ms linear`);
      later(trickle, TRICKLE_MS);
    };

    const reveal = () => {
      if (shown || (phase !== 'loading' && phase !== 'settling')) return;
      shown = true;
      window.clearTimeout(fadeTimer);
      try {
        if (!root.matches(':popover-open')) root.showPopover();
      } catch {
        // No Popover API: fixed positioning below still paints it.
      }
      bar.style.opacity = '1';
      setBar(0.15, 'transform 200ms var(--motion-ease)');
      later(trickle, 200);
    };

    const showPill = () => {
      window.clearTimeout(pillTimer);
      pillAt = performance.now();
      setPill(true);
    };
    const hidePill = () => {
      window.clearTimeout(pillTimer);
      const wait = pillAt ? PILL_MIN_MS - (performance.now() - pillAt) : 0;
      pillAt = 0;
      if (wait > 0) pillTimer = window.setTimeout(() => setPill(false), wait);
      else setPill(false);
    };

    const finish = () => {
      if (phase === 'idle') return;
      phase = 'idle';
      inflight = 0;
      clearTimers();
      hidePill();
      if (!shown) {
        resetBar();
        return;
      }
      setBar(1, 'transform 160ms var(--motion-ease)');
      fadeTimer = window.setTimeout(() => {
        bar.style.transition = 'opacity 200ms ease';
        bar.style.opacity = '0';
        fadeTimer = window.setTimeout(resetBar, 220);
      }, 170);
    };

    const start = () => {
      if (phase === 'loading' || phase === 'settling') return;
      clearTimers();
      window.clearTimeout(pillTimer);
      resetBar();
      phase = 'loading';
      later(reveal, REVEAL_MS);
      later(() => {
        // The route may have landed while the timer ran (the poll is a few frames behind): then there
        // is nothing left to apologise for, and flashing the pill for one frame would be worse than
        // no pill.
        if (phase === 'settling' && !pageIsBusy()) {
          finish();
          return;
        }
        reveal();
        showPill();
      }, PILL_MS);
      later(finish, MAX_MS);
    };

    const poll = () => {
      if (phase !== 'settling') return;
      if (pageIsBusy()) later(poll, POLL_MS);
      else finish();
    };

    const routeChanged = () => {
      if (phase === 'idle') return;
      if (phase === 'armed') {
        // The URL changed without a request: a cached or prefetched page. Nothing to show unless the
        // page it landed on is still loading its skeleton.
        if (pageIsBusy()) {
          phase = 'idle';
          start();
        } else {
          phase = 'idle';
          clearTimers();
          return;
        }
      }
      phase = 'settling';
      // The effect that reports the new route runs after the commit that put the new page (or its
      // loading skeleton) in the DOM, so one frame is all it takes to look; a longer beat here is
      // what let the bar flash up for a page that had already landed.
      later(poll, 16);
    };
    routeChangedRef.current = routeChanged;

    const arm = () => {
      if (phase !== 'idle') return;
      phase = 'armed';
      later(() => {
        if (phase === 'armed') phase = 'idle';
      }, ARM_MS);
    };

    rscHook = {
      onRequest: () => {
        inflight += 1;
        if (phase === 'armed') phase = 'idle';
        start();
      },
      onSettled: () => {
        inflight = Math.max(0, inflight - 1);
        // The route normally changes right after the last request answers. If it does not (a
        // redirect back to the same page, an aborted request), do not hang until MAX_MS.
        if (inflight === 0) {
          later(() => {
            if (phase === 'loading') finish();
          }, GRACE_MS);
        }
      },
    };
    patchFetch();

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      if (anchor.origin !== location.origin) return;
      if (anchor.pathname === location.pathname && anchor.search === location.search) return;
      arm();
    };
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      rscHook = null;
      routeChangedRef.current = () => {};
      clearTimers();
      window.clearTimeout(fadeTimer);
      window.clearTimeout(pillTimer);
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <RouteWatcher onChange={notifyRouteChanged} />
      </Suspense>
      {/* The only part a screen reader sees; empty until the pill shows. */}
      <div role="status" aria-live="polite" className="sr-only">
        {pill ? 'Memuat halaman…' : ''}
      </div>
      <div
        ref={rootRef}
        popover="manual"
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] m-0 h-0 w-full max-w-none overflow-visible border-0 bg-transparent p-0"
      >
        <div
          ref={barRef}
          className="absolute inset-x-0 top-0 h-[3px] origin-left bg-text opacity-0 shadow-[0_0_8px_var(--color-text)]"
          style={{ transform: 'scaleX(0)' }}
        />
        {pill ? (
          <div className="absolute inset-x-0 top-2 flex justify-center">
            <LoadingPill />
          </div>
        ) : null}
      </div>
    </>
  );
}
