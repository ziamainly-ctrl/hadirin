import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant "Galeri Selfie" is pressed while the server counts and lists the photos: the
// title is real, the filters, summary line and a grid of square placeholders have the size of the
// finished page (TRD.md section 14).
export default function Loading() {
  return (
    <Page aria-busy="true">
      <Page.Header
        title="Galeri Selfie"
        description="Foto check-in dan check-out karyawan untuk ditinjau. Foto bersifat pribadi: hanya pemilik, admin, dan atasan langsung yang dapat melihatnya."
      />
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Skeleton className="h-10 w-full sm:w-[160px]" />
        <Skeleton className="h-[62px] w-full sm:w-[348px]" />
        <Skeleton className="h-[62px] w-full sm:w-44" />
        <Skeleton className="h-[62px] w-full sm:w-44" />
        <Skeleton className="h-[62px] w-full sm:w-44" />
      </div>
      <Skeleton className="h-5 w-64 shrink-0" />
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat galeri selfie…
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:content-start xl:grid-cols-5 min-[1800px]:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-card" />
          ))}
        </div>
      </Page.Body>
    </Page>
  );
}
