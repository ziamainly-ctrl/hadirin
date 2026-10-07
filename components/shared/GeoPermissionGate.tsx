'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type GeoStatus = 'loading' | 'ok' | 'denied' | 'weak-signal' | 'error';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

export interface GeoPermissionGateProps {
  children: (coords: GeoCoords | null, status: GeoStatus) => ReactNode;
  /** PRD.md US-01: accuracy worse than 100 m is a weak signal. */
  weakSignalThresholdM?: number;
}

const DEFAULT_WEAK_SIGNAL_THRESHOLD_M = 100;

function hasGeolocation(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Pure geolocation logic wrapper for check-in/out (PRD.md US-01). Renders
 * nothing itself beyond the children render-prop — every status's UI is the
 * caller's call.
 */
export default function GeoPermissionGate({
  children,
  weakSignalThresholdM = DEFAULT_WEAK_SIGNAL_THRESHOLD_M,
}: GeoPermissionGateProps) {
  // "No geolocation API" is knowable at render time, so it's the lazy initial
  // state rather than a setState call inside the effect below (which would
  // otherwise trip react-hooks/set-state-in-effect for a value that never
  // actually changes after mount).
  const [status, setStatus] = useState<GeoStatus>(() => (hasGeolocation() ? 'loading' : 'error'));
  const [coords, setCoords] = useState<GeoCoords | null>(null);

  useEffect(() => {
    if (!hasGeolocation()) return;

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
  }, [weakSignalThresholdM]);

  return children(coords, status);
}
