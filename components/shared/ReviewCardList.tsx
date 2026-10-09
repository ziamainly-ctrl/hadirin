import type { ReactNode } from 'react';

export interface ReviewCardFact {
  label: string;
  value: ReactNode;
}

export interface ReviewCardItem {
  key: string | number;
  title: ReactNode;
  /** Small muted line under the title (a date, a branch). */
  subtitle?: ReactNode;
  /** Top-right: a status badge or a figure. */
  badge?: ReactNode;
  facts?: ReviewCardFact[];
  /** Bottom line: flags, links. */
  footer?: ReactNode;
}

export interface ReviewCardListProps {
  items: ReviewCardItem[];
  'aria-label': string;
  className?: string;
}

/**
 * The phone layout of a review table: one stacked card per record instead of a wide table that
 * would show only a name and a date at 360px (same pattern as the attendance and recap lists in
 * app/app/attendance and app/app/reports). Hidden from sm up, where the real <Table> has room.
 */
export default function ReviewCardList({ items, className, ...rest }: ReviewCardListProps) {
  return (
    <ul
      aria-label={rest['aria-label']}
      className={`divide-y divide-border rounded-card border border-border bg-surface sm:hidden ${className ?? ''}`}
    >
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-2 px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 break-words font-medium text-text">{item.title}</p>
              {item.subtitle ? <p className="text-xs text-muted">{item.subtitle}</p> : null}
            </div>
            {item.badge ? <div className="shrink-0">{item.badge}</div> : null}
          </div>
          {item.facts && item.facts.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {item.facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline gap-1.5">
                  <dt className="text-muted">{fact.label}</dt>
                  <dd className="min-w-0 tabular-nums text-text">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {item.footer ? <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{item.footer}</div> : null}
        </li>
      ))}
    </ul>
  );
}
