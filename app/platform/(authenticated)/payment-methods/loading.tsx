import TableSkeleton from '@/components/shared/TableSkeleton';

// Shown the instant a sidebar link is pressed, while the server renders the page: the title is
// already real, only the data is a placeholder (TRD.md §14).
export default function Loading() {
  return <TableSkeleton title="Metode Pembayaran" description="Kelola metode pembayaran, biaya admin, dan urutan tampil saat checkout." action columns={4} rows={8} />;
}
