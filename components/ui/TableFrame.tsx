'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface TableFrameProps {
  children: ReactNode;
  className?: string;
  /** Accessible name of the scroll region (Table passes its own aria-label). Defaults to "Tabel
   * data": the region is a keyboard tab stop whenever it can scroll, and a tab stop with no
   * name is announced as nothing at all. */
  label?: string;
}

/**
 * The card + scroll box around a <table> (components/ui/Table.tsx renders it; use Table, not
 * this). Two jobs:
 *
 * 1. Vertical fill. The frame is a flex column with `min-h-0` and the scroller inside it is
 *    `flex-1 min-h-0 overflow-auto`, so when a table is a direct child of a height-bound flex
 *    column (components/shared/Page.tsx's Page.Body on desktop) the frame shrinks to the
 *    space that is left and the rows scroll INSIDE it, with the header row pinned
 *    (position: sticky on the <th>, which sticks to the nearest scroller, i.e. this one).
 *    A sticky header only works when the scroller that sticks it is the one that actually
 *    scrolls vertically: an `overflow-x: auto` wrapper silently turns `overflow-y` into
 *    `auto` too, so the wrapper is always the sticky reference, which is why it must be the
 *    scroller that is height-constrained and not an ancestor. Where nothing bounds the height
 *    (a phone, a page that scrolls normally) the frame just grows with its rows.
 *
 * 2. Sideways scroll hint. A soft shadow on the edge that has more columns behind it, driven
 *    by two data attributes this component keeps in sync with the scroll position. The old
 *    CSS-only "scrolling shadows" trick painted flat surface-colored covers over a flat
 *    background, which cannot work on the gradient surface (the covers showed up as visible
 *    40px bands), so the shadows are real overlay elements now.
 */
export default function TableFrame({ children, className, label = 'Tabel data' }: TableFrameProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [scrollable, setScrollable] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    setScrollable(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // No direct measure() here: ResizeObserver reports the first size as soon as it starts
    // observing, which is the initial measurement (and keeps setState out of the effect body).
    el.addEventListener('scroll', measure, { passive: true });
    // The table inside changes width when columns/rows change (router.refresh, a drag), and
    // the scroller itself when the window or the sidebar resizes.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure]);

  return (
    <div
      className={`relative flex min-h-0 w-full flex-col overflow-hidden rounded-card border border-border bg-surface ${className ?? ''}`}
    >
      {/* A scroll region a keyboard user can't focus can't be scrolled by them either: when
          there is something to scroll it becomes a tab stop (arrow keys then scroll it). */}
      <div
        ref={scrollerRef}
        data-scroll-region=""
        tabIndex={scrollable ? 0 : undefined}
        role={scrollable ? 'region' : undefined}
        aria-label={scrollable ? label : undefined}
        className="min-h-0 w-full flex-1 overflow-auto overscroll-x-contain"
      >
        {children}
      </div>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-4 bg-[linear-gradient(to_right,var(--scroll-shadow),transparent)] transition-opacity duration-150 ${edges.left ? 'opacity-100' : 'opacity-0'}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-4 bg-[linear-gradient(to_left,var(--scroll-shadow),transparent)] transition-opacity duration-150 ${edges.right ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
