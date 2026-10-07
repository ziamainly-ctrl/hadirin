'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';

// Error boundary for every /platform page. The root app/error.tsx replaces the WHOLE screen
// (and its "Kembali ke Beranda" leaves the admin area); this one sits below the sidebar layout,
// so a page that fails to load keeps the navigation around it and offers a retry in place.
export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keeps the server-side digest findable in the browser console when someone reports it.
    console.error(error);
  }, [error]);

  return (
    <Page>
      <Page.Header title="Terjadi kesalahan" description="Halaman ini gagal dimuat." />
      <Page.Body>
        <EmptyState
          icon={TriangleAlert}
          message="Coba lagi sebentar. Jika masih terjadi, periksa log server untuk kode di bawah."
          action={<Button onClick={reset}>Coba Lagi</Button>}
        />
        {error.digest ? <p className="text-center font-mono text-xs text-muted">Kode: {error.digest}</p> : null}
      </Page.Body>
    </Page>
  );
}
