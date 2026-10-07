import type { Metadata } from 'next';
import Mascot from '@/components/shared/Mascot';
import ButtonLink from '@/components/ui/ButtonLink';
import { getDashboardHref } from './(marketing)/dashboard-href';

export const metadata: Metadata = { title: 'Halaman tidak ditemukan' };

// Without this file Next serves its stock, unbranded 404 (white, no logo, its own fonts,
// ignoring the dark theme). This renders inside the root layout, so the theme script and
// Plus Jakarta Sans still apply.
export default async function NotFound() {
  // A signed-in visitor who mistyped an /app or /m address gets a way back to their own home, not a
  // "Masuk" button for an account they are already in (the same switch the marketing header makes).
  const dashboardHref = await getDashboardHref();
  return (
    // m-auto (not justify-center) centers the block and still lets <main> scroll from the top on a
    // window too short for it; lg:h-dvh matches the one-viewport desktop shell (the window never scrolls).
    <main className="bg-dot-grid flex min-h-dvh flex-col lg:h-dvh lg:overflow-y-auto">
      <div className="m-auto flex w-full max-w-2xl flex-col items-center px-4 py-8 text-center">
        <Mascot framing="full" title="Maskot Hadirin" className="h-[clamp(5rem,16vh,8rem)] w-[clamp(5rem,16vh,8rem)]" />
        <p className="mt-6 text-sm font-semibold tracking-widest text-muted">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-text sm:text-3xl">Halaman tidak ditemukan</h1>
        <p className="mt-3 max-w-md text-pretty text-muted">
          Alamat yang Anda buka tidak ada atau sudah dipindahkan. Periksa lagi tautannya, atau kembali ke beranda.
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <ButtonLink href="/" size="lg">
            Kembali ke Beranda
          </ButtonLink>
          {dashboardHref ? (
            <ButtonLink href={dashboardHref} variant="outline" size="lg">
              Buka Dashboard
            </ButtonLink>
          ) : (
            <ButtonLink href="/login" variant="outline" size="lg">
              Masuk
            </ButtonLink>
          )}
        </div>
      </div>
    </main>
  );
}
