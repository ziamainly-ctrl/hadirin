import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Same frame as TodayView inside the admin shell (a LEFT-aligned max-w-3xl Page, like every other
// admin page: app/app/check-in/page.tsx overrides TodayView's mx-auto with ml-0!), so the title and
// the card do not jump sideways when the real screen streams in.
export default function Loading() {
  return (
    <Page aria-busy="true" className="w-full max-w-3xl">
      <Page.Header title="Hari ini" description="Absen masuk dan keluar dengan GPS dan selfie." />
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data…
        </span>
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex flex-col items-center gap-3 py-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-48 w-full max-w-xs" />
            <Skeleton className="h-12 w-full max-w-xs" />
          </div>
        </div>
      </Page.Body>
    </Page>
  );
}
