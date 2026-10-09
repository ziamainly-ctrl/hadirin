'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { GeoErrorKind } from '@/lib/check-in-copy';

export type GeoStatus = 'loading' | 'ok' | 'denied' | 'weak-signal' | 'error';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

/** Extra controls next to the (coords, status, retry) triple. */
export interface GeoHelpers {
  /** Re-reads the position from scratch ("Perbarui Lokasi"). Same as `retry`. */
  refresh: () => void;
  /** When the current fix arrived (epoch ms), or null before the first one. */
  updatedAt: number | null;
  /** Why there is no fix, for copy (lib/check-in-copy describeGeoError). */
  errorKind: GeoErrorKind | null;
  /** The browser's permission state for location ('prompt' = the person has not answered yet), or
   * null where the Permissions API cannot say (older Safari). Lets the screen say "tap Izinkan" while
   * the prompt is open instead of an anonymous "searching". */
  permission: PermissionState | null;
  /**
   * A position read right now (a fix at most 10 s old, else a new one). The coordinates a punch sends are ALWAYS this one,
   * never the fix from when the page opened: a person who walked to the office after the first
   * reading is no longer rejected for where they were a minute ago. It rejects when the device
   * cannot answer in time (the caller may fall back to the last fix it has) or the permission is denied.
   */
  getFreshPosition: (timeoutMs?: number) => Promise<GeoCoords>;
}

export interface GeoPermissionGateProps {
  /** `retry` asks for the position again — the "Coba Lagi" after 'denied' (once the user
   * re-enables the permission; browsers then answer without a reload) or 'error', and the
   * "Perbarui Lokasi" button. */
  children: (coords: GeoCoords | null, status: GeoStatus, retry: () => void, helpers: GeoHelpers) => ReactNode;
  /** PRD.md US-01: accuracy worse than 100 m is a weak signal. */
  weakSignalThresholdM?: number;
}

const DEFAULT_WEAK_SIGNAL_THRESHOLD_M = 100;
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
// A punch reads the position once more right before sending. The watch keeps the browser's own
// position cache current, so a read that accepts a fix up to 10 s old returns at once in a real
// browser and still never sends where the person was a minute ago.
const FRESH_FIX_MAX_AGE_MS = 10_000;

function hasGeolocation(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

// Nothing to subscribe to: whether the API exists never changes while the page is open.
const subscribeNever = () => () => {};

function toCoords(position: GeolocationPosition): GeoCoords {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyM: position.coords.accuracy,
  };
}

/**
 * Pure geolocation logic wrapper for check-in/out (PRD.md US-01). Renders nothing itself beyond
 * the children render-prop — every status's UI is the caller's call.
 *
 * It WATCHES the position (watchPosition, maximumAge 0) instead of reading it once, so the
 * coordinates follow the person; the status always comes from the latest fix. A missed update
 * after a good fix is not an error (the device simply did not move), and when the permission is
 * granted later in the browser settings the Permissions API restarts the watch by itself.
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
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [errorKind, setErrorKind] = useState<GeoErrorKind | null>(null);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  // Bumped by retry() to restart the watch below, which is the one place that keeps it going.
  const [attempt, setAttempt] = useState(0);
  const coordsRef = useRef<GeoCoords | null>(null);
  const status: GeoStatus = supported ? geoStatus : 'error';

  // Mirrors `coords` for the callbacks that outlive a render (the watch's error handler), written
  // in an effect so nothing reads or writes a ref while rendering.
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const accept = useCallback(
    (next: GeoCoords) => {
      setCoords(next);
      setUpdatedAt(Date.now());
      setErrorKind(null);
      setStatus(next.accuracyM > weakSignalThresholdM ? 'weak-signal' : 'ok');
    },
    [weakSignalThresholdM],
  );

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!cancelled) accept(toCoords(position));
      },
      (error) => {
        if (cancelled) return;
        if (error.code === error.PERMISSION_DENIED) {
          setCoords(null);
          setErrorKind('denied');
          setStatus('denied');
          return;
        }
        // A missed update after a good fix keeps the fix; only "never had one" is an error.
        if (coordsRef.current) return;
        setErrorKind(error.code === error.TIMEOUT ? 'timeout' : 'unavailable');
        setStatus('error');
      },
      WATCH_OPTIONS,
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [supported, accept, attempt]);

  const retry = useCallback(() => {
    setStatus('loading');
    setErrorKind(null);
    setAttempt((n) => n + 1);
  }, []);

  // When the person flips the permission in the browser's site settings, restart without a reload.
  useEffect(() => {
    let watched: PermissionStatus | null = null;
    let cancelled = false;
    try {
      navigator.permissions
        ?.query({ name: 'geolocation' })
        .then((result) => {
          if (cancelled) return;
          watched = result;
          setPermission(result.state);
          result.onchange = () => {
            setPermission(result.state);
            if (result.state === 'granted') {
              setStatus('loading');
              setErrorKind(null);
              setAttempt((n) => n + 1);
            } else if (result.state === 'denied') {
              setCoords(null);
              setErrorKind('blocked');
              setStatus('denied');
            }
          };
        })
        .catch(() => {});
    } catch {
      // Safari throws on an unsupported permission name; the watch's own error path covers it.
    }
    return () => {
      cancelled = true;
      if (watched) watched.onchange = null;
    };
  }, []);

  const getFreshPosition = useCallback(
    (timeoutMs = 5000) =>
      new Promise<GeoCoords>((resolve, reject) => {
        if (!hasGeolocation()) {
          reject(new Error('unsupported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const next = toCoords(position);
            accept(next);
            resolve(next);
          },
          (error) => reject(error),
          { enableHighAccuracy: true, maximumAge: FRESH_FIX_MAX_AGE_MS, timeout: timeoutMs },
        );
      }),
    [accept],
  );

  return children(coords, status, retry, {
    refresh: retry,
    updatedAt,
    permission,
    errorKind: supported ? errorKind : 'unsupported',
    getFreshPosition,
  });
}
