import Link from 'next/link';
import MarketingNav from './marketing-nav';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative border-b border-black/5 bg-surface dark:border-white/10">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold text-primary">
            Hadirin
          </Link>
          <MarketingNav />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/5 bg-surface py-8 text-center text-sm text-muted dark:border-white/10">
        © {new Date().getFullYear()} Hadirin. Absensi GPS + selfie untuk UMKM Indonesia.
      </footer>
    </div>
  );
}
