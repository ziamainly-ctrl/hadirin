'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Menu, X } from 'lucide-react';
import ThemeToggle from '@/components/shared/ThemeToggle';

const LINKS = [
  { href: '/#fitur', label: 'Fitur' },
  { href: '/pricing', label: 'Harga' },
  { href: '/about', label: 'Tentang Kami' },
];

export interface MarketingNavProps {
  /** From app/(marketing)/layout.tsx's own session check — see its getDashboardHref(). */
  dashboardHref: string | null;
}

/**
 * Client leaf for app/(marketing)/layout.tsx's header: the nav links, the theme
 * toggle, and a mobile menu — the parent header/logo stay a plain Server Component.
 * Below `sm` the nav links were a fixed-width flex row with no collapse, so a long
 * label or a narrow phone could overflow the bar; this swaps them for a hamburger
 * panel instead of trusting the row to always fit.
 */
export default function MarketingNav({ dashboardHref }: MarketingNavProps) {
  const [open, setOpen] = useState(false);

  const cta = dashboardHref ? (
    <Link
      href={dashboardHref}
      className="inline-flex items-center gap-1.5 rounded-input bg-primary px-4 py-2 font-medium text-primary-fg hover:opacity-90"
    >
      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
      Buka Dashboard
    </Link>
  ) : (
    <>
      <Link href="/login" className="text-text hover:text-primary">
        Masuk
      </Link>
      <Link
        href="/register"
        className="rounded-input bg-primary px-4 py-2 font-medium text-primary-fg hover:opacity-90"
      >
        Mulai Gratis
      </Link>
    </>
  );

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <nav className="hidden items-center gap-4 text-sm sm:flex">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-text hover:text-primary">
            {link.label}
          </Link>
        ))}
        {cta}
      </nav>

      <ThemeToggle />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:hidden"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-16 z-40 border-b border-black/5 bg-surface p-4 shadow-sm dark:border-white/10 sm:hidden">
          <nav className="flex flex-col gap-3 text-sm">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="text-text hover:text-primary">
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-1" onClick={() => setOpen(false)}>
              {cta}
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
