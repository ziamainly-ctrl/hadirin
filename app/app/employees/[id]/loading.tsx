import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// The detail route needs its own placeholder: without it the list skeleton one folder up
// would flash while a single employee loads (a table where a facts card is about to appear).
export default function Loading() {
  return (
    <Page aria-busy="true" className="w-full max-w-4xl">
      <Skeleton className="h-5 w-40" />
      <div className="flex shrink-0 flex-col gap-2">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data karyawan…
        </span>
        <div className="grid gap-x-6 gap-y-5 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </Page.Body>
    </Page>
  );
}
