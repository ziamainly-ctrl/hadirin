import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Covers the hub and the three sub-pages (organization, billing, notifications) with one
// neutral placeholder: a heading line plus a card of fields, so navigation never freezes.
export default function Loading() {
  return (
    <Page aria-busy="true">
      <div className="flex shrink-0 flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat pengaturan…
        </span>
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
      </Page.Body>
    </Page>
  );
}
