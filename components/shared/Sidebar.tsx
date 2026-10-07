'use client';

import { useEffect, useRef, useState } from 'react';
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

const DRAWER_ID = 'sidebar-drawer';

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
  const drawerRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const resolvedActivePath = activePath ?? pathname ?? '';

  // The drawer is a native modal <dialog> (same primitive as ui/Dialog): the browser traps Tab
  // inside it, makes the page behind inert, closes on Escape and puts it in the top layer
  // (above a toast popover that is already open). The old hand-rolled overlay had
  // aria-modal="true" but let focus wander out into the page behind it. app/globals.css
  // already freezes the page scroll while any dialog is open.
  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    if (mobileOpen && !el.open) el.showModal();
    else if (!mobileOpen && el.open) el.close();
  }, [mobileOpen]);

  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    // Escape and el.close() both fire 'close'; keep the open state in sync with either.
    const sync = () => setMobileOpen(false);
    el.addEventListener('close', sync);
    // Rotating a tablet or widening the window past lg swaps the drawer for the rail: an open
    // modal must not stay behind (it would keep the page inert under an invisible dialog).
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => {
      el.removeEventListener('close', sync);
      mq.removeEventListener('change', onChange);
    };
  }, []);

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
          // Icon-only in the collapsed rail: the title is the hover tooltip, aria-label the
          // accessible name (a title alone is not reliably announced).
          title={!showLabels ? item.label : undefined}
          aria-label={!showLabels ? item.label : undefined}
          // 40px rows in the touch drawer (below lg), the denser 36px rail on desktop.
          className={`flex items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:py-2 lg:pointer-coarse:py-2.5 ${
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
      {/* Below lg: a real top app bar (menu, brand, theme), not a lone floating button — the
          floating one sat on top of page content as soon as the page scrolled. h-14 matches
          the /m header; the layouts pad <main> by pt-18 (56px bar + 16px) to clear it. */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-3 lg:hidden">
        <IconButton
          label="Buka menu"
          size="lg"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls={DRAWER_ID}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <span className="text-sm">{brand}</span>
        {/* Right-hand theme toggle, same as the /m header, so it is one tap away here too. */}
        <ThemeToggle className="ml-auto" />
      </div>

      {/* Always rendered (closed = display:none), opened by showModal(). open:flex because a
          plain `flex` would override the UA's display:none on a closed dialog; m-0 + h-dvh pin
          it to the left edge (a modal dialog is centered by default). */}
      <dialog
        ref={drawerRef}
        id={DRAWER_ID}
        aria-label="Menu navigasi"
        onClick={(e) => {
          if (e.target === drawerRef.current) setMobileOpen(false);
        }}
        className="drawer-in m-0 hidden h-dvh max-h-none w-72 max-w-[85vw] flex-col overflow-hidden border-r border-border bg-surface p-0 text-text shadow-xl open:flex backdrop:bg-black/50 lg:hidden"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pl-5 pr-2">
          {brand}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {/* autoFocus: keyboard and screen-reader users land on a control inside the drawer. */}
            <IconButton label="Tutup menu" onClick={() => setMobileOpen(false)} autoFocus>
              <X className="h-5 w-5" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
        <nav aria-label="Menu utama" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {renderNavItems(true)}
        </nav>
        {logout ? (
          <div className="border-t border-border p-2">
            <LogoutButton logoutUrl={logout.url} redirectTo={logout.redirectTo} />
          </div>
        ) : null}
      </dialog>

      <aside
        className={`sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface transition-[width] motion-reduce:transition-none lg:flex ${
          collapsed ? 'w-16' : 'w-60'
        } ${className ?? ''}`}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 border-b border-border p-3">
            <Logo iconOnly />
            <IconButton label="Perluas sidebar" size="sm" onClick={() => setCollapsed(false)}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            {/* The expanded header has the theme toggle; collapsing must not take it away. */}
            <ThemeToggle />
          </div>
        ) : (
          // pl-5 = nav padding (8) + link padding (12): the mascot's left edge lines up with the nav icons;
          // pr-2 lines the buttons up with the right edge of the nav pills.
          <div className="flex items-center justify-between border-b border-border py-3 pl-5 pr-2">
            {brand}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <IconButton label="Perkecil sidebar" size="sm" onClick={() => setCollapsed(true)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        )}
        <nav aria-label="Menu utama" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {renderNavItems(!collapsed)}
        </nav>
        {logout ? (
          <div className="border-t border-border p-2">
            <LogoutButton logoutUrl={logout.url} redirectTo={logout.redirectTo} showLabel={!collapsed} />
          </div>
        ) : null}
      </aside>
    </>
  );
}
