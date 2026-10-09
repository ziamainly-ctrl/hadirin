'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoCoords } from '@/components/shared/GeoPermissionGate';
import { distanceM } from '@/lib/geo';
import type { PrecheckResult } from '@/lib/punch-types';

export interface PrecheckState {
  data: PrecheckResult | null;
  /** A request is in flight. */
  loading: boolean;
  /** The last request failed (offline, 429, 5xx): the screen falls back to the raw fix and the
   * server re-checks everything at submit time anyway. */
  failed: boolean;
}

const MOVE_THRESHOLD_M = 15;
const REFRESH_EVERY_MS = 30_000;

function accuracyClass(accuracyM: number): 'good' | 'weak' | 'too-low' {
  return accuracyM > 1000 ? 'too-low' : accuracyM > 100 ? 'weak' : 'good';
}

interface Sent {
  latitude: number;
  longitude: number;
  accuracyM: number;
  at: number;
  nonce: number;
}

/**
 * Asks POST /api/attendance/precheck what a punch from the current position would do. The server
 * answers (branch, distance, inside/outside, allowed); this hook only decides WHEN to ask: on the
 * first fix, after the person moves more than 15 m, when the accuracy changes class, on a manual
 * refresh (`nonce`), and every 30 s while the tab is visible. One request at a time.
 */
export function usePrecheck({ coords, enabled, nonce }: { coords: GeoCoords | null; enabled: boolean; nonce: number }): PrecheckState {
  const [state, setState] = useState<PrecheckState>({ data: null, loading: false, failed: false });
  const inFlight = useRef(false);
  // A position change that arrived while a request was in flight: ask again once it returns.
  const queued = useRef(false);
  const last = useRef<Sent | null>(null);
  const latest = useRef<{ coords: GeoCoords | null; nonce: number }>({ coords, nonce });
  const mounted = useRef(true);

  useEffect(() => {
    latest.current = { coords, nonce };
  }, [coords, nonce]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const send = useCallback(async () => {
    if (!latest.current.coords || !mounted.current) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    try {
      // Loops while a newer position arrived during the request, so the answer on screen always
      // belongs to the latest fix (walking to the office and tapping "Perbarui Lokasi" must update it).
      do {
        queued.current = false;
        const current = latest.current;
        const c = current.coords;
        if (!c) break;
        last.current = { latitude: c.latitude, longitude: c.longitude, accuracyM: c.accuracyM, at: Date.now(), nonce: current.nonce };
        setState((prev) => ({ ...prev, loading: true }));
        try {
          const res = await fetch('/api/attendance/precheck', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: c.latitude,
              longitude: c.longitude,
              accuracyM: Math.max(1, Math.round(c.accuracyM)),
            }),
          });
          const json = (await res.json()) as { data?: PrecheckResult };
          if (!mounted.current) return;
          if (res.ok && json.data) setState({ data: json.data, loading: false, failed: false });
          else setState((prev) => ({ ...prev, loading: false, failed: true }));
        } catch {
          if (mounted.current) setState((prev) => ({ ...prev, loading: false, failed: true }));
        }
      } while (queued.current && mounted.current);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Position changes: ask again when it matters.
  useEffect(() => {
    if (!enabled || !coords) return;
    const prev = last.current;
    const moved = prev ? distanceM(prev.latitude, prev.longitude, coords.latitude, coords.longitude) > MOVE_THRESHOLD_M : true;
    const classChanged = prev ? accuracyClass(prev.accuracyM) !== accuracyClass(coords.accuracyM) : true;
    const forced = prev ? prev.nonce !== nonce : true;
    if (moved || classChanged || forced) void send();
  }, [enabled, coords, nonce, send]);

  // And every 30 s while the tab is visible, so a long-open page does not show a stale answer.
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void send();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(id);
  }, [enabled, send]);

  return state;
}
