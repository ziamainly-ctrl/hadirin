import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-black/5 bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold text-primary">
            Hadirin
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="text-text hover:text-primary">
              Harga
            </Link>
            <Link href="/login" className="text-text hover:text-primary">
              Masuk
            </Link>
            <Link
              href="/register"
              className="rounded-input bg-primary px-4 py-2 font-medium text-primary-fg hover:opacity-90"
            >
              Mulai Gratis
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/5 bg-surface py-8 text-center text-sm text-muted">
        © {new Date().getFullYear()} Hadirin. Absensi GPS + selfie untuk UMKM Indonesia.
      </footer>
    </div>
  );
}
