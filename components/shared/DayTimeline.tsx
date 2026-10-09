import { Camera, MapPinOff } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatClock, formatDuration } from '@/app/m/format';
import { formatDistance } from '@/lib/geo';
import type { TodayLogView } from '@/lib/today-view-model';

export interface DayTimelineProps {
  log: TodayLogView | null;
  timezone: string;
  /** "07.00–15.00", shown while nothing is recorded yet. */
  scheduleLabel: string;
  className?: string;
}

/** A selfie thumbnail that opens the full photo in a new tab, through the authenticated file route.
 * The camera icon under the image stays visible when the file cannot be loaded (alt="" renders nothing). */
function SelfieThumb({ logId, which, label }: { logId: number; which: 'check-in' | 'check-out'; label: string }) {
  return (
    <a
      href={`/api/files/attendance-logs/${logId}/${which}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Buka ${label}`}
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-input border border-border bg-accent text-muted hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Camera className="h-4 w-4" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated same-origin file route, not an optimisable static asset */}
      <img
        src={`/api/files/attendance-logs/${logId}/${which}`}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </a>
  );
}

function PunchCell({
  label,
  at,
  branch,
  distanceM,
  isOutside,
  logId,
  which,
  hasPhoto,
  timezone,
}: {
  label: string;
  at: string | null;
  branch: string | null;
  distanceM: number | null;
  isOutside: boolean;
  logId: number | null;
  which: 'check-in' | 'check-out';
  hasPhoto: boolean;
  timezone: string;
}) {
  const hasThumb = logId !== null && hasPhoto;
  // A definition list may only hold dt/dd (optionally wrapped in ONE div per group), so the
  // selfie thumbnail is a dd of the group too, placed in the first column by the grid instead of
  // wrapping the label and the value in an extra div (axe: definition-list / dlitem).
  const textColumn = hasThumb ? 'col-start-2' : '';
  return (
    <div className={`grid min-w-0 gap-x-2 ${hasThumb ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1'}`}>
      <dt className={`text-xs text-muted ${textColumn}`}>{label}</dt>
      <dd className={`font-semibold tabular-nums text-text ${textColumn}`}>{formatClock(at, timezone)}</dd>
      {at && (branch || distanceM !== null) ? (
        <dd className={`min-w-0 truncate text-xs text-muted ${textColumn}`}>
          {branch ?? 'Cabang'}
          {distanceM !== null ? ` · ${formatDistance(distanceM)}` : ''}
        </dd>
      ) : null}
      {isOutside ? (
        <dd className={`mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 ${textColumn}`}>
          <MapPinOff className="h-3 w-3 shrink-0" aria-hidden="true" />
          Di luar area
        </dd>
      ) : null}
      {hasThumb ? (
        <dd className="col-start-1 row-span-4 row-start-1 self-start">
          <SelfieThumb logId={logId} which={which} label={`foto selfie ${label.toLowerCase()}`} />
        </dd>
      ) : null}
    </div>
  );
}

/**
 * Today's record as a compact definition list: when in, when out, how long, and what the status
 * is. Rendered by the check-in screen next to the action; its numbers all come from the server's
 * clock (the row), never from the browser's.
 */
export default function DayTimeline({ log, timezone, scheduleLabel, className }: DayTimelineProps) {
  const open = Boolean(log?.checkInAt && !log.checkOutAt);
  return (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 text-sm ${className ?? ''}`}>
      <PunchCell
        label="Masuk"
        at={log?.checkInAt ?? null}
        branch={log?.checkInBranchName ?? null}
        distanceM={log?.checkInDistanceM ?? null}
        isOutside={Boolean(log?.checkInIsOutside)}
        logId={log?.id ?? null}
        which="check-in"
        hasPhoto={Boolean(log?.hasCheckInPhoto)}
        timezone={timezone}
      />
      <PunchCell
        label="Keluar"
        at={log?.checkOutAt ?? null}
        branch={log?.checkOutBranchName ?? null}
        distanceM={log?.checkOutDistanceM ?? null}
        isOutside={Boolean(log?.checkOutIsOutside)}
        logId={log?.id ?? null}
        which="check-out"
        hasPhoto={Boolean(log?.hasCheckOutPhoto)}
        timezone={timezone}
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted">Durasi kerja</dt>
        <dd className="font-semibold text-text">
          {log?.workMinutes != null ? formatDuration(log.workMinutes) : open ? 'Sedang bekerja' : '—'}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-muted">Status</dt>
        <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {log ? <StatusBadge status={log.status} /> : <span className="text-muted">Belum absen</span>}
          {log && log.lateMinutes > 0 ? <span className="text-xs text-muted">{formatDuration(log.lateMinutes)}</span> : null}
        </dd>
      </div>
      {log && log.earlyLeaveMinutes > 0 ? (
        <div className="min-w-0">
          <dt className="text-xs text-muted">Pulang lebih awal</dt>
          <dd className="font-semibold text-text">{formatDuration(log.earlyLeaveMinutes)}</dd>
        </div>
      ) : null}
      <div className="min-w-0">
        <dt className="text-xs text-muted">Jadwal</dt>
        <dd className="font-semibold tabular-nums text-text">{scheduleLabel}</dd>
      </div>
      {log?.note ? (
        <div className="col-span-2 min-w-0">
          <dt className="text-xs text-muted">Catatan</dt>
          <dd className="text-text">{log.note}</dd>
        </div>
      ) : null}
    </dl>
  );
}
