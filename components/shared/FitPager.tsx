'use client';

import { useCallback, useRef } from 'react';
import type { ElementType, KeyboardEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FIT_LAND_KEY, useFitDesktop, useFitPager } from './useFitPager';
import type { FitPagerState } from './useFitPager';

export { useFitDesktop, useFitPager, FIT_DESKTOP_QUERY } from './useFitPager';
export type { FitPagerState } from './useFitPager';

/** Page keys that must stay with a form control while it has focus. */
function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/** PageUp / PageDown page through the list from anywhere inside it (except while typing). */
export function fitPagerKeyHandler(prev: () => void, next: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
    if (e.key === 'PageDown') {
      e.preventDefault();
      next();
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      prev();
    }
  };
}


/**
 * The server's own chunking, passed down as plain data so one footer can drive both levels. A list
 * page loads one chunk of up to `pageSize` rows (`?page=`); the fit pager splits that chunk into
 * screen-sized pages. With `serverPager` the footer reads as ONE pager over all `total` rows: the
 * range is absolute ("101-112 dari 1053"), next on the last screen of a chunk loads the next
 * chunk, prev on the first screen loads the previous chunk and lands on its LAST screen.
 */
export interface ServerPagerProps {
  /** 1-based chunk number currently loaded (the `?page=` param). */
  page: number;
  /** Rows per chunk (the page's PAGE_SIZE). */
  pageSize: number;
  /** Rows across every chunk. */
  total: number;
  /** Route to navigate within, e.g. '/app/attendance'. */
  basePath: string;
  /** Other active filters to keep on the link. */
  searchParams?: Record<string, string | undefined>;
}

function chunkHref(server: ServerPagerProps, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(server.searchParams ?? {})) {
    if (value !== undefined && key !== 'page') params.set(key, value);
  }
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `${server.basePath}?${query}` : server.basePath;
}

/** Wires prev/next of a fit pager to the server chunks. Without `server` it is just the fit pager. */
export function useFitNav(
  fit: { state: FitPagerState; prev: () => void; next: () => void },
  server?: ServerPagerProps,
) {
  const router = useRouter();
  const chunks = server ? Math.max(1, Math.ceil(server.total / Math.max(1, server.pageSize))) : 1;
  const chunk = server ? Math.min(Math.max(1, server.page), chunks) : 1;
  const chunked = chunks > 1;
  const { state } = fit;
  const lastScreen = state.page >= state.pageCount - 1;

  const onPrev = useCallback(() => {
    if (state.page > 0) return fit.prev();
    if (server && chunk > 1) {
      try {
        window.sessionStorage.setItem(FIT_LAND_KEY, String(Date.now()));
      } catch {
        // Private mode: the previous chunk simply opens on its first screen.
      }
      router.push(chunkHref(server, chunk - 1), { scroll: false });
    }
  }, [state.page, fit, server, chunk, router]);

  const onNext = useCallback(() => {
    if (!lastScreen) return fit.next();
    if (server && chunk < chunks) router.push(chunkHref(server, chunk + 1), { scroll: false });
  }, [lastScreen, fit, server, chunk, chunks, router]);

  return {
    onPrev,
    onNext,
    canPrev: state.page > 0 || chunk > 1,
    canNext: !lastScreen || chunk < chunks,
    /** Absolute row offset of the loaded chunk, and the grand total across chunks. */
    offset: server ? (chunk - 1) * server.pageSize : 0,
    grandTotal: server ? server.total : state.total,
    chunked,
  };
}

const ARROW =
  'inline-flex h-6 w-6 items-center justify-center rounded-input border border-border bg-surface text-text transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:text-muted/40';

export interface FitFooterProps {
  state: FitPagerState;
  onPrev: () => void;
  onNext: () => void;
  /** Arrow availability; defaults to "inside this chunk" (see useFitNav for the cross-chunk one). */
  canPrev?: boolean;
  canNext?: boolean;
  /** Absolute offset and grand total when the data is split in server chunks (useFitNav). */
  offset?: number;
  grandTotal?: number;
  /** More than one server chunk: the "n / N" indicator would only count this chunk, so it is hidden. */
  chunked?: boolean;
  /** Noun for the count, "data" by default ("1–12 dari 36 data"). */
  noun?: string;
  className?: string;
}

/**
 * The one-line pager under a fitted list: "13–24 dari 36 data" on the left, prev / "2 / 3" / next
 * on the right. It keeps its height before the first measurement and when there is a single page
 * (the count alone), so nothing around it shifts. Used by ui/TableFrame and FitPager.
 */
export function FitFooter({
  state,
  onPrev,
  onNext,
  canPrev,
  canNext,
  offset = 0,
  grandTotal,
  chunked = false,
  noun = 'data',
  className,
}: FitFooterProps) {
  const { page, pageCount, from, to, total, ready, hiddenColumns } = state;
  const shownTotal = grandTotal ?? total;
  const prevOk = canPrev ?? page > 0;
  const nextOk = canNext ?? page < pageCount - 1;
  const showArrows = ready && (pageCount > 1 || chunked);
  return (
    <div
      role="navigation"
      aria-label="Halaman daftar"
      onKeyDown={(e) => {
        // Arrows move between pages while a pager button has focus.
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onPrev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNext();
        }
      }}
      className={`flex h-9 shrink-0 items-center justify-between gap-3 border-t border-border px-3 text-xs text-muted [@media(min-width:1024px)_and_(max-height:700px)]:h-8 ${className ?? ''}`}
    >
      <p className={`tabular-nums ${ready ? '' : 'invisible'}`} aria-live="polite">
        {total === 0 ? `Tidak ada ${noun}` : `${offset + from}–${offset + to} dari ${shownTotal} ${noun}`}
        {hiddenColumns > 0 ? (
          <span className="ml-2 text-muted/80" title="Perlebar jendela atau tutup sidebar untuk melihat semua kolom.">
            · {hiddenColumns} kolom disembunyikan
          </span>
        ) : null}
      </p>
      {showArrows ? (
        <div className="flex items-center gap-2">
          <button type="button" className={ARROW} onClick={onPrev} disabled={!prevOk} aria-label="Halaman sebelumnya" aria-keyshortcuts="PageUp">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {chunked ? null : (
            <span className="min-w-12 text-center tabular-nums text-text" aria-label={`Halaman ${page + 1} dari ${pageCount}`}>
              {page + 1} / {pageCount}
            </span>
          )}
          <button type="button" className={ARROW} onClick={onNext} disabled={!nextOk} aria-label="Halaman berikutnya" aria-keyshortcuts="PageDown">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export interface FitPagerProps {
  /** The items: each DIRECT child becomes one pageable item (a card, a list row, a grid cell). */
  children: ReactNode;
  /** Classes of the item container: the grid or list layout (`grid grid-cols-... gap-3`). A grid
   * should also carry `content-start` so a short last page does not stretch its rows. */
  className?: string;
  /** Accessible name of the pager ("Galeri selfie"). */
  label: string;
  /** Noun used by the footer count, "data" by default. */
  noun?: string;
  /** Extra classes of the outer frame (it is `flex-1 min-h-0` inside a height-bound column). */
  frameClassName?: string;
  /** Tag of the item container: `ul` / `ol` when the children are `li` (keeps the list semantics). */
  as?: 'div' | 'ul' | 'ol';
  /** Classes of the pager footer. Default is a card of its own under the list; inside a card
   * that already has a border pass `''` and the footer is just a divider line + the controls. */
  footerClassName?: string;
  /** The server chunk this list is one page of (see ServerPagerProps); omit when it is all the data. */
  serverPager?: ServerPagerProps;
}

/**
 * Pager for cards, grids and lists (components/ui/TableFrame does the same for table rows). Put it
 * in a height-bound flex column (`Page.Body` on desktop); it takes the room that is left, measures
 * how many items fit (columns x rows included) and shows exactly one page of them with a compact
 * pager under it. Below the desktop breakpoint it is a plain container and every item shows, so
 * a phone just scrolls the page. See useFitPager for how the measuring works.
 *
 *   <FitPager label="Galeri selfie" className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] content-start gap-3">
 *     {photos.map((p) => <PhotoCard key={p.id} photo={p} />)}
 *   </FitPager>
 */
export default function FitPager({
  children,
  className,
  label,
  noun,
  frameClassName,
  serverPager,
  as = 'div',
  footerClassName = 'mt-2 rounded-card border bg-surface',
}: FitPagerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement>(null);
  const Items = as as ElementType;
  const desktop = useFitDesktop();
  const fit = useFitPager({ enabled: desktop, rootRef, viewportRef });
  const nav = useFitNav(fit, serverPager);
  const { state } = fit;

  return (
    <section
      ref={rootRef}
      aria-label={label}
      onKeyDown={desktop ? fitPagerKeyHandler(nav.onPrev, nav.onNext) : undefined}
      className={`flex min-h-0 flex-1 flex-col ${frameClassName ?? ''}`}
    >
      <Items ref={viewportRef} className={`min-h-0 ${desktop ? 'flex-1 overflow-hidden' : ''} fit-clip ${className ?? ''}`}>
        {children}
      </Items>
      {desktop ? (
        <FitFooter
          state={state}
          onPrev={nav.onPrev}
          onNext={nav.onNext}
          canPrev={nav.canPrev}
          canNext={nav.canNext}
          offset={nav.offset}
          grandTotal={nav.grandTotal}
          chunked={nav.chunked}
          noun={noun}
          className={footerClassName}
        />
      ) : null}
    </section>
  );
}
