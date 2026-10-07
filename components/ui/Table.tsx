import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

/**
 * Thin, styled wrapper around <table>. It only renders — pair it with
 * ui/Pagination for server-paginated lists (TRD.md §14: 25 rows per page).
 *
 * Cells don't wrap (whitespace-nowrap): on a phone the wrapper scrolls sideways instead of
 * squeezing every column until names and dates break across five lines. A column that
 * really holds long free text (an address) opts back in with `whitespace-normal min-w-*`.
 */
function Table({ className, children, ...rest }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-card border border-border bg-surface">
      <table className={`w-full border-collapse text-left text-sm ${className ?? ''}`} {...rest}>
        {children}
      </table>
    </div>
  );
}

function TableHead({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-accent/50 text-xs uppercase tracking-wide text-muted ${className ?? ''}`} {...rest}>
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

function TableRow({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-accent/50 ${className ?? ''}`} {...rest}>
      {children}
    </tr>
  );
}

function TableHeadCell({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={`whitespace-nowrap px-4 py-3.5 font-medium ${className ?? ''}`} {...rest}>
      {children}
    </th>
  );
}

function TableCell({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`whitespace-nowrap px-4 py-3.5 text-text ${className ?? ''}`} {...rest}>
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
