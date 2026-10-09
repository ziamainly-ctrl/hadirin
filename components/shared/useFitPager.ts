'use client';

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';

/**
 * Desktop = the viewport where the product's zero-scroll rule applies (TRD.md §14 "Desktop fit
 * tiers"): at least 1024px wide and 560px tall. Below it pages scroll normally and nothing in
 * here paginates.
 */
export const FIT_DESKTOP_QUERY = '(min-width: 1024px) and (min-height: 560px)';

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(FIT_DESKTOP_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** True on a desktop-size window. False on the server and during hydration, so the first client
 * render matches the server HTML; it flips to the real value right after. */
export function useFitDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(FIT_DESKTOP_QUERY).matches,
    () => false,
  );
}

export interface FitPagerState {
  /** Zero-based index of the visible page. */
  page: number;
  pageCount: number;
  /** One-based range of the visible items, e.g. 13–24 of `total`. 0–0 when empty. */
  from: number;
  to: number;
  total: number;
  /** False until the first measurement; the footer renders blank (but keeps its height). */
  ready: boolean;
  /** Table columns hidden by the column fit (`priority` on a Table.HeadCell) to avoid a sideways scroll. */
  hiddenColumns: number;
}

const EMPTY: FitPagerState = { page: 0, pageCount: 1, from: 0, to: 0, total: 0, ready: false, hiddenColumns: 0 };

/**
 * Column fit for a table inside its scroll box: while the table is wider than the box, hide whole
 * columns, the highest `data-priority` number first (a header cell with no priority is never hidden;
 * `Table.HeadCell priority={n}` sets it). A column is hidden by the `hidden` attribute on its header
 * cell and on the cell of the same index in every row whose cell count matches the header's (an
 * empty-state row with a colSpan is left alone). Called with every row revealed, so the widest
 * content decides and the same columns stay on every page. Returns how many columns are hidden.
 */
export function fitTableColumns(scroller: HTMLElement): number {
  const table = scroller.querySelector('table');
  const headRow = table?.tHead?.rows[0];
  if (!table || !headRow) return 0;
  const heads = Array.from(headRow.cells);
  const prios = heads.map((th) => Number(th.dataset.priority ?? 0) || 0);
  const rows = Array.from(table.rows).filter((row) => row.cells.length === heads.length);
  const setColumn = (col: number, hide: boolean) => {
    for (const row of rows) {
      const cell = row.cells[col];
      if (cell && cell.hidden !== hide) cell.hidden = hide;
    }
  };
  for (let col = 0; col < heads.length; col++) setColumn(col, false);
  const levels = [...new Set(prios.filter((p) => p > 0))].sort((a, b) => b - a);
  let hidden = 0;
  for (const level of levels) {
    if (scroller.scrollWidth <= scroller.clientWidth + 1) break;
    prios.forEach((p, col) => {
      if (p === level) {
        setColumn(col, true);
        hidden++;
      }
    });
  }
  return hidden;
}

/** Undo fitTableColumns (the window stopped being "desktop"). */
export function revealTableColumns(scroller: HTMLElement) {
  for (const cell of scroller.querySelectorAll<HTMLElement>('th[hidden], td[hidden]')) cell.hidden = false;
}

export interface UseFitPagerOptions {
  /** Turn the pager on (desktop). Off = every item is shown and nothing is measured. */
  enabled: boolean;
  /** The frame that holds viewport + footer. Its PARENT is the box whose height we must fit in,
   * so a window resize that the (propped-open) viewport cannot report is still noticed. */
  rootRef: RefObject<HTMLElement | null>;
  /** The scroll box whose clientHeight is the room for one page (the table scroller, the grid). */
  viewportRef: RefObject<HTMLElement | null>;
  /** CSS selector, relative to the viewport, of the element whose CHILDREN are the items
   * (`tbody` for a table). Default: the viewport itself (a grid or list). */
  listSelector?: string;
  /** CSS selector of a pinned header inside the viewport (`thead`): its height is not page room. */
  headerSelector?: string;
  /** The viewport holds a table: also hide low-priority columns that would scroll it sideways. */
  fitColumns?: boolean;
}

/** useFitNav (FitPager.tsx) sets this just before it loads the PREVIOUS server chunk, so the user
 * who pressed "previous" on the first screen lands on the last screen of that chunk. A flag older
 * than 10s is a leftover from a navigation that never happened and is ignored. */
export const FIT_LAND_KEY = 'hadirin.fit.land';
function consumeLandOnLast(): boolean {
  try {
    const raw = window.sessionStorage.getItem(FIT_LAND_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(FIT_LAND_KEY);
    return Date.now() - Number(raw) < 10_000;
  } catch {
    return false;
  }
}

function itemsOf(list: HTMLElement): HTMLElement[] {
  return Array.from(list.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
}

/**
 * Client-side "fit pager": splits the rows/cards that are ALREADY rendered (and already loaded
 * from the server) into pages that exactly fit the measured box, so a desktop list never needs a
 * scrollbar (AG Grid's `paginationAutoPageSize` and MUI's `autoPageSize` solve the same problem
 * for their grids; this one works on whatever DOM the Server Component rendered).
 *
 * How, and why it works on any markup: the items stay in the DOM and React never learns they are
 * hidden. To measure, every item is revealed for an instant (synchronously, so the browser never
 * paints that state), the page breaks are computed greedily from the real rendered boxes
 * (`getBoundingClientRect`, so wrapped rows and multi-column grids are right), then every item
 * outside the current page gets the `hidden` attribute. It re-runs when the box resizes (window,
 * sidebar), when the list's children change (router.refresh, a filter, polling) and once web
 * fonts have loaded. Page index survives a resize by keeping the first visible item in view; a
 * change of URL search params (a filter or the server `?page=`) goes back to page 1.
 *
 * Side effects it manages on purpose: `viewport.style.minHeight` is set to the tallest page
 * while there is more than one page, so the card (and the pager under it) does not jump in
 * height between a full page and the short last one; the last visible item carries
 * `data-fit-last` so CSS can drop its bottom divider.
 */
export function useFitPager({ enabled, rootRef, viewportRef, listSelector, headerSelector, fitColumns = false }: UseFitPagerOptions) {
  const [state, setState] = useState<FitPagerState>(EMPTY);
  const starts = useRef<number[]>([0]);
  const pageRef = useRef(0);
  const urlKey = useRef<string | null>(null);
  const raf = useRef(0);

  const getList = useCallback((): HTMLElement | null => {
    const viewport = viewportRef.current;
    if (!viewport) return null;
    return listSelector ? viewport.querySelector<HTMLElement>(listSelector) : viewport;
  }, [viewportRef, listSelector]);

  const apply = useCallback(
    (page: number) => {
      const list = getList();
      if (!list) return;
      const items = itemsOf(list);
      const from = starts.current[page] ?? 0;
      const to = starts.current[page + 1] ?? items.length;
      items.forEach((el, i) => {
        const hide = i < from || i >= to;
        if (el.hidden !== hide) el.hidden = hide;
        if (i === to - 1) el.setAttribute('data-fit-last', '');
        else el.removeAttribute('data-fit-last');
      });
    },
    [getList],
  );

  const reset = useCallback(() => {
    const list = getList();
    if (list) {
      for (const el of itemsOf(list)) {
        el.hidden = false;
        el.removeAttribute('data-fit-last');
      }
    }
    if (viewportRef.current) {
      viewportRef.current.style.minHeight = '';
      if (fitColumns) revealTableColumns(viewportRef.current);
    }
  }, [getList, viewportRef, fitColumns]);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const list = getList();
    if (!viewport || !list) return;
    const items = itemsOf(list);
    const total = items.length;

    // Reveal everything and drop the propped height so the box reports the room it really has.
    for (const el of items) if (el.hidden) el.hidden = false;
    viewport.style.minHeight = '';
    const hiddenColumns = fitColumns ? fitTableColumns(viewport) : 0;
    const header = headerSelector ? viewport.querySelector<HTMLElement>(headerSelector) : null;
    const headerH = header ? header.getBoundingClientRect().height : 0;
    // The room for items is the content box: padding (e.g. the 4px that keeps a focus ring from
    // being clipped) is not page room.
    const style = getComputedStyle(viewport);
    const room = viewport.clientHeight - headerH - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);

    if (total === 0 || room <= 0) {
      starts.current = [0];
      pageRef.current = 0;
      setState((prev) =>
        prev.total === total && prev.pageCount === 1 && prev.ready && prev.hiddenColumns === hiddenColumns
          ? prev
          : { ...EMPTY, total, to: total, from: total ? 1 : 0, ready: true, hiddenColumns },
      );
      return;
    }

    // Greedy page breaks from the real boxes: a page ends before the item whose bottom edge
    // would pass the room measured from the first item of that page.
    const rects = items.map((el) => el.getBoundingClientRect());
    const breaks = [0];
    let top = rects[0]?.top ?? 0;
    for (let i = 1; i < total; i++) {
      const rect = rects[i];
      if (rect && rect.bottom - top > room + 0.5) {
        breaks.push(i);
        top = rect.top;
      }
    }

    // Keep the first visible item on screen across a re-measure; a new URL goes back to page 1.
    const key = typeof window === 'undefined' ? '' : window.location.pathname + window.location.search;
    const sameUrl = urlKey.current === null || urlKey.current === key;
    urlKey.current = key;
    const prevFirst = starts.current[pageRef.current] ?? 0;
    let page = 0;
    if (sameUrl) {
      for (let k = 0; k < breaks.length; k++) if ((breaks[k] ?? 0) <= prevFirst) page = k;
    } else if (consumeLandOnLast()) {
      page = breaks.length - 1;
    }

    starts.current = breaks;
    pageRef.current = page;

    // Prop the box open to the tallest page so the pager below it never moves.
    if (breaks.length > 1) {
      let tallest = 0;
      for (let k = 0; k < breaks.length; k++) {
        const first = rects[breaks[k] ?? 0];
        const last = rects[(breaks[k + 1] ?? total) - 1];
        if (first && last) tallest = Math.max(tallest, last.bottom - first.top);
      }
      viewport.style.minHeight = `${Math.ceil(headerH + tallest)}px`;
    }

    apply(page);
    const from = (breaks[page] ?? 0) + 1;
    const to = breaks[page + 1] ?? total;
    setState((prev) =>
      prev.ready &&
      prev.page === page &&
      prev.pageCount === breaks.length &&
      prev.total === total &&
      prev.from === from &&
      prev.to === to &&
      prev.hiddenColumns === hiddenColumns
        ? prev
        : { page, pageCount: breaks.length, from, to, total, ready: true, hiddenColumns },
    );
  }, [viewportRef, getList, headerSelector, apply, fitColumns]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(measure);
  }, [measure]);

  // Measure before first paint (so there is no flash of a clipped or overflowing list), then keep
  // watching. Switching off (a window that stops being "desktop") restores every item.
  useLayoutEffect(() => {
    if (!enabled) {
      reset();
      starts.current = [0];
      pageRef.current = 0;
      urlKey.current = null;
      return;
    }
    measure();
    const viewport = viewportRef.current;
    const list = getList();
    const frameParent = rootRef.current?.parentElement ?? null;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (viewport) ro?.observe(viewport);
    if (frameParent) ro?.observe(frameParent);
    const mo = list ? new MutationObserver(schedule) : null;
    if (list) mo?.observe(list, { childList: true });
    window.addEventListener('resize', schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(raf.current);
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, measure, schedule, reset, getList, viewportRef, rootRef]);

  const goTo = useCallback(
    (page: number) => {
      const max = starts.current.length - 1;
      const next = Math.min(Math.max(0, page), max);
      if (next === pageRef.current) return;
      pageRef.current = next;
      apply(next);
      const total = state.total;
      setState((prev) => ({
        ...prev,
        page: next,
        from: (starts.current[next] ?? 0) + 1,
        to: starts.current[next + 1] ?? total,
      }));
    },
    [apply, state.total],
  );

  const next = useCallback(() => goTo(pageRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(pageRef.current - 1), [goTo]);

  // Switched off (not a desktop window): report the empty state whatever was measured before.
  return { state: enabled ? state : EMPTY, goTo, next, prev };
}
