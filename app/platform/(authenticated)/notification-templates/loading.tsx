import TableSkeleton from '@/components/shared/TableSkeleton';

// Shown the instant a sidebar link is pressed, while the server renders the page: the title is
// already real, only the data is a placeholder (TRD.md §14).
export default function Loading() {
  return <TableSkeleton title="Template Notifikasi" description="Template default untuk seluruh organisasi. Organisasi yang paketnya mendukung kustomisasi dapat menggantinya dengan template mereka sendiri." columns={2} rows={7} />;
}
