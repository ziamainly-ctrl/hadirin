'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export interface RequestActionsProps {
  requestId: number;
}

/**
 * Self-service cancel for one PENDING attendance_requests row (PRD.md E6). Client
 * component because it owns an onClick — rendered inside the request's own card (as
 * RequestCard children) by requests/page.tsx, a Server Component, which supplies only the
 * plain requestId prop. Cancelling can't be undone, so it goes through ConfirmDialog
 * instead of firing on the first tap.
 */
export default function RequestActions({ requestId }: RequestActionsProps) {
  const router = useRouter();
  const { show } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCancel() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/attendance-requests/${requestId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        show(json.error?.message ?? 'Gagal membatalkan pengajuan.', 'error');
        return;
      }
      setConfirmOpen(false);
      show('Pengajuan dibatalkan.', 'success');
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex justify-end border-t border-border pt-3">
      <Button variant="outline" onClick={() => setConfirmOpen(true)}>
        Batalkan Pengajuan
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Batalkan pengajuan?"
        description="Pengajuan ini akan ditarik dan tidak lagi ditinjau atasan Anda. Anda bisa mengajukan ulang kapan saja."
        confirmLabel="Ya, Batalkan"
        cancelLabel="Kembali"
        isLoading={isSubmitting}
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
