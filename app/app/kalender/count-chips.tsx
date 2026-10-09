import { StatusDot } from '@/components/shared/StatusBadge';
import type { DayCounts } from '@/lib/insights/statistics';

export interface CountChipsProps {
  counts: DayCounts | undefined;
  /** Show the leave/sick/permit count too (cells wide enough, the agenda). */
  showAway?: boolean;
  className?: string;
}

/** Hadir / Terlambat / Tidak hadir (and optionally away) of one day: a dot and a number each. */
export default function CountChips({ counts, showAway = false, className }: CountChipsProps) {
  if (!counts) return null;
  // The fourth chip (leave/sick/permit) only fits a wide cell: below 8.5rem it is hidden (the day
  // dialog and the screen-reader label still carry it). Written as two full display classes, not
  // `inline-flex` plus `hidden`, because two display utilities on one element tie on specificity.
  const chips: Array<{ status: 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'; n: number; label: string; display: string }> = [
    { status: 'PRESENT', n: counts.present, label: 'hadir', display: 'inline-flex' },
    { status: 'LATE', n: counts.late, label: 'terlambat', display: 'inline-flex' },
    { status: 'ABSENT', n: counts.absent, label: 'tidak hadir', display: 'inline-flex' },
    {
      status: 'LEAVE',
      n: counts.away,
      label: 'cuti, sakit, atau izin',
      display: showAway ? 'inline-flex' : 'hidden @min-[8.5rem]:inline-flex',
    },
  ];
  const visible = chips.filter((c) => c.n > 0);
  if (visible.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className ?? ''}`}>
      {visible.map((c) => (
        <span key={c.status} className={`${c.display} items-center gap-1 text-xs tabular-nums text-text`}>
          <StatusDot status={c.status} className="h-1.5 w-1.5" />
          <span aria-hidden="true">{c.n}</span>
          <span className="sr-only">
            {c.n} {c.label}
          </span>
        </span>
      ))}
    </span>
  );
}
