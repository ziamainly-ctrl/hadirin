import Badge from '@/components/ui/Badge';
import type { AttendanceStatus } from '@/lib/constants/statuses';

export interface StatusBadgeProps {
  status: AttendanceStatus;
  className?: string;
}

/** Exported so a status shown without the pill (the /m history week strip's tooltips and
 * screen-reader labels) uses the same words instead of a second copy of this map. */
export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Hadir',
  LATE: 'Terlambat',
  ABSENT: 'Tidak Hadir',
  LEAVE: 'Cuti',
  SICK: 'Sakit',
  PERMIT: 'Izin',
  HOLIDAY: 'Libur',
  OFF: 'Libur Mingguan',
};

// Tailwind v4 generates bg-status-* utilities from the --color-status-* tokens in
// app/globals.css. TRD.md §14 reserves those colors for attendance status displays
// (this badge and the history week strip's StatusDot) — no other component should use them.
// The color is a small dot only: the chip itself is a neutral surface, so no status ever
// paints a tinted background (product rule: backgrounds are neutral grays, semantic color
// only as a small dot/icon/text accent).
const STATUS_DOT_CLASSES: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-status-present',
  LATE: 'bg-status-late',
  ABSENT: 'bg-status-absent',
  LEAVE: 'bg-status-leave',
  SICK: 'bg-status-sick',
  PERMIT: 'bg-status-permit',
  HOLIDAY: 'bg-status-holiday',
  OFF: 'bg-status-off',
};

export interface StatusDotProps {
  status: AttendanceStatus;
  className?: string;
}

/** The status color as a plain dot (decorative: the status word always sits next to it, or
 * in the surrounding aria-label). Default 8px; pass h-/w- classes to resize. */
export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${STATUS_DOT_CLASSES[status]} ${className ?? 'h-2 w-2'}`}
    />
  );
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge className={`gap-1.5 border border-border bg-accent py-0.5 text-text ${className ?? ''}`}>
      <StatusDot status={status} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
