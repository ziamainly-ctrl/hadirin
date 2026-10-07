'use client';

import type { ReactNode } from 'react';
import { Ban, CalendarDays, CircleCheck, CircleX, Clock, Paperclip } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { RequestStatus, RequestType } from '@/lib/constants/statuses';

export interface RequestCardProps {
  type: RequestType;
  /** Calendar date "YYYY-MM-DD". Equal to dateTo for a single-day request. Pass a string —
   * a raw DATE column from the driver is a Date at server-local midnight and must be
   * normalized by the Server Component first (see app/app/attendance/format.ts). */
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: RequestStatus;
  requesterName: string;
  reviewNote?: string;
  /** CORRECTION only: the times the employee asks to be recorded ("HH:MM[:SS]"). */
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  /** Authenticated /api/files/... link to the attachment, when there is one. */
  attachmentHref?: string;
  /** When the request was submitted (attendance_requests.created_at). */
  submittedAt?: string | Date;
  /** IANA zone used to print submittedAt — the org's own timezone. */
  timeZone?: string;
  /** Rendered only when passed — this is how the action row stays optional. */
  onApprove?: () => void;
  onReject?: () => void;
  isSubmitting?: boolean;
  /** Which action is in flight: that button spins, both are disabled. */
  pendingAction?: 'approve' | 'reject';
  className?: string;
  /** Extra content inside the card, between the details and the action row — the admin
   * inbox puts its optional review-note field here so it reads as part of this request
   * instead of floating between two cards. */
  children?: ReactNode;
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

// The chip itself is neutral (same as the type chip beside it); the status color lives only on
// the small icon, so a request list is not a wall of amber/green/red fills. The icon shape
// differs per status too, so the state never depends on color alone.
const STATUS_ICONS: Record<RequestStatus, { icon: LucideIcon; className: string }> = {
  PENDING: { icon: Clock, className: 'text-status-late' },
  APPROVED: { icon: CircleCheck, className: 'text-status-present' },
  REJECTED: { icon: CircleX, className: 'text-destructive' },
  CANCELLED: { icon: Ban, className: 'text-muted' },
};

const CHIP_CLASSES = 'border border-border bg-accent text-text';

// timeZone: 'UTC' keeps a pure calendar date (no time component) from
// shifting to the previous/next day when formatted in a viewer's local zone.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const DAY_MS = 24 * 60 * 60 * 1000;

// A correction is about one specific day, so "· 1 hari" would read as a duration it does
// not have; leave/sick/permit keep the day count.
function formatDateRange(type: RequestType, dateFrom: string, dateTo: string): string {
  const from = DATE_FORMATTER.format(new Date(dateFrom));
  const to = DATE_FORMATTER.format(new Date(dateTo));
  if (from === to) return type === 'CORRECTION' ? from : `${from} · 1 hari`;
  const days = Math.round((Date.parse(dateTo) - Date.parse(dateFrom)) / DAY_MS) + 1;
  return `${from} – ${to} · ${days} hari`;
}

// "07:55:00" → "07.55", the id-ID clock style used everywhere else in the app.
function formatClock(value: string): string {
  return value.slice(0, 5).replace(':', '.');
}

function formatSubmittedAt(value: string | Date, timeZone: string): string {
  return new Date(value).toLocaleString('id-ID', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  requestedCheckIn,
  requestedCheckOut,
  attachmentHref,
  submittedAt,
  timeZone = 'Asia/Jakarta',
  onApprove,
  onReject,
  isSubmitting = false,
  pendingAction,
  className,
  children,
}: RequestCardProps) {
  const showActions = Boolean(onApprove || onReject);
  const StatusIcon = STATUS_ICONS[status].icon;
  const requestedTimes = [
    requestedCheckIn ? `Masuk ${formatClock(requestedCheckIn)}` : null,
    requestedCheckOut ? `Keluar ${formatClock(requestedCheckOut)}` : null,
  ].filter(Boolean);

  return (
    <Card className={`flex flex-col ${className ?? ''}`}>
      {/* Not Card.Header: that one centers its items, and with a two-line name + type
          block the status badge has to sit level with the name, not float mid-block. */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="line-clamp-2 break-words text-sm font-semibold text-text">{requesterName}</span>
          <Badge className={CHIP_CLASSES}>{TYPE_LABELS[type]}</Badge>
        </div>
        <Badge className={`shrink-0 ${CHIP_CLASSES}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${STATUS_ICONS[status].className}`} aria-hidden="true" />
          {STATUS_LABELS[status]}
        </Badge>
      </div>
      {/* flex-1: in the admin grid two cards share a row, and the shorter one's note field and
          buttons must still sit level with its neighbour's (the extra height goes here). */}
      <Card.Body className="flex flex-1 flex-col gap-2 text-sm text-text">
        <p className="flex items-center gap-2 text-muted">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{formatDateRange(type, dateFrom, dateTo)}</span>
        </p>
        {requestedTimes.length > 0 ? (
          <p className="flex items-center gap-2 text-muted">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Jam yang diajukan: <span className="font-medium tabular-nums text-text">{requestedTimes.join(' · ')}</span>
            </span>
          </p>
        ) : null}
        {/* whitespace-pre-line keeps the employee's own line breaks; break-words stops a
            long pasted link from pushing the card wider than a phone screen. */}
        <p className="whitespace-pre-line break-words">{reason}</p>
        {attachmentHref ? (
          <a
            href={attachmentHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-6 w-fit items-center gap-1.5 rounded-input font-medium text-text underline-offset-4 hover:underline pointer-coarse:min-h-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
            Lihat lampiran
          </a>
        ) : null}
        {reviewNote ? (
          <p className="break-words rounded-input bg-accent px-3 py-2 text-muted">
            <span className="font-medium text-text">Catatan peninjau:</span> {reviewNote}
          </p>
        ) : null}
        {submittedAt ? (
          <p className="text-xs text-muted">Diajukan {formatSubmittedAt(submittedAt, timeZone)}</p>
        ) : null}
      </Card.Body>
      {children ? <div className="mt-3">{children}</div> : null}
      {showActions ? (
        // Phones: two equal halves of the card width, an easy thumb target each; from sm up
        // they shrink back to their label width at the right edge.
        <Card.Footer>
          {onReject ? (
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={onReject}
              disabled={isSubmitting}
              isLoading={pendingAction === 'reject'}
            >
              Tolak
            </Button>
          ) : null}
          {onApprove ? (
            <Button
              variant="primary"
              className="flex-1 sm:flex-none"
              onClick={onApprove}
              disabled={isSubmitting}
              isLoading={pendingAction === 'approve'}
            >
              Setujui
            </Button>
          ) : null}
        </Card.Footer>
      ) : null}
    </Card>
  );
}
