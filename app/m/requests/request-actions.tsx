'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export interface RequestActionsProps {
  requestId: number;
}

/**
 * Self-service cancel for one PENDING attendance_requests row (PRD.md E6). Client
 * component because it owns an onClick — rendered under requests/page.tsx, a Server
 * Component, which supplies only the plain requestId prop.
 */
export default function RequestActions({ requestId }: RequestActionsProps) {
  const router = useRouter();
  const { show } = useToast();
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
      show('Pengajuan dibatalkan.', 'success');
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCancel} isLoading={isSubmitting} className="text-destructive">
      Batalkan
    </Button>
  );
}
