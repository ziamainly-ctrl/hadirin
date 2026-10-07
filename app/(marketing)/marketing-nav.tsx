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

const LINKS: NavLink[] = [
  { href: '/#fitur', label: 'Fitur' },
  { href: '/pricing', label: 'Harga' },
  { href: '/about', label: 'Tentang Kami' },
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
 * The three links are text-only and light up as a secondary pill when current. Sign in and
 * Sign up are real buttons (outlined and filled) so they never read as a "current page"
 * tab — they're actions, not places.
 */
export default function MarketingNav({ dashboardHref }: MarketingNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [featuresInView, setFeaturesInView] = useState(false);

  // "Fitur" is an anchor on the home page, not a route of its own, so its active state
  // follows the #fitur section being on screen. The state is only read while on '/', so
  // there is nothing to reset when leaving: coming back remounts the section and the
  // observer reports its visibility again immediately.
  useEffect(() => {
    if (pathname !== '/') return;
    const section = document.getElementById('fitur');
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setFeaturesInView(Boolean(entry?.isIntersecting)), {
      rootMargin: '-35% 0px -55% 0px',
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function isActive(href: string): boolean {
    if (href === '/#fitur') return pathname === '/' && featuresInView;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function ariaCurrent(link: NavLink, active: boolean) {
    if (!active) return undefined;
    return link.href.includes('#') ? 'location' : 'page';
  }

  function linkClasses(active: boolean, extra = ''): string {
    return `rounded-input px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-secondary text-secondary-fg' : 'text-muted hover:bg-accent hover:text-text'
    } ${extra}`;
  }

  const actions = dashboardHref ? (
    <ButtonLink href={dashboardHref} size="sm" onClick={() => setOpen(false)}>
      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
      Buka Dashboard
    </ButtonLink>
  ) : (
    <>
      <ButtonLink href="/login" variant="outline" size="sm" onClick={() => setOpen(false)}>
        Sign in
      </ButtonLink>
      <ButtonLink href="/register" size="sm" onClick={() => setOpen(false)}>
        Sign up
      </ButtonLink>
    </>
  );

  return (
    <>
      <nav aria-label="Menu utama" className="hidden items-center gap-1 md:flex">
        {LINKS.map((link) => {
          const active = isActive(link.href);
          return (
            <Link key={link.href} href={link.href} aria-current={ariaCurrent(link, active)} className={linkClasses(active)}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <div className="hidden items-center gap-2 md:flex">{actions}</div>
        <IconButton
          label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </IconButton>
      </div>

      {open ? (
        <div className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface p-4 shadow-lg md:hidden">
          <nav aria-label="Menu utama" className="mx-auto flex max-w-5xl flex-col gap-1">
            {LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={ariaCurrent(link, active)}
                  className={linkClasses(active, 'py-2.5')}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4 [&>a]:h-10 [&>a]:w-full">{actions}</div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
