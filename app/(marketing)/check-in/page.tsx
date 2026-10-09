import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthError, requireSession } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import TodayView from '@/app/m/today-view';

export const metadata: Metadata = {
  title: 'Check-in',
  description: 'Absen masuk dan keluar hari ini dengan GPS dan selfie.',
  robots: { index: false },
};

// Check-in from the public site's own menu. Signed out -> /login, which sends the person
// straight back here (login honors ?next); signed in -> the same screen as /m ("today").
// proxy.ts only gates /m, /app and /platform, so this page does its own session check.
// redirect() throws, so it must stay outside the try/catch.
export default async function CheckInPage() {
  let mustChangePassword = false;
  let signedIn = true;
  try {
    const { context } = await requireSession();
    mustChangePassword = context.mustChangePassword;
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    signedIn = false;
  }
  if (!signedIn) redirect('/login?next=%2Fcheck-in');
  if (mustChangePassword) redirect('/change-password');

  return (
    <ToastProvider>
      {/* TodayView frames itself (a Page, max-w-3xl, also the @container the card measures), so this
          wrapper only gives it a definite height on desktop (min-h-0 lets the Page body, not the
          window, absorb a short screen) and the free-height padding of every marketing page. The
          two variables tell the viewfinder how much of the viewport the marketing shell uses
          around it (header 4rem + footer 2.6rem + padding + page title + card header): the
          selfie preview is 100dvh minus that, so the whole screen fits 1024x600 up to 2200x1100
          (the lower floor, --vf-min, is for the same reason: the desktop shell must not scroll). */}
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4 lg:min-h-0 lg:py-[clamp(0.5rem,calc(6vh-2rem),2rem)] lg:[--today-chrome-wide:19.25rem] lg:[--vf-min:8rem]">
        {/* lg:my-auto: like every other marketing page, the screen floats in the middle of a tall
            window instead of hugging the header (an auto margin, not justify-center, so a window
            too short for it scrolls from its top). lg:h-auto! overrides the Page frame's h-full:
            the viewfinder is sized from the viewport (the variables above), not from this box. */}
        <TodayView host="check-in" className="lg:my-auto lg:h-auto!" />
      </section>
    </ToastProvider>
  );
}
