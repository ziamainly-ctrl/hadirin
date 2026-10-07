'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { RequestStatus, RequestType } from '@/lib/constants/statuses';

export interface RequestCardProps {
  type: RequestType;
  /** ISO date (YYYY-MM-DD). Equal to dateTo for a single-day request. */
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: RequestStatus;
  requesterName: string;
  reviewNote?: string;
  /** Rendered only when passed — this is how the action row stays optional. */
  onApprove?: () => void;
  onReject?: () => void;
  isSubmitting?: boolean;
  className?: string;
}

const TYPE_LABELS: Record<RequestType, string> = {
  CORRECTION: 'Koreksi Absensi',
  LEAVE: 'Cuti',
  SICK: 'Sakit',
  PERMIT: 'Izin',
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

const STATUS_BADGE_CLASSES: Record<RequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  CANCELLED: 'bg-black/5 text-muted dark:bg-white/5',
};

// timeZone: 'UTC' keeps a pure calendar date (no time component) from
// shifting to the previous/next day when formatted in a viewer's local zone.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDateRange(dateFrom: string, dateTo: string) {
  const from = DATE_FORMATTER.format(new Date(dateFrom));
  if (dateFrom === dateTo) return from;
  return `${from} – ${DATE_FORMATTER.format(new Date(dateTo))}`;
}

/**
 * Renders one attendance_requests row from explicit typed props only — it
 * never imports query functions. 'use client' because the optional
 * approve/reject buttons are click handlers.
 */
export default function RequestCard({
  type,
  dateFrom,
  dateTo,
  reason,
  status,
  requesterName,
  reviewNote,
  onApprove,
  onReject,
  isSubmitting = false,
  className,
}: RequestCardProps) {
  const showActions = Boolean(onApprove || onReject);

  return (
    <Card className={className}>
      <Card.Header>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-text">{requesterName}</span>
          <Badge className="bg-primary/10 text-primary">{TYPE_LABELS[type]}</Badge>
        </div>
        <Badge className={STATUS_BADGE_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
      </Card.Header>
      <Card.Body className="flex flex-col gap-1 text-sm text-text">
        <p className="text-muted">{formatDateRange(dateFrom, dateTo)}</p>
        <p>{reason}</p>
        {reviewNote ? <p className="italic text-muted">Catatan: {reviewNote}</p> : null}
      </Card.Body>
      {showActions ? (
        <Card.Footer>
          {onReject ? (
            <Button variant="ghost" size="sm" onClick={onReject} isLoading={isSubmitting}>
              Tolak
            </Button>
          ) : null}
          {onApprove ? (
            <Button variant="primary" size="sm" onClick={onApprove} isLoading={isSubmitting}>
              Setujui
            </Button>
          ) : null}
        </Card.Footer>
      ) : null}
    </Card>
  );
}
