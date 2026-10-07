import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant "Laporan" is pressed, while the server computes the monthly recap: the title is
// real, the exports, pickers, two chart cards and the recap table are placeholders of the same size
// as the finished page (TRD.md §14).
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header
        title="Laporan"
        description="Rekap kehadiran bulanan per karyawan, siap diunduh."
        actions={
          <>
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-32" />
          </>
        }
      />
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
        <Skeleton className="h-[62px] sm:w-44" />
        <Skeleton className="h-[62px] sm:w-44" />
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat laporan…
        </span>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-44 rounded-card" />
          <Skeleton className="h-44 rounded-card" />
        </div>
        <Skeleton className="h-64 rounded-card lg:min-h-48 lg:flex-1" />
      </Page.Body>
    </Page>
  );
}
