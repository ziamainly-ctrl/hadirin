'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export interface HolidayDeleteButtonProps {
  holidayId: number;
  holidayName: string;
  /** "Hapus" label on a button, or a compact one for the list. */
  compact?: boolean;
}

/** Deletes a COMPANY holiday (DELETE /api/holidays/[id], scoped to the org on the server). */
export default function HolidayDeleteButton({ holidayId, holidayName, compact = false }: HolidayDeleteButtonProps) {
  const router = useRouter();
  const { show } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/holidays/${holidayId}`, { method: 'DELETE' });
      if (res.ok) {
        show('Hari libur dihapus.', 'success');
        setConfirmOpen(false);
        router.refresh();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      show(res.status === 404 ? 'Hari libur ini sudah tidak ada.' : (json.error?.message ?? 'Gagal menghapus hari libur.'), 'error');
      if (res.status === 404) {
        setConfirmOpen(false);
        router.refresh();
      }
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="danger-ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        aria-label={`Hapus hari libur ${holidayName}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {compact ? <span className="sr-only">Hapus</span> : 'Hapus'}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus hari libur?"
        description={`Hapus "${holidayName}" dari kalender perusahaan? Absensi yang sudah tercatat tidak berubah.`}
        confirmLabel="Hapus"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
