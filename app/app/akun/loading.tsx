import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Same two-column frame as the finished page (profile + preferences on the left, the password
// form on the right); only the data is a placeholder.
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header title="Akun Saya" description="Profil, keamanan, dan preferensi akun Anda." />
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat data…
        </span>
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </Page.Body>
    </Page>
  );
}
