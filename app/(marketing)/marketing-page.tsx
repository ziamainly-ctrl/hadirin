import type { ComponentType, ReactNode } from 'react';
import Card from '@/components/ui/Card';

// The frame every public page shares, so the five menu pages line up with the header (same
// max-w-6xl / px-4 column as the logo and the Sign up button) and fit one desktop viewport
// the same way. Server-safe: markup only.

/**
 * A page body inside the marketing shell's <main>. It claims the free height and centers its
 * content vertically (flex-1 + justify-center), so a short page floats in the middle of a
 * tall window instead of hugging the header. The gap and padding are vh-aware (calc of the window's
 * height, floored at 12px/8px), so the same page shrinks to fit a 1024x600 window with no scrolling and
 * breathes on a tall one. Below lg the page scrolls normally and uses plain, roomier spacing.
 */
export function PageSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-8 lg:gap-[clamp(0.75rem,calc(6vh-1.75rem),2rem)] lg:py-[clamp(0.5rem,calc(6vh-2rem),3rem)] ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Title block of a menu page: h1 + one-line intro, with the page's calls to action opposite
 * the title on desktop (saves a whole row of height there) and under it on phones, where a
 * primary action right below the intro is also the first thing a visitor can tap.
 */
export function PageHead({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-center gap-4 text-center lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:text-left">
      <div className="max-w-2xl lg:max-w-3xl">
        <h1 className="text-balance text-2xl font-bold sm:text-3xl tracking-tight text-text lg:text-[clamp(1.75rem,min(2.6vw,5vh),2.25rem)]">
          {title}
        </h1>
        <p className="mt-2 text-pretty text-muted">{description}</p>
      </div>
      {actions ? <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:shrink-0">{actions}</div> : null}
    </header>
  );
}

/** Icon + title + short text on a card (Fitur's six features, About's three values). The icon
 * sits beside the title rather than above it, which saves about 40px of card height, and its
 * disc is the neutral accent surface with a hairline border (the accent alone is nearly the card's own gray). */
export function IconCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-text">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <h2 className="font-semibold text-text">{title}</h2>
      </div>
      <p className="mt-2.5 text-sm text-muted">{description}</p>
    </Card>
  );
}
