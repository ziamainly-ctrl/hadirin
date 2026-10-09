import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Same frame as the finished page (title, month bar, grid card), so nothing jumps when the month
// streams in: the title is already real, only the month and its numbers are placeholders.
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header
        title="Kalender"
        description="Kehadiran per hari beserta hari libur. Pilih tanggal untuk melihat rincian."
        inlineActions
      />
      <Page.Toolbar className="items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-end gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-10" />
        </div>
        <Skeleton className="mb-2 h-5 w-64 max-w-full" />
      </Page.Toolbar>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat kalender…
        </span>
        <Skeleton className="min-h-80 flex-1 rounded-card lg:min-h-0" />
      </Page.Body>
    </Page>
  );
}
