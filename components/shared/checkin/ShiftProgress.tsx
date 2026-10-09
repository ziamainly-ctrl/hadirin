'use client';

import { useSyncExternalStore } from 'react';
import { formatClock, formatDuration } from '@/app/m/format';
import './checkin.css';

const TICK_MS = 30_000;

// A clock for display only (AGENTS.md rule 4: recorded times always come from the server). Snapshots
// are rounded to the tick, so React sees a stable value between ticks; the server snapshot is 0,
// which renders nothing, so the first paint matches the server HTML exactly.
function subscribe(onChange: () => void): () => void {
  const id = window.setInterval(onChange, TICK_MS);
  return () => window.clearInterval(id);
}
const snapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/**
 * Check-out variant of the record: how long the person has been working, a bar for how far through
 * the shift they are, and what is left until the scheduled end. A person who is about to leave
 * early sees it before the confirmation, not only inside it.
 */
export default function ShiftProgress({
  checkInAt,
  scheduledOutAt,
  timeZone,
}: {
  checkInAt: string | null;
  scheduledOutAt: string | null;
  timeZone: string;
}) {
  const now = useSyncExternalStore(subscribe, snapshot, () => 0);
  if (!now || !checkInAt || !scheduledOutAt) return null;

  const start = new Date(checkInAt).getTime();
  const end = new Date(scheduledOutAt).getTime();
  if (!(end > start)) return null;

  const worked = Math.max(0, Math.floor((now - start) / 60_000));
  const left = Math.max(0, Math.ceil((end - now) / 60_000));
  const pct = Math.max(2, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));

  return (
    <div className="flex flex-col gap-1.5" aria-label="Kemajuan jam kerja">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">Sudah bekerja</span>
        <span className="font-semibold tabular-nums text-text">{formatDuration(worked)}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Kemajuan menuju jam pulang"
        className="h-1.5 overflow-hidden rounded-full border border-border bg-accent"
      >
        <div className="ci-grow h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted">
        {left > 0 ? `Pulang ${formatClock(scheduledOutAt, timeZone)} · ${formatDuration(left)} lagi` : `Sudah lewat jam pulang ${formatClock(scheduledOutAt, timeZone)}`}
      </p>
    </div>
  );
}
