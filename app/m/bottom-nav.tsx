'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, ClipboardList, User } from 'lucide-react';

// TRD.md §14: "single-column with a bottom tab bar (Hari ini, Riwayat, Pengajuan, Profil)".
// Specific to /m, so it lives here rather than in components/shared.
const TABS = [
  { href: '/m', label: 'Hari ini', icon: Home },
  { href: '/m/history', label: 'Riwayat', icon: History },
  { href: '/m/requests', label: 'Pengajuan', icon: ClipboardList },
  { href: '/m/profile', label: 'Profil', icon: User },
];

/** "/m" only matches itself; every other tab also owns its sub-pages (/m/requests/new). */
function isActive(pathname: string, href: string): boolean {
  return href === '/m' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Material 3 navigation-bar pattern: the active tab gets a pill behind its icon (the same
 * bg-secondary pill as the marketing header's active link) plus a bolder label, so the
 * current tab is obvious from shape, not only from a grey-vs-black text color. Each tab is
 * the full bar height (72px) wide, well past the 44px touch-target minimum, and the bar
 * pads itself above the home indicator (layout.tsx sets viewport-fit=cover). From lg up the
 * bar is in-flow at the bottom of the one-viewport shell (not fixed), and on a short desktop
 * window it drops to 56px so the page above it keeps its room.
 */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:border-x lg:static lg:max-w-none lg:border-x-0"
    >
      <ul className="flex h-[4.5rem] [@media(min-width:1024px)_and_(max-height:860px)]:h-14">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 ${
                  active ? 'font-semibold text-text' : 'font-medium text-muted hover:text-text'
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-secondary' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
