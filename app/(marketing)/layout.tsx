import Link from 'next/link';
import Logo from '@/components/shared/Logo';
import { getDashboardHref } from './dashboard-href';
import MarketingNav from './marketing-nav';

// The header's destinations again, so a visitor has a way around the site from the footer too
// (on phones the header links sit behind the hamburger).
const FOOTER_LINKS = [
  { href: '/fitur', label: 'Fitur' },
  { href: '/pricing', label: 'Harga' },
  { href: '/about', label: 'Tentang Kami' },
  { href: '/check-in', label: 'Check-in' },
  { href: '/bantuan', label: 'Bantuan' },
];

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const dashboardHref = await getDashboardHref();

  return (
    // lg:h-dvh + overflow-hidden: on desktop the site is one viewport tall and never scrolls
    // (the header and the one-line footer stay put). <main> is the inner region; pages center
    // themselves in it, and it only scrolls as a safety net on a very short window.
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      {/* Skip link (WCAG 2.4.1 Bypass Blocks): the first tab stop, visible only while focused, so a
          keyboard user can jump past the logo, five links and three buttons straight to the page. */}
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-input focus:border focus:border-border focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-text focus:shadow-lg focus:outline-none focus:ring-[3px] focus:ring-ring/50"
      >
        Lewati ke konten utama
      </a>
      <header className="sticky top-0 z-40 shrink-0 border-b border-border bg-surface/90 backdrop-blur-md lg:static">
        <div className="fit-slim-head mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link
            href="/"
            aria-label="Hadirin — beranda"
            className="flex shrink-0 items-center rounded-input py-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Logo className="text-lg" />
          </Link>
          <MarketingNav dashboardHref={dashboardHref} />
        </div>
      </header>
      <main id="konten" tabIndex={-1} className="bg-dot-grid flex flex-1 flex-col focus:outline-none lg:min-h-0 lg:overflow-y-auto">
        {children}
      </main>
      <footer className="shrink-0 border-t border-border bg-surface/90 backdrop-blur-md">
        <div className="fit-slim-foot mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-3 text-xs text-muted sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} Hadirin<span className="hidden sm:inline">. Absensi GPS + selfie untuk UMKM Indonesia.</span>
          </p>
          <nav aria-label="Menu footer" className="flex flex-wrap justify-center gap-x-5">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-input py-1 transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:py-3"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
