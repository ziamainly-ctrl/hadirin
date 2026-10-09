import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant "Riwayat Saya" is pressed: the real title and the same frame as the finished
// page (a row of month tiles above a table), so nothing jumps when the data streams in. The shared
// TableSkeleton has no tile row, hence the frame is spelled out here.
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header title="Riwayat Saya" description="Catatan absensi Anda sendiri, dari yang terbaru." />
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 xl:p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data…
        </span>
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="flex items-center gap-4 bg-accent px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="ml-auto h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }, (_, r) => (
              <div key={r} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="ml-auto h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </Page.Body>
    </Page>
  );
}
