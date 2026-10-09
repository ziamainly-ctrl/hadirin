import TableSkeleton from '@/components/shared/TableSkeleton';

// Real title; the status tabs and table rows are placeholders (TRD.md §14).
export default function Loading() {
  return (
    <TableSkeleton
      title="Log Notifikasi"
      description="Riwayat email dan WhatsApp yang dikirim Hadirin atas nama organisasi Anda, lengkap dengan hasil pengirimannya."
      toolbar
      columns={5}
    />
  );
}
