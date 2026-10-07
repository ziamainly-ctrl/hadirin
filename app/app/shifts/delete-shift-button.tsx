'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
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

  async function handleDelete() {
    if (!window.confirm(`Hapus shift "${shiftName}"? Tindakan ini tidak bisa dibatalkan.`)) return;

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
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      isLoading={isDeleting}
      className="gap-1.5 text-red-600 dark:text-red-400"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      Hapus
    </Button>
  );
}
