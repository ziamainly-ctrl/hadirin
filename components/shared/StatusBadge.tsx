import Badge from '@/components/ui/Badge';
import type { AttendanceStatus } from '@/lib/constants/statuses';

export interface StatusBadgeProps {
  status: AttendanceStatus;
  className?: string;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Hadir',
  LATE: 'Terlambat',
  ABSENT: 'Tidak Hadir',
  LEAVE: 'Cuti',
  SICK: 'Sakit',
  PERMIT: 'Izin',
  HOLIDAY: 'Libur',
  OFF: 'Libur Mingguan',
};

// Tailwind v4 generates bg-status-*/text-status-* utilities from the
// --color-status-* tokens in app/globals.css. TRD.md §14 reserves those
// colors for StatusBadge only — no other component should use them.
const STATUS_CLASSES: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-status-present/10 text-status-present',
  LATE: 'bg-status-late/10 text-status-late',
  ABSENT: 'bg-status-absent/10 text-status-absent',
  LEAVE: 'bg-status-leave/10 text-status-leave',
  SICK: 'bg-status-sick/10 text-status-sick',
  PERMIT: 'bg-status-permit/10 text-status-permit',
  HOLIDAY: 'bg-status-holiday/10 text-status-holiday',
  OFF: 'bg-status-off/10 text-status-off',
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return <Badge className={`${STATUS_CLASSES[status]} ${className ?? ''}`}>{STATUS_LABELS[status]}</Badge>;
}
