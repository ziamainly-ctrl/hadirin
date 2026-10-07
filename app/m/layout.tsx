import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import ThemeToggle from '@/components/shared/ThemeToggle';
import Logo from '@/components/shared/Logo';
import BottomNav from './bottom-nav';

// noindex (TRD.md §14): a signed-in app, nothing for a search engine to show. robots.txt already
// disallows /m, but a disallowed URL can still be indexed from a link; this tag is what prevents it.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// /m is installed as a standalone PWA (app/manifest.ts start_url). viewport-fit=cover lets
// the column reach under the notch and the home indicator, and env(safe-area-inset-*)
// below keeps the header and the tab bar clear of them (the insets are 0 without it).
// Merged with app/layout.tsx's viewport, so its themeColor still applies.
export const viewport: Viewport = { viewportFit: 'cover' };

// Server Component, same must-change-password redirect pattern as app/app/layout.tsx.
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { context } = await requireSession();
  if (context.mustChangePassword) redirect('/change-password');

  return (
    <ToastProvider>
      {/* Phone-width column; from md up the side borders frame it so the header and tab
          bar don't read as strips floating in an empty page. On a short desktop window
          (<= 860px tall: the browser viewport of every 13-16" laptop, 1280x800 and 1366x768
          included) the column widens to 2xl: a phone column leaves no height for a camera
          preview (a 180x240 thumbnail at 768px), while a wider one lets the pages lay
          themselves out in two columns (they key off their own container width, not the
          screen) and gives the viewfinder 336x448. Taller windows keep the phone column.
          Below lg it is a normal scrolling page with a fixed tab bar. From lg up (desktop,
          where the window never scrolls) it is exactly one viewport tall: header and tab bar
          are in-flow, and <main> is the one region that may scroll — pages built on
          components/shared/Page keep their title fixed and scroll only their own body, so
          the window and the tab bar never move. */}
      <div className="mx-auto flex min-h-dvh max-w-md flex-col md:border-x md:border-border lg:h-dvh lg:min-h-0 lg:overflow-hidden [@media(min-width:1024px)_and_(max-height:860px)]:max-w-2xl">
        <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center justify-between px-4 [@media(min-width:1024px)_and_(max-height:860px)]:h-12">
            <Logo className="text-base" />
            <ThemeToggle />
          </div>
        </header>
        {/* Bottom padding = tab bar height (4.5rem) + breathing room + the home-indicator inset
            (the bar is in-flow from lg up, so there it is plain padding).
            --today-chrome / --today-chrome-wide / --vf-min tell the selfie viewfinder
            (components/shared/SelfieCamera) how much height this shell uses around it: header +
            tab bar + paddings + the title and the card's own rows (33rem in the narrow column,
            19rem when the viewfinder has its own column), and how small it may get (a phone
            scrolls, so it keeps a usable preview; the desktop shell must not, so it may shrink
            further). */}
        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 [--today-chrome-wide:19rem] [--today-chrome:33rem] lg:min-h-0 lg:overflow-y-auto lg:pb-4 lg:pt-4 lg:[--vf-min:8rem] [@media(min-width:1024px)_and_(max-height:860px)]:py-3">
          {children}
        </main>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
