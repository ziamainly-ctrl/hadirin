import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant "Absensi" is pressed, while the server renders the first page of rows: the
// title is real, the filter row and the table are placeholders of the same size, and the table
// fills the rest of the viewport on desktop exactly like the finished page (TRD.md §14).
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header
        title="Absensi"
        description="Riwayat check-in dan check-out karyawan, lengkap dengan foto dan lokasi."
      />
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <Skeleton className="col-span-2 h-[62px] sm:w-[348px]" />
        <Skeleton className="col-span-2 h-[62px] sm:w-44" />
        <Skeleton className="col-span-2 h-[62px] sm:w-40" />
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data absensi…
        </span>
        <div className="overflow-hidden rounded-card border border-border bg-surface lg:min-h-0 lg:flex-1">
          <div className="flex items-center gap-8 bg-accent px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]">
            {[28, 24, 20, 14, 14].map((width, i) => (
              <Skeleton key={i} className="h-3" style={{ width: `${width * 4}px` }} />
            ))}
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-8 px-4 py-3.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </div>
      </Page.Body>
    </Page>
  );
}
