import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import Logo from '@/components/shared/Logo';
import MarketingNav from './marketing-nav';

/** Null for an anonymous visitor (the common case — this layout wraps public pages with
 * no session requirement of their own). A signed-in visitor sees "Buka Dashboard" instead
 * of Sign in / Sign up, mirroring how most SaaS marketing headers treat a returning user
 * (e.g. firecrawl.dev shows "Dashboard" once signed in, "Sign up" otherwise) — EMPLOYEE
 * lands on /m, every other role on /app, matching each role's own home per their sidebar. */
async function getDashboardHref(): Promise<string | null> {
  try {
    const { role } = await requireSession();
    return role === 'EMPLOYEE' ? '/m' : '/app';
  } catch {
    return null;
  }
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const dashboardHref = await getDashboardHref();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <Link href="/" aria-label="Hadirin — beranda" className="flex shrink-0 items-center">
            <Logo className="text-lg" />
          </Link>
          <MarketingNav dashboardHref={dashboardHref} />
        </div>
      </header>
      <main className="bg-dot-grid flex-1">{children}</main>
      <footer className="border-t border-border bg-surface py-8 text-center text-sm text-muted">
        © {new Date().getFullYear()} Hadirin. Absensi GPS + selfie untuk UMKM Indonesia.
      </footer>
    </div>
  );
}
