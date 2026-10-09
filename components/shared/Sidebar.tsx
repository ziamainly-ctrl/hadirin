'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
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
  Radio,
  Fingerprint,
  ClockAlert,
  MapPinOff,
  Images,
  Trophy,
  ChartNoAxesCombined,
  ScrollText,
  History,
  CircleUser,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';
import Logo from './Logo';
import IconButton from '@/components/ui/IconButton';
import { groupBySection } from '@/lib/group-by-section';
import { resolveActiveHref } from '@/lib/nav-active';

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
  Radio,
  Fingerprint,
  ClockAlert,
  MapPinOff,
  Images,
  Trophy,
  ChartNoAxesCombined,
  ScrollText,
  History,
  CircleUser,
} as const;

export type SidebarIconName = keyof typeof ICONS;

const DRAWER_ID = 'sidebar-drawer';

export interface SidebarItem {
  href: string;
  label: string;
  icon: SidebarIconName;
  /** Shorter label for the two-column rail of a very short window (<= 629px of height), where
   * a ~75px label column would truncate the full one. The full label stays the tooltip. */
  shortLabel?: string;
  /** Heading of the group this item belongs to. A small uppercase heading is drawn whenever the
   * section changes from one item to the next (a thin divider in the collapsed rail); items
   * without one render as a plain list, as /platform's menu does. */
  section?: string;
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
 *
 * Desktop rail = ZERO SCROLL (TRD.md §14 "Desktop fit tiers"). The rail never scrolls and never
 * hides a destination behind the pinned logout row, whatever the window height: the item count
 * (`--sb-n`) and the section count (`--sb-g`) go to CSS as custom properties, and
 * app/globals.css ("Desktop fit tiers" block, `.sb*` classes) solves the row height from the
 * viewport height in pure CSS, so the very first server-rendered paint already fits:
 *   1. rows flex between 28px (floor) and 40px (comfortable);
 *   2. section headings only get the slack left above a 32px row, and shrink to a hairline
 *      divider, then to nothing, as the window gets shorter;
 *   3. the 19-item menu below ~630px of height becomes a two-column grid (labels kept, every
 *      destination still one click away, tooltips on each);
 *   4. the collapsed icon rail drops its logo mark and packs 22px rows.
 * The header and the logout row stay pinned and shrink (56px -> 44px) on windows <= 860px tall.
 * The touch drawer (below lg) is a different surface and keeps its own scroll.
 */
export default function Sidebar({ items, activePath, header, logout, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const drawerNavRef = useRef<HTMLElement>(null);
  const idPrefix = useId();
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

  // "Longest matching href wins" (lib/nav-active.ts): the root item (/app) is a string prefix of
  // every other href, so a per-item check would light Dashboard together with the real page.
  const activeHref = resolveActiveHref(items, resolvedActivePath);

  function isActive(href: string) {
    return href === activeHref;
  }

  // The touch drawer still scrolls (it is a phone/tablet surface): keep the current page visible
  // when it opens (the dialog is display:none until then, so there is nothing to scroll before).
  // 'nearest' moves the nav by the minimum needed and never touches the page behind it. The
  // desktop rail does not scroll at all, so it needs no such help.
  useEffect(() => {
    if (!mobileOpen) return;
    drawerNavRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeHref, mobileOpen]);

  const groups = useMemo(() => groupBySection(items), [items]);
  const count = items.length;
  const sectionCount = groups.filter((group) => group.section).length;
  // lg = the org-wide 19-item menu (it is the only one that can outgrow a 560px window and so
  // the only one with a grid tier), md = the 12-item manager menu, sm = /platform's five.
  const navSize = count >= 16 ? 'lg' : count >= 8 ? 'md' : 'sm';
  const railVars = {
    '--sb-n': Math.max(1, count),
    '--sb-g': Math.max(1, sectionCount),
    '--sb-rows': Math.max(1, Math.ceil(count / 2)),
  } as CSSProperties;

  function renderNavItems(showLabels: boolean, scope: 'rail' | 'drawer') {
    const rail = scope === 'rail';
    return groups.map((group, index) => {
      const links = group.items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            aria-current={active ? 'page' : undefined}
            // Icon-only in the collapsed rail: the title is the hover tooltip, aria-label the
            // accessible name (a title alone is not reliably announced). The big menu also
            // gets the tooltip while labelled, because its two-column tier truncates long labels.
            title={!showLabels || (rail && navSize === 'lg') ? item.label : undefined}
            aria-label={!showLabels ? item.label : undefined}
            // Drawer (below lg): 40px touch rows. Rail: `.sb-link` (app/globals.css) sets the height,
            // font and icon size from the viewport height, so no py-* here.
            className={`flex shrink-0 items-center gap-3 rounded-input px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              rail ? 'sb-link' : 'py-2.5'
            } ${active ? 'bg-secondary text-secondary-fg' : 'text-muted hover:bg-accent hover:text-text'}`}
          >
            <Icon className={rail ? 'shrink-0' : 'h-5 w-5 shrink-0'} aria-hidden="true" />
            {showLabels ? (
              <span className="truncate">
                {rail && item.shortLabel ? (
                  <>
                    <span className="sb-long">{item.label}</span>
                    <span className="sb-short">{item.shortLabel}</span>
                  </>
                ) : (
                  item.label
                )}
              </span>
            ) : null}
          </Link>
        );
      });

      // No section: a plain run of links (the /platform menu).
      if (!group.section) {
        return (
          <div key={`plain-${index}`} className={rail ? 'sb-group flex flex-col' : 'flex flex-col gap-1'}>
            {links}
          </div>
        );
      }

      const headingId = `${idPrefix}-${scope}-section-${index}`;
      return (
        <div
          key={`${group.section}-${index}`}
          role="group"
          aria-labelledby={showLabels ? headingId : undefined}
          aria-label={showLabels ? undefined : group.section}
          className={rail ? 'sb-group flex flex-col' : 'flex flex-col gap-1'}
        >
          {showLabels ? (
            // Muted, not decorative: 11px uppercase labels need the contrast of text-muted (AA on
            // the surface). In the rail the heading's height and font size come from the viewport
            // height (`.sb-heading`): full label, then a hairline, then nothing.
            <p
              id={headingId}
              data-first={index === 0 ? 'true' : undefined}
              className={`font-semibold uppercase tracking-wider text-muted ${
                rail ? 'sb-heading' : `px-3 pb-1 text-[11px] ${index === 0 ? 'pt-1' : 'pt-3'}`
              }`}
            >
              {group.section}
            </p>
          ) : index > 0 ? (
            <div role="separator" className={rail ? 'sb-heading' : 'mx-3 my-2 h-px bg-border'} />
          ) : null}
          {links}
        </div>
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
        <nav ref={drawerNavRef} aria-label="Menu utama" className="flex flex-1 flex-col overflow-y-auto overscroll-contain p-2">
          {renderNavItems(true, 'drawer')}
        </nav>
        {logout ? (
          <div className="border-t border-border p-2">
            <LogoutButton logoutUrl={logout.url} redirectTo={logout.redirectTo} />
          </div>
        ) : null}
      </dialog>

      <aside
        data-collapsed={collapsed ? 'true' : 'false'}
        data-nav-size={navSize}
        style={railVars}
        className={`sb sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface transition-[width] motion-reduce:transition-none lg:flex ${
          collapsed ? 'w-16' : 'w-60'
        } ${className ?? ''}`}
      >
        {collapsed ? (
          <div className="sb-head flex shrink-0 flex-col items-center justify-center gap-1 overflow-hidden border-b border-border">
            <span className="sb-logo-c">
              <Logo iconOnly />
            </span>
            <IconButton label="Perluas sidebar" size="sm" onClick={() => setCollapsed(false)}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            {/* The expanded header has the theme toggle; collapsing must not take it away. */}
            <ThemeToggle />
          </div>
        ) : (
          // pl-5 = nav padding (8) + link padding (12): the mascot's left edge lines up with the nav icons;
          // pr-2 lines the buttons up with the right edge of the nav pills.
          <div className="sb-head flex shrink-0 items-center justify-between overflow-hidden border-b border-border pl-5 pr-2">
            {brand}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <IconButton label="Perkecil sidebar" size="sm" onClick={() => setCollapsed(true)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        )}
        <nav aria-label="Menu utama" className="sb-nav flex min-h-0 flex-1 flex-col px-2">
          {renderNavItems(!collapsed, 'rail')}
        </nav>
        {logout ? (
          <div className="sb-foot shrink-0 border-t border-border">
            <LogoutButton logoutUrl={logout.url} redirectTo={logout.redirectTo} showLabel={!collapsed} />
          </div>
        ) : null}
      </aside>
    </>
  );
}
