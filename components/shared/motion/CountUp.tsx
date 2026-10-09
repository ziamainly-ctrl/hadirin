'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface CountUpProps {
  value: number;
  /** BCP 47 locale. Default id-ID. */
  locale?: string;
  /** Intl.NumberFormat options: `{ style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }`,
   * `{ style: 'percent' }`, `{ maximumFractionDigits: 1 }`. Plain data on purpose: a formatter
   * function cannot be passed from a Server Component to a client one. Omitted, the number is shown
   * with as many decimals as `value` has (none for an integer), also while it counts. */
  options?: Intl.NumberFormatOptions;
  prefix?: string;
  suffix?: string;
  /** Milliseconds. Default 600. */
  duration?: number;
  className?: string;
}

// Nothing to subscribe to: "are we past hydration" only ever goes false -> true once.
const subscribeNever = () => () => {};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const getReduced = () => window.matchMedia(REDUCED_MOTION).matches;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// How many decimals the target value itself has (0 for 128, 1 for 94.5), capped at 3. With no
// `options` the counter shows exactly that many, so a count to 128 never flashes "47,3" on the way.
function fractionDigits(n: number) {
  const text = String(n);
  const dot = text.indexOf('.');
  return dot < 0 || text.includes('e') ? 0 : Math.min(3, text.length - dot - 1);
}

/**
 * A number that counts up to its value in ~600ms (requestAnimationFrame, ease-out), and again from
 * the old value to the new one whenever `value` changes (a live dashboard polling every 30s).
 *
 * The final value is always what the HTML says: the server renders it, a browser without JS shows
 * it, `prefers-reduced-motion` shows it, and during hydration of a hard load it is left alone (no
 * jump from the right number to 0 and back up). The count runs only for a component that mounts on
 * the client after that (a page reached by navigation, a dashboard whose data just arrived) and
 * for later changes of `value`. Formatting is Intl, so it matches the rest of the app (`id-ID`
 * groups thousands with dots).
 *
 *   <CountUp value={128} />
 *   <CountUp value={12500000} options={{ style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }} />
 *   <CountUp value={0.94} options={{ style: 'percent' }} />
 */
export default function CountUp({
  value,
  locale = 'id-ID',
  options,
  prefix = '',
  suffix = '',
  duration = 600,
  className,
}: CountUpProps) {
  // false on the server and while hydrating, true on a fresh client mount: told apart without an
  // effect, so the very first client render of a fresh mount can already show the starting 0.
  const fresh = useSyncExternalStore(subscribeNever, () => true, () => false);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);
  const [current, setCurrent] = useState(() => (fresh ? 0 : value));
  // What is on screen right now, so a change of `value` mid-count continues from there. Written
  // only inside the animation frame callback, read only in the effect.
  const shownRef = useRef(current);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) return;
    const from = shownRef.current;
    if (from === value) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = t >= 1 ? value : from + (value - from) * easeOutCubic(t);
      shownRef.current = next;
      setCurrent(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  const display = reduced || !Number.isFinite(value) ? value : current;
  return (
    <span className={`tabular-nums ${className ?? ''}`}>
      {prefix}
      {new Intl.NumberFormat(locale, options ?? { maximumFractionDigits: fractionDigits(value) }).format(display)}
      {suffix}
    </span>
  );
}
