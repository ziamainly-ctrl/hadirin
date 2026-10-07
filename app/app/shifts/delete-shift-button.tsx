'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export interface DeleteShiftButtonProps {
  shiftId: number;
  shiftName: string;
}

/**
 * The backend decides hard-delete vs soft-deactivate depending on whether a
 * user's shift_id or attendance history references this shift (TRD.md §6,
 * deactivateShiftInOrg in lib/queries/shifts.ts) — this button only confirms
 * and calls DELETE, it never needs to know which one happens.
 */
export default function DeleteShiftButton({ shiftId, shiftName }: DeleteShiftButtonProps) {
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
      show('Shift berhasil dihapus.', 'success');
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
        variant="ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        className="gap-1.5 text-destructive"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Hapus
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus shift?"
        description={`Hapus shift "${shiftName}"? Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
