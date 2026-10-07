'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { ButtonSize } from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export interface DeleteShiftButtonProps {
  shiftId: number;
  shiftName: string;
  /** sm inside a table row; md in the phone card list, where it is a touch target. */
  size?: ButtonSize;
}

/**
 * The backend decides hard-delete vs soft-deactivate depending on whether a
 * user's shift_id or attendance history references this shift (TRD.md §6,
 * deactivateShiftInOrg in lib/queries/shifts.ts) — this button only confirms
 * and calls DELETE, it never needs to know which one happens.
 */
export default function DeleteShiftButton({ shiftId, shiftName, size = 'sm' }: DeleteShiftButtonProps) {
  const router = useRouter();
  const { show } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        show(json.error?.message ?? 'Gagal menghapus shift.', 'error');
        return;
      }
      show('Shift berhasil dihapus atau dinonaktifkan.', 'success');
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="danger-ghost"
        size={size}
        onClick={() => setConfirmOpen(true)}
        aria-label={`Hapus ${shiftName}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Hapus
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus shift?"
        description={`Hapus shift "${shiftName}"? Jika shift ini masih dipakai karyawan atau tercatat di riwayat absensi, shift hanya dinonaktifkan agar riwayatnya tetap utuh.`}
        confirmLabel="Hapus"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
