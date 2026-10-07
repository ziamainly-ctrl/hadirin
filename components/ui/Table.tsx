import type { ComponentProps, HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import TableFrame from './TableFrame';

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

/**
 * Thin, styled wrapper around <table>. It only renders — pair it with
 * ui/Pagination for server-paginated lists (TRD.md §14: 25 rows per page).
 *
 * Scrolling (components/ui/TableFrame.tsx): the table sits in a bordered card that is its own
 * scroll box. Drop a <Table> straight into <Page.Body> and, when the rows don't fit the
 * screen on desktop, the card shrinks to the space left and the ROWS scroll inside it with
 * the header row pinned — the page header and filters never move and the window never
 * scrolls. Below lg (or anywhere the height isn't bound) it simply grows with its rows. Wide
 * tables scroll sideways inside the same card, with a soft shadow on the side that has more.
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
function Table({ className, children, ...rest }: TableProps) {
  return (
    <TableFrame label={rest['aria-label']}>
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
    <tr className={`hover:bg-text/5 ${className ?? ''}`} {...rest}>
      {children}
    </tr>
  );
}

export interface TableHeadCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Icon-only column (a drag handle, a checkbox): tight padding instead of the 16px gutters. */
  narrow?: boolean;
}

function TableHeadCell({ className, narrow = false, children, ...rest }: TableHeadCellProps) {
  return (
    <th
      scope="col"
      className={`sticky top-0 z-10 whitespace-nowrap bg-accent ${narrow ? 'w-12 px-2' : 'px-4'} py-3 font-medium shadow-[inset_0_-1px_0_var(--color-border)] ${className ?? ''}`}
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
      className={`${wrap ? 'whitespace-normal' : 'whitespace-nowrap'} ${narrow ? 'w-12 px-2' : 'px-4'} py-3 text-text ${className ?? ''}`}
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
