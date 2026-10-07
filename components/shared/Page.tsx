import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Page frame for /app and /platform pages. On desktop the shell is one viewport tall and the
 * window never scrolls, so a page is a column: a fixed header (title, description, primary
 * action), optional filters, and a body that takes the remaining height and scrolls inside
 * itself when its content (a long list) doesn't fit. Below lg it is a plain stacked page.
 *
 *   <Page>
 *     <Page.Header title="Karyawan" description="..." actions={<Button>Tambah</Button>} />
 *     <Page.Toolbar>filters</Page.Toolbar>            (optional, stays fixed under the header)
 *     <Page.Body><Table>...</Table></Page.Body>
 *   </Page>
 *
 * A <Table> placed directly in Page.Body does not make the body scroll: the table card shrinks
 * to the space that is left and its rows scroll under a pinned header row (ui/TableFrame).
 * Content that is not a table (cards, a form) scrolls the Page.Body itself, and a page that
 * wants several independently scrolling columns puts them in a grid inside Page.Body.
 *
 * Focus-ring room: a scroll container clips everything outside its padding box, and a control
 * that sits flush with the page edge (the first filter, the last header button) has a 3px ring.
 * Page.Body therefore bleeds 4px sideways and the layout's own scroll wrapper (app/app/layout.tsx,
 * app/platform/(authenticated)/layout.tsx) carries `lg:p-1` for that bleed and for the ring.
 * Page itself must NOT clip (an overflow-x clip here cut the ring of every flush control).
 */
function Page({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col gap-4 lg:h-full lg:min-h-0 ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Primary action(s), top-right on desktop, under the title on mobile. */
  actions?: ReactNode;
  /** Keep the actions beside the title on a phone instead of on their own row: for one short
   * button ("Tambah") next to a short title. A long title wraps onto a second line. */
  inlineActions?: boolean;
  className?: string;
}

function PageHeader({ title, description, actions, inlineActions = false, className }: PageHeaderProps) {
  return (
    <div
      className={`flex shrink-0 gap-3 ${inlineActions ? 'items-start justify-between' : 'flex-col sm:flex-row sm:items-start sm:justify-between'} ${className ?? ''}`}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Filters / tabs / search row. Fixed (never scrolls) between the header and the body. */
function PageToolbar({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex shrink-0 flex-wrap items-center gap-2 ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}

/**
 * The 4px of negative margin + padding (lg only) is room for the 3px focus ring of a control
 * that sits on the body's edge: a scroll container clips everything outside its padding box.
 */
function PageBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col gap-4 lg:-mx-1 lg:-mt-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-1 ${className ?? ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}

Page.Header = PageHeader;
Page.Toolbar = PageToolbar;
Page.Body = PageBody;

export default Page;
