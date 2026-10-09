import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import Reveal from '@/components/shared/motion/Reveal';

export type DashCardId = 'trend' | 'status' | 'hours' | 'heat' | 'attn' | 'feed';

export interface DashCardProps {
  /** Names the card for the layout (`.dash-{id}` in dashboard.css) and for the fit probe. */
  id: DashCardId;
  title: string;
  /** A muted phrase after the title ("rata-rata 94%"). It truncates first when the card is narrow. */
  hint?: ReactNode;
  /** A quiet "Detail" link to the page that owns this subject. */
  href?: string;
  hrefLabel?: string;
  /** Replaces the link: a control that belongs to the card (the 7 / 30 day switch, a legend). */
  action?: ReactNode;
  /** Position in the staggered enter (0 = first). */
  order: number;
  children: ReactNode;
}

export function DashLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group -mr-1 inline-flex shrink-0 items-center gap-0.5 rounded-input px-1.5 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-accent hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-10 pointer-coarse:px-2"
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </Link>
  );
}

/**
 * The one card chrome of the dashboard: a neutral surface, a hairline border, a tiny heading and, on
 * the right, either a link to the page behind the numbers or a control. It enters through <Reveal>
 * (staggered rise). The body is whatever the card puts below; charts go in a `.dash-chart` box and
 * lists in a `.dash-fit` one (dashboard.css), which is how a card fits its grid cell at every height.
 */
export default function DashCard({ id, title, hint, href, hrefLabel = 'Detail', action, order, children }: DashCardProps) {
  const headingId = `dash-${id}-title`;
  return (
    <Reveal
      as="section"
      index={order}
      data-dash-card={id}
      aria-labelledby={headingId}
      className={`dash-card dash-${id} rounded-card border border-border bg-surface`}
    >
      <header className="flex min-h-6 shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 id={headingId} className="shrink-0 text-sm font-semibold text-text">
            {title}
          </h2>
          {hint ? <p className="min-w-0 truncate text-xs text-muted">{hint}</p> : null}
        </div>
        {action ?? (href ? <DashLink href={href} label={hrefLabel} /> : null)}
      </header>
      {children}
    </Reveal>
  );
}
