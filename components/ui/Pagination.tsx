import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Route to link to, e.g. '/app/attendance'. */
  basePath: string;
  /** Other active filters/search params to preserve across page links. */
  searchParams?: Record<string, string | undefined>;
  className?: string;
}

function hrefForPage(
  basePath: string,
  searchParams: Record<string, string | undefined> | undefined,
  page: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined && key !== 'page') params.set(key, value);
  }
  params.set('page', String(page));
  return `${basePath}?${params.toString()}`;
}

/**
 * Prev/next are 32px for a mouse and 40px on a touch screen (pointer-coarse): 32px was the
 * smallest target on every list page on a phone.
 *
 * Server Component: list pages in this app read `?page=` via searchParams, so
 * pagination is plain <Link> navigation rather than an onClick handler.
 *
 * This is the OUTER pager (a chunk of up to ~100 rows from the server). Inside a chunk the rows are
 * split into screen-sized pages by the client fit pager, so on desktop nothing scrolls. It renders
 * nothing while the data fits one chunk.
 */
export default function Pagination({ page, pageSize, total, basePath, searchParams, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const current = Math.min(Math.max(1, page), totalPages);
  const hasPrev = current > 1;
  const hasNext = current < totalPages;
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  // One chunk of data: the list's own fit pager (components/shared/FitPager) already shows
  // "13-24 dari 36 data" and pages through it, so a second bar saying "Halaman 1 dari 1" would
  // only cost desktop height. This server pager appears only when the data outgrows one chunk.
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Navigasi halaman"
      className={`flex flex-wrap items-center justify-between gap-3 text-sm text-muted ${className ?? ''}`}
    >
      <p className="tabular-nums">{total === 0 ? 'Tidak ada data' : `${from}–${to} dari ${total}`}</p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={hrefForPage(basePath, searchParams, current - 1)}
            aria-label="Halaman sebelumnya"
            className="inline-flex h-8 w-8 items-center pointer-coarse:h-10 pointer-coarse:w-10 justify-center rounded-input border border-border bg-surface text-text transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center pointer-coarse:h-10 pointer-coarse:w-10 justify-center rounded-input border border-border text-muted/40"
          >
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        <span className="px-1 tabular-nums text-text">
          Halaman {current} dari {totalPages}
        </span>
        {hasNext ? (
          <Link
            href={hrefForPage(basePath, searchParams, current + 1)}
            aria-label="Halaman berikutnya"
            className="inline-flex h-8 w-8 items-center pointer-coarse:h-10 pointer-coarse:w-10 justify-center rounded-input border border-border bg-surface text-text transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center pointer-coarse:h-10 pointer-coarse:w-10 justify-center rounded-input border border-border text-muted/40"
          >
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
