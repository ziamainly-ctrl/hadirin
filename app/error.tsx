'use client';

import { useEffect } from 'react';
import Mascot from '@/components/shared/Mascot';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';

// Route-level error boundary (everything under the root layout). Without it an uncaught
// render error shows Next's stock "Application error" page: unbranded and with no way back.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keeps the server-side digest findable in the browser console when a user reports it.
    console.error(error);
  }, [error]);

  return (
    <main className="bg-dot-grid flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <Mascot framing="full" title="Maskot Hadirin" className="h-32 w-32" />
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-text sm:text-3xl">Terjadi kesalahan</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Halaman ini gagal dimuat. Coba lagi sebentar, dan jika masih terjadi, hubungi admin perusahaanmu.
      </p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-muted">Kode: {error.digest}</p> : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={reset}>
          Coba lagi
        </Button>
        <ButtonLink href="/" variant="outline" size="lg">
          Kembali ke beranda
        </ButtonLink>
      </div>
    </main>
  );
}
