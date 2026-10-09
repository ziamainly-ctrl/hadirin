import type { ComponentProps, HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import TableFrame from './TableFrame';
import type { TableFrameProps } from './TableFrame';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Desktop zero-scroll pager (default on): rows are paginated to fit the card. See TableFrame. */
  fit?: boolean;
  /** The server chunk these rows belong to (see TableFrame): one footer pages across chunks. */
  serverPager?: TableFrameProps['serverPager'];
}

/**
 * Thin, styled wrapper around <table>. It only renders — pair it with
 * ui/Pagination for server-paginated lists (TRD.md §14: 25 rows per page).
 *
 * Scrolling (components/ui/TableFrame.tsx): the table sits in a bordered card. Drop a <Table>
 * straight into <Page.Body> and, on desktop (>= 1024x560), the card shrinks to the space left and
 * the loaded rows are PAGINATED to fit it (a "13-24 dari 36 data" footer with prev / next) — nothing
 * inside scrolls, the page header and filters never move and the window never scrolls. Below lg
 * (or anywhere the height isn't bound) it simply grows with its rows. A table wider than its card
 * scrolls sideways on a phone/tablet, with a soft shadow on the side that has more. On desktop it
 * never scrolls sideways either: give the secondary header cells a `priority` and the frame hides
 * the highest-numbered columns (header + cells) until the table fits, saying how many in its footer.
 * Rows must be DIRECT children of a single <tbody> and all be on one page's worth of server data
 * (cap the query, e.g. 100); the pager only splits what is already rendered.
 *
 * Cells don't wrap (whitespace-nowrap): on a phone the card scrolls sideways instead of
 * squeezing every column until names and dates break across five lines. A cell that
 * really holds long free text (an address, a note) opts back in with the `wrap` prop, plus
 * a `min-w-*` class so it can't collapse to one word per line. (A `whitespace-normal`
 * className can't do it: it ties with the baked-in whitespace-nowrap on specificity and
 * the stylesheet order, not the class order, decides — the nowrap always won.)
 *
 * tabular-nums: prices, counts, dates and times line up digit-for-digit down a column, so
 * "Rp 99.000" and "Rp 299.000" can be compared at a glance.
 *
 * The header cells are `sticky top-0` with an opaque fill and an inset bottom line (a border
 * on a sticky cell in border-collapse mode stays behind when the row scrolls).
 */
function Table({ className, children, fit = true, serverPager, ...rest }: TableProps) {
  return (
    <TableFrame label={rest['aria-label']} fit={fit} serverPager={serverPager}>
      <table className={`w-full border-collapse text-left text-sm tabular-nums ${className ?? ''}`} {...rest}>
        {children}
      </table>
    </TableFrame>
  );
}

function TableHead({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`text-xs uppercase tracking-wide text-muted ${className ?? ''}`} {...rest}>
      {children}
    </thead>
  );
}

function TableBody({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-border ${className ?? ''}`} {...rest}>
      {children}
    </tbody>
  );
}

// ComponentProps<'tr'> carries `ref` (React 19 passes ref as a plain prop to a function
// component), so a sortable row (@dnd-kit's setNodeRef) can use Table.Row and share its hover.
function TableRow({ className, children, ...rest }: ComponentProps<'tr'>) {
  return (
    <tr className={`transition-colors duration-150 hover:bg-text/5 ${className ?? ''}`} {...rest}>
      {children}
    </tr>
  );
}

export interface TableHeadCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Icon-only column (a drag handle, a checkbox): tight padding instead of the 16px gutters. */
  narrow?: boolean;
  /** Desktop column fit: when the table is wider than its card, columns are hidden (header and
   * every cell under it), the HIGHEST number first, until it fits; the footer says how many.
   * Leave it off for a column that must always show (the name, the status). 1 = hide last resort,
   * 3 = hide first. Only the header cell takes it; the body cells follow by column index. */
  priority?: 1 | 2 | 3 | 4;
}

function TableHeadCell({ className, narrow = false, priority, children, ...rest }: TableHeadCellProps) {
  return (
    <th
      scope="col"
      data-priority={priority}
      className={`sticky top-0 z-10 whitespace-nowrap bg-accent ${narrow ? 'w-12 px-2' : 'px-4'} py-3 fit-cell-y font-medium shadow-[inset_0_-1px_0_var(--color-border)] ${className ?? ''}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Let this cell's text wrap (long free text). Default: one line, the table scrolls. */
  wrap?: boolean;
  /** Icon-only column (a drag handle, a checkbox): tight padding instead of the 16px gutters. */
  narrow?: boolean;
}

function TableCell({ className, wrap = false, narrow = false, children, ...rest }: TableCellProps) {
  return (
    <td
      className={`${wrap ? 'whitespace-normal' : 'whitespace-nowrap'} ${narrow ? 'w-12 px-2' : 'px-4'} py-3 fit-cell-y text-text ${className ?? ''}`}
      {...rest}
    >
      {children}
    </td>
  );
}

Table.Head = TableHead;
Table.Body = TableBody;
Table.Row = TableRow;
Table.HeadCell = TableHeadCell;
Table.Cell = TableCell;

export default Table;
