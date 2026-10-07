'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Menu, X } from 'lucide-react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import ButtonLink from '@/components/ui/ButtonLink';
import IconButton from '@/components/ui/IconButton';

interface NavLink {
  href: string;
  label: string;
}

// Five separate pages, one per link; "Check-in" sends a signed-out visitor to /login and back.
// The links sit in the header from lg up; below it they move into the hamburger panel.
const LINKS: NavLink[] = [
  { href: '/fitur', label: 'Fitur' },
  { href: '/pricing', label: 'Harga' },
  { href: '/about', label: 'Tentang Kami' },
  { href: '/check-in', label: 'Check-in' },
  { href: '/bantuan', label: 'Bantuan' },
];

export interface MarketingNavProps {
  /** From app/(marketing)/layout.tsx's own session check — see its getDashboardHref(). */
  dashboardHref: string | null;
}

/**
 * Client leaf for app/(marketing)/layout.tsx's header: nav links with an active state, the
 * theme toggle, the Sign in / Sign up (or Buka Dashboard) actions, and a mobile menu. It
 * renders as a fragment of flex items so the layout's header row stays one line: logo,
 * links, then everything else pushed to the right.
 *
 * The five links are text-only and light up as a secondary pill when current. Sign in and
 * Sign up are real buttons (outlined and filled) so they never read as a "current page"
 * tab — they're actions, not places.
 */
export default function MarketingNav({ dashboardHref }: MarketingNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function ariaCurrent(active: boolean) {
    return active ? 'page' : undefined;
  }

  // The size classes come in through `extra` (desktop pill vs. the taller, larger mobile
  // row) rather than being overridden after the fact, which Tailwind can't order reliably.
  function linkClasses(active: boolean, extra: string): string {
    return `rounded-input px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
      active ? 'bg-secondary text-secondary-fg' : 'text-muted hover:bg-accent hover:text-text'
    } ${extra}`;
  }

  // pointer-coarse:h-10: from md up this is also the header of a touch tablet, where a 32px
  // button is under the 40-44px touch target; mouse users keep the compact size="sm". In the
  // mobile panel the wrapper's [&>a]:h-11 (a more specific selector) still wins.
  const actions = dashboardHref ? (
    <ButtonLink href={dashboardHref} size="sm" className="pointer-coarse:h-10" onClick={() => setOpen(false)}>
      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
      Buka Dashboard
    </ButtonLink>
  ) : (
    <>
      <ButtonLink href="/login" variant="outline" size="sm" className="pointer-coarse:h-10" onClick={() => setOpen(false)}>
        Sign in
      </ButtonLink>
      <ButtonLink href="/register" size="sm" className="pointer-coarse:h-10" onClick={() => setOpen(false)}>
        Sign up
      </ButtonLink>
    </>
  );

  return (
    <>
      <nav aria-label="Menu utama" className="hidden items-center gap-1 lg:flex">
        {LINKS.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={ariaCurrent(active)}
              className={linkClasses(active, 'py-1.5 text-sm pointer-coarse:py-2.5')}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <div className="hidden items-center gap-2 lg:flex">{actions}</div>
        <IconButton
          label={open ? 'Tutup menu' : 'Buka menu'}
          size="lg"
          aria-expanded={open}
          aria-controls="marketing-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </IconButton>
      </div>

      {open ? (
        <>
          {/* Scrim under the panel: dims the page so the open menu reads as a layer on top,
              and tapping anywhere outside the panel closes it (the usual mobile-menu
              behavior) instead of leaving it stuck open over the content. Absolute + a viewport
              height rather than `fixed`: the header's backdrop-blur makes it the containing
              block for fixed descendants, so `fixed` would only cover the header itself. */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-x-0 top-full z-30 h-[calc(100dvh-4rem)] bg-bg/70 backdrop-blur-sm lg:hidden"
          />
          <div
            id="marketing-mobile-menu"
            className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface p-4 shadow-lg lg:hidden"
          >
            <nav aria-label="Menu utama" className="mx-auto flex max-w-5xl flex-col gap-1">
              {LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={ariaCurrent(active)}
                    className={linkClasses(active, 'flex min-h-11 items-center text-base')}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {/* h-11: 44px, the minimum touch target (Apple HIG / WCAG 2.5.5); the header's
                  desktop size="sm" buttons are mouse-sized and too small for a thumb. */}
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4 [&>a]:h-11 [&>a]:w-full [&>a]:text-base">
                {actions}
              </div>
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
