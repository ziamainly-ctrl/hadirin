import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant "Persetujuan" is pressed, while the server renders the inbox: the title and the
// tab row are already real in the finished page, so only the cards are placeholders (TRD.md §14).
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header title="Persetujuan" description="Tinjau pengajuan koreksi, cuti, sakit, dan izin dari tim Anda." />
      <div className="flex shrink-0 gap-4 border-b border-border">
        {[16, 14, 12].map((width, i) => (
          <div key={i} className="flex h-10 items-center">
            <Skeleton className="h-4" style={{ width: `${width * 4}px` }} />
          </div>
        ))}
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat pengajuan…
        </span>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </div>
      </Page.Body>
    </Page>
  );
}
