'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export interface LinkTabItem {
  key: string;
  label: string;
  href: string;
  /** Optional count shown after the label (a number of records behind the tab). */
  count?: number;
}

export interface LinkTabsProps {
  items: LinkTabItem[];
  activeKey: string;
  'aria-label': string;
  className?: string;
}

/**
 * Query-string tabs for Server Component pages: each tab is a real link, so the active tab is in
 * the URL (shareable, back button works) and the page re-renders on the server. (A client leaf only
 * so the bar can keep the active tab in view on a phone.) Not an ARIA tab
 * widget (there is no roving focus or panel wiring); it is a nav of links with aria-current,
 * which is the pattern that stays correct when each "panel" is a whole new page render.
 */
export default function LinkTabs({ items, activeKey, className, ...rest }: LinkTabsProps) {
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // On a phone the bar scrolls sideways; centre the active tab so the selected one is never the one
  // that is cut off. Only the bar's own scrollLeft is touched (scrollIntoView could also scroll the
  // page down to a bar that sits below the fold).
  useEffect(() => {
    const nav = navRef.current;
    const tab = activeRef.current;
    if (!nav || !tab || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2;
  }, [activeKey]);

  return (
    <nav
      ref={navRef}
      aria-label={rest['aria-label']}
      className={`flex shrink-0 gap-0.5 self-start overflow-x-auto rounded-input border border-border bg-surface p-0.5 max-w-full ${className ?? ''}`}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Link
            key={item.key}
            ref={active ? activeRef : undefined}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-sm font-medium transition-colors pointer-coarse:h-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              active ? 'bg-secondary text-secondary-fg shadow-xs' : 'text-muted hover:bg-accent hover:text-text'
            }`}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="rounded-full bg-accent px-1.5 text-xs tabular-nums text-text">{item.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
