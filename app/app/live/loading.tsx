import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant "Live" is pressed: the title is already real, only the numbers and the feed
// are placeholders, in the same frame as the finished page so nothing jumps when it streams in.
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header
        title="Live"
        description="Aktivitas check-in dan check-out hari ini, diperbarui otomatis."
        actions={<Skeleton className="h-8 w-52" />}
      />
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 xl:p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data…
        </span>
        <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-1">
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-3/4" />
          </div>
        </div>
      </Page.Body>
    </Page>
  );
}
