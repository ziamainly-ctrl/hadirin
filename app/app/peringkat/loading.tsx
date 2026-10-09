import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Real title, then the month/branch pickers, the podium row and the table card as placeholders of
// the same size as the finished page (TRD.md §14).
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header title="Peringkat" description="Siapa yang paling tepat waktu bulan ini. Dihitung dari hari kerja dengan hasil final." />
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
        <Skeleton className="h-[62px] sm:w-44" />
        <Skeleton className="h-[62px] sm:w-44" />
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat peringkat…
        </span>
        <div className="hidden shrink-0 grid-cols-3 gap-3 sm:grid">
          <Skeleton className="h-[66px] rounded-card" />
          <Skeleton className="h-[66px] rounded-card" />
          <Skeleton className="h-[66px] rounded-card" />
        </div>
        <Skeleton className="h-64 rounded-card lg:min-h-48 lg:flex-1" />
      </Page.Body>
    </Page>
  );
}
