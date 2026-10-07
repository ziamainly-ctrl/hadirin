import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant the sidebar link is pressed, while the server renders the list: the title
// is already real, only the data is a placeholder (TRD.md §14: admin pages stream with skeletons).
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header title="Cabang" description="Kelola lokasi dan radius absensi GPS tiap cabang." actions={<Skeleton className="h-10 w-40" />} />
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data…
        </span>
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </Page.Body>
    </Page>
  );
}
