import TableSkeleton from '@/components/shared/TableSkeleton';

// Shown the instant a sidebar link is pressed, while the server renders the page: the title is
// already real, only the data is a placeholder (TRD.md §14).
export default function Loading() {
  return <TableSkeleton title="Hari Libur Nasional" description="Kelola tanggal libur nasional dan cuti bersama untuk semua organisasi." action toolbar columns={4} rows={5} />;
}
