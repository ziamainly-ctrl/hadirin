import Link from 'next/link';
import Logo from '@/components/shared/Logo';
import ThemeToggle from '@/components/shared/ThemeToggle';

/**
 * Shell of login / register / change-password. The same slim header as the marketing site
 * (logo left, theme toggle right, the header's own column) with the form card centered in the
 * rest of the window. On desktop the shell is exactly one viewport tall and the window never
 * scrolls; <main> is the safety-net scroller for a window too short for the card, and the
 * card centers itself with `my-auto` (not justify-center), so a card taller than the space is
 * scrolled from its top instead of being clipped above the fold. On phones it sits at the top
 * instead of floating mid-screen, where the on-screen keyboard would cover it.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="shrink-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            aria-label="Hadirin — beranda"
            className="flex shrink-0 items-center rounded-input py-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Logo className="text-lg" />
          </Link>
          {/* Same toggle as the marketing header, so a visitor who switched themes there can
              switch back here too instead of only through their OS setting. */}
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-sm px-4 pb-8 pt-2 lg:my-auto lg:pb-[clamp(0.75rem,calc(6vh-1.5rem),2.5rem)]">
          <div className="rounded-card border border-border bg-surface p-5 shadow-sm sm:p-6 lg:p-[clamp(1rem,calc(6vh-1.25rem),2rem)]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
