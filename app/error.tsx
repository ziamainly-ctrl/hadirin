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
    // m-auto (not justify-center) centers the block and still lets <main> scroll from the top on a
    // window too short for it; lg:h-dvh matches the one-viewport desktop shell (the window never scrolls).
    <main className="bg-dot-grid flex min-h-dvh flex-col lg:h-dvh lg:overflow-y-auto">
      <div className="m-auto flex w-full max-w-2xl flex-col items-center px-4 py-8 text-center">
        <Mascot framing="full" title="Maskot Hadirin" className="h-[clamp(5rem,16vh,8rem)] w-[clamp(5rem,16vh,8rem)]" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-text sm:text-3xl">Terjadi kesalahan</h1>
        <p className="mt-3 max-w-md text-pretty text-muted">
          Halaman ini gagal dimuat. Coba lagi sebentar. Jika masih terjadi, hubungi admin perusahaan Anda.
        </p>
        {error.digest ? <p className="mt-3 font-mono text-xs text-muted">Kode: {error.digest}</p> : null}
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <Button size="lg" onClick={reset}>
            Coba Lagi
          </Button>
          <ButtonLink href="/" variant="outline" size="lg">
            Kembali ke Beranda
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
