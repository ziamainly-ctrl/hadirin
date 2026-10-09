'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ScrollRegionProps {
  /** Accessible name of the region: it is announced as a landmark once it can scroll. */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * A vertically scrolling box (a feed, a list in a card) that is a keyboard tab stop ONLY while it
 * actually overflows. A scroll area a keyboard user cannot focus cannot be scrolled by them
 * either (WCAG 2.1.1), but a permanent tab stop on a box with nothing to scroll is noise, so it
 * is measured: the same rule components/ui/TableFrame applies to a table. Give it a bounded
 * height (a flex child with `min-h-0 flex-1`) and it scrolls inside; unbounded, it just grows.
 */
export default function ScrollRegion({ label, children, className }: ScrollRegionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setScrollable(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // ResizeObserver reports the first size as soon as it starts observing (the initial
    // measurement), and again when the box or its content (a refreshed feed) changes size.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => observer?.disconnect();
  }, [measure]);

  return (
    <div
      ref={ref}
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? 'region' : undefined}
      aria-label={scrollable ? label : undefined}
      className={`overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
