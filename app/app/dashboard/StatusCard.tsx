import type { CSSProperties } from 'react';
import CountUp from '@/components/shared/motion/CountUp';
import DonutRing from '@/components/shared/charts/dashboard/DonutRing';
import DashCard from './DashCard';
import { formatNumber } from './model';
import type { BranchBar, TodayStats } from './model';

// One colour per state, shared by the ring, its legend and the branch bars, so a dot means the same
// thing everywhere on the page. "Belum hadir" is the muted gray, not the absent red: at 07:30 everybody
// is "belum", and a red ring all morning reads as an alarm.
const TONES = {
  onTime: { label: 'Tepat waktu', color: 'var(--color-status-present)' },
  late: { label: 'Terlambat', color: 'var(--color-status-late)' },
  belum: { label: 'Belum hadir', color: 'var(--color-muted)' },
  away: { label: 'Cuti / izin / libur', color: 'var(--color-status-leave)' },
} as const;

function BranchRow({ bar, max, index }: { bar: BranchBar; max: number; index: number }) {
  const hadir = bar.onTime + bar.late;
  const expected = hadir + bar.belum;
  const parts = [
    { key: 'onTime', value: bar.onTime },
    { key: 'late', value: bar.late },
    { key: 'belum', value: bar.belum },
    { key: 'away', value: bar.away },
  ] as const;
  const description = `${bar.name}: ${parts.map((p) => `${p.value} ${TONES[p.key].label.toLowerCase()}`).join(', ')}`;
  return (
    <li>
      <div className="flex h-full items-center gap-2 text-xs" title={description}>
        <span className="w-[34%] max-w-28 shrink-0 truncate text-text">{bar.name}</span>
        <span className="sr-only">{description}</span>
        <span aria-hidden="true" className="flex h-2 min-w-0 flex-1 items-center overflow-hidden rounded-full bg-border">
          <span
            className="grow-x flex h-full min-w-1 gap-[2px] overflow-hidden rounded-full"
            style={{ width: `${Math.max(6, (bar.total / max) * 100)}%`, '--i': index } as CSSProperties}
          >
            {parts.map((p) =>
              p.value > 0 ? <span key={p.key} className="h-full" style={{ flex: `${p.value} 1 0`, backgroundColor: TONES[p.key].color }} /> : null,
            )}
          </span>
        </span>
        <span className="w-10 shrink-0 text-right tabular-nums text-muted">{expected > 0 ? `${hadir}/${expected}` : '—'}</span>
      </div>
    </li>
  );
}

/**
 * Today's mix: a ring of the four states with its legend and, when the organization has more than one
 * branch, a bar per branch (width = its headcount against the biggest branch, split by state). The
 * branch list keeps only the rows that fit (.dash-fit + .dash-rows-24 in dashboard.css). The ring
 * counts the whole board, the figures beside it say how many of those are expected at work today.
 */
export default function StatusCard({
  stats,
  branches,
  holidayName,
  order,
}: {
  stats: TodayStats;
  branches: BranchBar[];
  holidayName: string | null;
  order: number;
}) {
  const segments = [
    { ...TONES.onTime, value: stats.onTime },
    { ...TONES.late, value: stats.late },
    { ...TONES.belum, value: stats.belum },
    { ...TONES.away, value: stats.away },
  ];
  const showBranches = branches.length > 1;
  const max = Math.max(1, ...branches.map((b) => b.total));
  return (
    <DashCard
      id="status"
      title="Status hari ini"
      order={order}
      href="/app/live"
      hrefLabel="Live"
      hint={stats.expected > 0 ? `${formatNumber(stats.hadir)} dari ${formatNumber(stats.expected)} hadir` : undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-4">
          <DonutRing
            className="dash-donut"
            segments={segments}
            center={<CountUp value={stats.total} />}
            centerLabel="karyawan"
            ariaLabel={`Status ${stats.total} karyawan hari ini: ${segments.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}`}
          />
          <ul className="grid min-w-0 flex-1 gap-1 text-xs">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate text-muted">{s.label}</span>
                <span className="font-medium tabular-nums text-text">{formatNumber(s.value)}</span>
              </li>
            ))}
          </ul>
        </div>
        {stats.hadir > 0 ? (
          <dl className="dash-status-extra grid shrink-0 grid-cols-2 gap-3 border-t border-border pt-2">
            <div>
              <dt className="text-[11px] text-muted">Masih di lokasi</dt>
              <dd className="text-lg leading-tight font-semibold text-text">
                <CountUp value={stats.openNow} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Sudah pulang</dt>
              <dd className="text-lg leading-tight font-semibold text-text">
                <CountUp value={stats.hadir - stats.openNow} />
              </dd>
            </div>
          </dl>
        ) : null}
        {stats.total === 0 ? (
          <p className="text-xs text-muted">{holidayName ? `Hari ini libur: ${holidayName}.` : 'Tidak ada yang terjadwal hari ini.'}</p>
        ) : null}
        {showBranches ? (
          <div className="flex min-h-0 flex-1 flex-col gap-1 border-t border-border pt-2">
            <p className="shrink-0 text-[11px] font-medium text-muted">Per cabang</p>
            <div className="dash-fit">
              <ul className="dash-rows dash-rows-24">
                {branches.map((bar, i) => (
                  <BranchRow key={bar.id} bar={bar} max={max} index={i} />
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </DashCard>
  );
}
