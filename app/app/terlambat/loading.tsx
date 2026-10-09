import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant "Terlambat" is pressed while the server runs the aggregates: the title is real,
// the preset chips / filters, the tab bar, the four tiles and the table are placeholders of the same
// size as the finished page (TRD.md section 14).
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header
        title="Terlambat"
        description="Siapa yang sering terlambat dan seberapa lama, dihitung dari jam masuk shift."
      />
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Skeleton className="h-10 w-full sm:w-[390px]" />
        <Skeleton className="h-[62px] w-full sm:w-[348px]" />
        <Skeleton className="h-[62px] w-full sm:w-44" />
      </div>
      <Skeleton className="h-9 w-full max-w-md shrink-0" />
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[84px] rounded-card" />
        ))}
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data keterlambatan…
        </span>
        <div className="overflow-hidden rounded-card border border-border bg-surface lg:min-h-0 lg:flex-1">
          <div className="flex items-center gap-8 bg-accent px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]">
            {[28, 16, 16, 16, 14].map((width, i) => (
              <Skeleton key={i} className="h-3" style={{ width: `${width * 4}px` }} />
            ))}
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex items-center gap-8 px-4 py-3.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </div>
      </Page.Body>
    </Page>
  );
}
