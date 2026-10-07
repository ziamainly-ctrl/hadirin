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
import LogoutButton from './LogoutButton';
import Logo from './Logo';
import IconButton from '@/components/ui/IconButton';

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
  /** Plain strings, not a pre-built LogoutButton element or a render-prop function —
   * same reason `icon` is a string key (see ICONS above): this is a Server Component
   * prop, and only serializable data may cross that boundary. Sidebar renders
   * LogoutButton itself, the same way it already resolves `items[].icon` itself. */
  logout?: { url: string; redirectTo: string };
  className?: string;
}

/**
 * Generic nav shell for /app and /platform layouts: icon-only collapse on
 * desktop, off-canvas drawer on mobile (TRD.md §14). Callers supply `items`;
 * this component holds no app/admin/platform-specific nav content.
 */
export default function Sidebar({ items, activePath, header, logout, className }: SidebarProps) {
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

  // The root item (e.g. /app) is a string-prefix of literally every other item's href
  // (/app/employees, /app/branches, ...), so a naive per-item "exact match OR starts
  // with href + '/'" check marks BOTH the root item and the real current page active at
  // once on any sub-page — caught live: Dashboard and Karyawan both lit at the same time
  // while on /app/employees. The fix is "longest matching href wins", the same rule
  // most routers use for nested active-link matching, computed once instead of
  // per-item so every item agrees on the one winner.
  const activeHref = items.reduce<string | null>((best, item) => {
    const matches = resolvedActivePath === item.href || resolvedActivePath.startsWith(`${item.href}/`);
    if (!matches) return best;
    if (best === null || item.href.length > best.length) return item.href;
    return best;
  }, null);

  function isActive(href: string) {
    return href === activeHref;
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
            active ? 'bg-secondary text-secondary-fg' : 'text-muted hover:bg-accent hover:text-text'
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {showLabels ? <span className="truncate">{item.label}</span> : null}
        </Link>
      );
    });
  }

  const brand = header ?? <Logo />;

  return (
    <>
      <IconButton
        label="Buka menu"
        size="lg"
        variant="outline"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 shadow-sm lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </IconButton>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="relative flex h-full w-64 flex-col bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border p-3">
              {brand}
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <IconButton label="Tutup menu" size="sm" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" aria-hidden="true" />
                </IconButton>
              </div>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">{renderNavItems(true)}</nav>
            {logout ? (
              <div className="border-t border-border p-2">
                <LogoutButton logoutUrl={logout.url} redirectTo={logout.redirectTo} />
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      <aside
        className={`sticky top-0 hidden h-screen flex-col border-r border-border bg-surface transition-[width] lg:flex ${
          collapsed ? 'w-16' : 'w-60'
        } ${className ?? ''}`}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 border-b border-border p-3">
            <Logo iconOnly />
            <IconButton label="Perluas sidebar" size="sm" onClick={() => setCollapsed(false)}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-border p-3">
            {brand}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <IconButton label="Perkecil sidebar" size="sm" onClick={() => setCollapsed(true)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        )}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">{renderNavItems(!collapsed)}</nav>
        {logout ? (
          <div className="border-t border-border p-2">
            <LogoutButton logoutUrl={logout.url} redirectTo={logout.redirectTo} showLabel={!collapsed} />
          </div>
        ) : null}
      </aside>
    </>
  );
}
