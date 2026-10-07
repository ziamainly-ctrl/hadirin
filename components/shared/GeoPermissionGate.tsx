'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export type GeoStatus = 'loading' | 'ok' | 'denied' | 'weak-signal' | 'error';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

export interface GeoPermissionGateProps {
  /** `retry` asks for the position again — the "Coba Lagi" after 'denied' (once the user
   * re-enables the permission; browsers then answer without a reload) or 'error'. */
  children: (coords: GeoCoords | null, status: GeoStatus, retry: () => void) => ReactNode;
  /** PRD.md US-01: accuracy worse than 100 m is a weak signal. */
  weakSignalThresholdM?: number;
}

const DEFAULT_WEAK_SIGNAL_THRESHOLD_M = 100;

function hasGeolocation(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

// Nothing to subscribe to: whether the API exists never changes while the page is open.
const subscribeNever = () => () => {};

/**
 * Pure geolocation logic wrapper for check-in/out (PRD.md US-01). Renders
 * nothing itself beyond the children render-prop — every status's UI is the
 * caller's call.
 */
export default function GeoPermissionGate({
  children,
  weakSignalThresholdM = DEFAULT_WEAK_SIGNAL_THRESHOLD_M,
}: GeoPermissionGateProps) {
  // "No geolocation API" is knowable at render time but differs between server and
  // client, so it can't seed useState: the server (no navigator.geolocation) would render
  // the error UI into the HTML, the client's first render would say "loading", and React
  // would throw the server markup away on hydration (a visible error flash, plus a
  // hydration error in the console). useSyncExternalStore is the sanctioned way to read a
  // client-only value: the server snapshot (true = assume supported) matches the first
  // client render, and React re-renders with the real value right after hydrating.
  const supported = useSyncExternalStore(subscribeNever, hasGeolocation, () => true);
  const [geoStatus, setStatus] = useState<GeoStatus>('loading');
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  // Bumped by retry() to re-run the effect below, which is the one place that asks.
  const [attempt, setAttempt] = useState(0);
  const status: GeoStatus = supported ? geoStatus : 'error';

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const next: GeoCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        };
        setCoords(next);
        setStatus(next.accuracyM > weakSignalThresholdM ? 'weak-signal' : 'ok');
      },
      (error) => {
        if (cancelled) return;
        setCoords(null);
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );

    return () => {
      cancelled = true;
    };
  }, [supported, weakSignalThresholdM, attempt]);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  return children(coords, status, retry);
}
