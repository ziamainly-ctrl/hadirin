'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import RequestCard from '@/components/shared/RequestCard';
import type { RequestType } from '@/lib/constants/statuses';

export interface ReviewActionsProps {
  requestId: number;
  type: RequestType;
  dateFrom: string;
  dateTo: string;
  reason: string;
  requesterName: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  attachmentHref?: string;
  submittedAt: string | Date;
  timeZone: string;
}

interface ApiErrorBody {
  error?: { code: string; message: string };
}

/**
 * Client wrapper around the shared RequestCard for one PENDING attendance
 * request. Owns the optional review note and PATCHes
 * /api/attendance-requests/[id] (TRD.md §8) with { action, note }, reading the
 * { data } / { error } envelope (lib/api-response.ts). On success it toasts
 * and calls router.refresh() so the Server Component page
 * (app/app/requests/page.tsx) re-reads the list from the server — there is no
 * client-side cache to invalidate.
 */
export default function ReviewActions({
  requestId,
  type,
  dateFrom,
  dateTo,
  reason,
  requesterName,
  requestedCheckIn,
  requestedCheckOut,
  attachmentHref,
  submittedAt,
  timeZone,
}: ReviewActionsProps) {
  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | undefined>();
  const isSubmitting = pendingAction !== undefined;
  const router = useRouter();
  const { show } = useToast();

  async function review(action: 'approve' | 'reject') {
    setPendingAction(action);
    try {
      const res = await fetch(`/api/attendance-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      const body = (await res.json()) as ApiErrorBody;
      if (!res.ok || body.error) {
        show(body.error?.message ?? 'Gagal memproses pengajuan.', 'error');
        return;
      }
      show(action === 'approve' ? 'Pengajuan berhasil disetujui.' : 'Pengajuan berhasil ditolak.', 'success');
      setNote('');
      router.refresh();
    } catch {
      show('Gagal memproses pengajuan. Periksa koneksi Anda.', 'error');
    } finally {
      setPendingAction(undefined);
    }
  }

  return (
    <RequestCard
      type={type}
      dateFrom={dateFrom}
      dateTo={dateTo}
      reason={reason}
      status="PENDING"
      requesterName={requesterName}
      requestedCheckIn={requestedCheckIn}
      requestedCheckOut={requestedCheckOut}
      attachmentHref={attachmentHref}
      submittedAt={submittedAt}
      timeZone={timeZone}
      isSubmitting={isSubmitting}
      pendingAction={pendingAction}
      onApprove={() => review('approve')}
      onReject={() => review('reject')}
    >
      {/* A rule between what the employee sent and the reviewer's own note + buttons, so
          the decision area reads as a separate step instead of more request text. */}
      <div className="border-t border-border pt-3">
        <Input
          label="Catatan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isSubmitting}
          maxLength={255}
          placeholder="Mis. alasan penolakan"
        />
      </div>
    </RequestCard>
  );
}
