import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import MarketingNav from './marketing-nav';

/** Null for an anonymous visitor (the common case — this layout wraps public pages with
 * no session requirement of their own). A signed-in visitor sees "Buka Dashboard" instead
 * of Masuk/Mulai Gratis, mirroring how most SaaS marketing headers treat a returning user
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
      <header className="relative border-b border-black/5 bg-surface dark:border-white/10">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold text-primary">
            Hadirin
          </Link>
          <MarketingNav dashboardHref={dashboardHref} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/5 bg-surface py-8 text-center text-sm text-muted dark:border-white/10">
        © {new Date().getFullYear()} Hadirin. Absensi GPS + selfie untuk UMKM Indonesia.
      </footer>
    </div>
  );
}
