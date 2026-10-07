import type { Metadata } from 'next';
import Mascot from '@/components/shared/Mascot';
import ButtonLink from '@/components/ui/ButtonLink';

export const metadata: Metadata = { title: 'Halaman tidak ditemukan' };

// Without this file Next serves its stock, unbranded 404 (white, no logo, its own fonts,
// ignoring the dark theme). This renders inside the root layout, so the theme script and
// Plus Jakarta Sans still apply.
export default function NotFound() {
  return (
    <main className="bg-dot-grid flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <Mascot framing="full" title="Maskot Hadirin" className="h-32 w-32" />
      <p className="mt-6 text-sm font-semibold tracking-widest text-muted">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-text sm:text-3xl">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Alamat yang kamu buka tidak ada atau sudah dipindahkan. Periksa lagi tautannya, atau kembali ke beranda.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" size="lg">
          Kembali ke beranda
        </ButtonLink>
        <ButtonLink href="/login" variant="outline" size="lg">
          Masuk
        </ButtonLink>
      </div>
    </main>
  );
}
