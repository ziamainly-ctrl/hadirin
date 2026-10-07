'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export interface DeleteBranchButtonProps {
  branchId: number;
  branchName: string;
}

/**
 * The backend decides hard-delete vs soft-deactivate depending on whether
 * attendance history references this branch (TRD.md §6, deactivateBranchInOrg
 * in lib/queries/branches.ts) — this button only confirms and calls DELETE,
 * it never needs to know which one happens.
 */
export default function DeleteBranchButton({ branchId, branchName }: DeleteBranchButtonProps) {
  const router = useRouter();
  const { show } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Hapus cabang "${branchName}"? Tindakan ini tidak bisa dibatalkan.`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/branches/${branchId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        show(json.error?.message ?? 'Gagal menghapus cabang.', 'error');
        return;
      }
      show('Cabang berhasil dihapus.', 'success');
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
      className="gap-1.5 text-red-600"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      Hapus
    </Button>
  );
}
