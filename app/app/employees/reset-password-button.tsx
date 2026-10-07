'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Dialog from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

export interface ResetPasswordButtonProps {
  userId: number;
  userName: string;
}

/**
 * OWNER/ADMIN-only action on the employee detail page. POSTs
 * /api/users/[id]/reset-password (TRD.md §6) and reveals the returned one-time
 * temporaryPassword the same way EmployeeFormDialog's create flow does: a banner
 * that can only be dismissed through the explicit "Selesai" button.
 */
export default function ResetPasswordButton({ userId, userName }: ResetPasswordButtonProps) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  async function handleReset() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      if (!res.ok) {
        show(json.error?.message ?? 'Gagal mereset kata sandi.', 'error');
        return;
      }

      setTemporaryPassword(json.data.temporaryPassword as string);
      setOpen(true);
      show('Kata sandi berhasil direset.', 'success');
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  }

  function handleAcknowledge() {
    setOpen(false);
    setTemporaryPassword(null);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)} className="gap-2">
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Reset Kata Sandi
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Reset kata sandi?"
        description={`Reset kata sandi untuk ${userName}? Kata sandi sementara yang baru akan dibuat.`}
        confirmLabel="Reset"
        variant="primary"
        isLoading={isSubmitting}
        onConfirm={handleReset}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Not dismissible: this dialog only ever shows the one-time reveal, so Escape, a
          backdrop click and the X must not be able to close it — only "Selesai" can. */}
      <Dialog open={open} onClose={handleAcknowledge} dismissible={false} title="Kata Sandi Sementara">
        <Dialog.Body>
          <div className="rounded-input border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Kata sandi sementara baru:</p>
            <p className="mt-1 select-all break-all font-mono text-base">{temporaryPassword}</p>
            <p className="mt-2 text-amber-700 dark:text-amber-300">
              Catat kata sandi ini sekarang. Kata sandi ini tidak akan ditampilkan lagi setelah dialog ini ditutup.
            </p>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" onClick={handleAcknowledge}>
            Selesai
          </Button>
        </Dialog.Footer>
      </Dialog>
    </>
  );
}
