import TableSkeleton from '@/components/shared/TableSkeleton';

// Shown the instant a sidebar link is pressed, while the server renders the page: the title is
// already real, only the data is a placeholder (TRD.md §14).
export default function Loading() {
  return <TableSkeleton title="Paket" description="Kelola paket berlangganan, harga, batas, dan fitur." action columns={5} rows={3} />;
}
