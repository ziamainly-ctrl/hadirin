'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Dialog from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import TemporaryPasswordNotice from './temporary-password-notice';

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
      {/* Same weight as the "Edit" button beside it on the detail page (secondary): an outline next to a
          filled secondary read as two different kinds of button. */}
      <Button type="button" variant="secondary" onClick={() => setConfirmOpen(true)}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Reset Kata Sandi
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Reset kata sandi?"
        description={`Kata sandi ${userName} saat ini tidak bisa dipakai lagi. Sistem akan membuat kata sandi sementara yang baru untuk diberikan kepadanya.`}
        confirmLabel="Reset Kata Sandi"
        variant="primary"
        isLoading={isSubmitting}
        onConfirm={handleReset}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Not dismissible: this dialog only ever shows the one-time reveal, so Escape, a
          backdrop click and the X must not be able to close it — only "Selesai" can. */}
      <Dialog open={open} onClose={handleAcknowledge} dismissible={false} title="Kata Sandi Sementara">
        <Dialog.Body>
          {temporaryPassword ? <TemporaryPasswordNotice password={temporaryPassword} employeeName={userName} /> : null}
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
