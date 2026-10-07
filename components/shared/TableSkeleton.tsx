import type { ReactNode } from 'react';
import Skeleton from '@/components/ui/Skeleton';
import Page from './Page';

export interface TableSkeletonProps {
  /** The page's real title: only the data is a placeholder, so the heading is already right. */
  title: string;
  description?: ReactNode;
  /** A button-sized placeholder top-right, for pages whose header has a "Tambah ..." action. */
  action?: boolean;
  /** A row of filter-sized placeholders between the header and the table. */
  toolbar?: boolean;
  /** Body rows. Default 6. */
  rows?: number;
  /** Cells per row, 2 to 5. Default 4. */
  columns?: number;
}

// Cell widths per column position: a wide first column (a name) and narrower ones after it, so
// the placeholder reads as a table and not as a stack of identical bars.
const CELL_WIDTHS = ['w-40', 'w-24', 'w-20', 'w-16', 'w-20'];

/**
 * Loading state of a list page (a `loading.tsx` renders it): the real Page frame with a
 * real title, then a table card of placeholder rows. It is shown the instant a sidebar link
 * is pressed, while the server renders the list (TRD.md §14: admin pages stream with
 * skeletons), so it must occupy the same box as the finished page: same header, same card
 * chrome, and a body that does not scroll the window on desktop.
 */
export default function TableSkeleton({
  title,
  description,
  action = false,
  toolbar = false,
  rows = 6,
  columns = 4,
}: TableSkeletonProps) {
  const cols = Math.min(Math.max(columns, 2), CELL_WIDTHS.length);
  return (
    <Page aria-busy="true">
      <Page.Header title={title} description={description} actions={action ? <Skeleton className="h-10 w-36" /> : undefined} />
      {toolbar ? (
        <Page.Toolbar>
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
        </Page.Toolbar>
      ) : null}
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data…
        </span>
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="flex items-center gap-4 bg-accent px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className={`h-3 ${CELL_WIDTHS[c]} ${c === 1 ? 'ml-auto' : ''}`} />
            ))}
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex items-center gap-4 px-4 py-3.5">
                {Array.from({ length: cols }, (_, c) => (
                  <Skeleton key={c} className={`h-4 ${CELL_WIDTHS[c]} ${c === 1 ? 'ml-auto' : ''} ${c === cols - 1 && c > 1 ? 'rounded-full' : ''}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Page.Body>
    </Page>
  );
}
