import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Real title; the period chips, four tiles and the 2 x 2 chart grid are placeholders of the same
// size as the finished page (TRD.md §14).
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header title="Statistik" description="Tren kehadiran 30 hari terakhir: tingkat kehadiran, jam check-in, dan hari tersibuk." />
      <Page.Toolbar className="items-end gap-x-4 gap-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
        <Skeleton className="h-[62px] w-44" />
      </Page.Toolbar>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat statistik…
        </span>
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-card" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[repeat(2,minmax(8.5rem,1fr))] xl:grid-cols-3">
          <Skeleton className="h-52 rounded-card xl:col-span-2 lg:h-auto" />
          <Skeleton className="h-52 rounded-card lg:h-auto" />
          <Skeleton className="h-52 rounded-card xl:col-span-2 lg:h-auto" />
          <Skeleton className="h-52 rounded-card lg:h-auto" />
        </div>
      </Page.Body>
    </Page>
  );
}
