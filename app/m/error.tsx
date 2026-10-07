'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';

// Error boundary for the employee pages. Unlike app/error.tsx (a whole-page screen with a way back
// to the marketing home) it renders inside layout.tsx, so the header and the tab bar stay and the
// person can switch tab or retry without being thrown out of the app. A render error here is
// almost always a dropped connection or a slow database, so "Coba Lagi" (reset) is the main way out.
export default function EmployeeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keeps the server-side digest findable in the browser console when someone reports it.
    console.error(error);
  }, [error]);

  return (
    <Page role="alert">
      <Page.Header title="Terjadi kesalahan" />
      <Page.Body>
        <Card>
          <EmptyState
            icon={TriangleAlert}
            message="Halaman ini gagal dimuat. Periksa koneksi internet Anda, lalu coba lagi. Jika masih terjadi, hubungi admin perusahaan Anda."
            action={
              <div className="flex flex-col items-center gap-3">
                <Button variant="outline" onClick={reset}>
                  Coba Lagi
                </Button>
                {error.digest ? <p className="font-mono text-xs text-muted">Kode: {error.digest}</p> : null}
              </div>
            }
          />
        </Card>
      </Page.Body>
    </Page>
  );
}
