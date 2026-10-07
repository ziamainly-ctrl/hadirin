'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LayoutDashboard,
  CalendarCheck,
  Users,
  MapPin,
  Clock,
  ListChecks,
  FileBarChart,
  Settings,
  Building2,
  CreditCard,
  Package,
  MessageSquare,
  CalendarDays,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

// A Server Component layout (app/app/layout.tsx, app/platform/(authenticated)/layout.tsx)
// builds `items` and passes it into this 'use client' component — a Lucide icon is a
// function (forwardRef component), and React Server Components cannot pass a function
// across the server→client boundary ("Functions cannot be passed directly to Client
// Components", caught against the real OWNER account: every /app/* page 500'd on this).
// `icon` is a plain string key instead, resolved to the real component only in here,
// client-side, where a function value is fine.
const ICONS = {
  LayoutDashboard,
  CalendarCheck,
  Users,
  MapPin,
  Clock,
  ListChecks,
  FileBarChart,
  Settings,
  Building2,
  CreditCard,
  Package,
  MessageSquare,
  CalendarDays,
} as const;

export type SidebarIconName = keyof typeof ICONS;

export interface SidebarItem {
  href: string;
  label: string;
  icon: SidebarIconName;
}

export interface SidebarProps {
  items: SidebarItem[];
  /** Pass usePathname() from the caller, or omit it to let Sidebar call it itself. */
  activePath?: string;
  header?: ReactNode;
  className?: string;
}

/**
 * Generic nav shell for /app and /platform layouts: icon-only collapse on
 * desktop, off-canvas drawer on mobile (TRD.md §14). Callers supply `items`;
 * this component holds no app/admin/platform-specific nav content.
 */
export default function Sidebar({ items, activePath, header, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const resolvedActivePath = activePath ?? pathname ?? '';

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  function isActive(href: string) {
    return resolvedActivePath === href || resolvedActivePath.startsWith(`${href}/`);
  }

  function renderNavItems(showLabels: boolean) {
    return items.map((item) => {
      const Icon = ICONS[item.icon];
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          aria-current={active ? 'page' : undefined}
          title={!showLabels ? item.label : undefined}
          className={`flex items-center gap-3 rounded-input px-3 py-2 text-sm font-medium transition-colors ${
            active ? 'bg-primary text-primary-fg' : 'text-text hover:bg-bg'
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {showLabels ? <span className="truncate">{item.label}</span> : null}
        </Link>
      );
    });
  }

  const brand = header ?? <span className="font-semibold text-text">Hadirin</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Buka menu"
        className="fixed left-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-input border border-black/10 bg-surface text-text shadow-sm dark:border-white/10 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="relative flex h-full w-64 flex-col bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-black/10 p-3 dark:border-white/10">
              {brand}
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Tutup menu"
                  className="rounded-full p-1 text-muted hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">{renderNavItems(true)}</nav>
          </aside>
        </div>
      ) : null}

      <aside
        className={`sticky top-0 hidden h-screen flex-col border-r border-black/10 bg-surface transition-[width] dark:border-white/10 lg:flex ${
          collapsed ? 'w-16' : 'w-60'
        } ${className ?? ''}`}
      >
        <div className="flex items-center justify-between border-b border-black/10 p-3 dark:border-white/10">
          {collapsed ? null : brand}
          <div className="flex items-center gap-1">
            {collapsed ? null : <ThemeToggle />}
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
              className="rounded-full p-1 text-muted hover:bg-black/5 dark:hover:bg-white/10"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">{renderNavItems(!collapsed)}</nav>
      </aside>
    </>
  );
}
