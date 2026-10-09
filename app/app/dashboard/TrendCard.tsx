'use client';

import { useState } from 'react';
import { ChartLine } from 'lucide-react';
import AreaTrend from '@/components/shared/charts/dashboard/AreaTrend';
import DashCard from './DashCard';
import DashEmpty from './DashEmpty';
import { averageRate, formatPercent } from './model';
import type { TrendPointModel } from './model';

const RANGES = [7, 30] as const;
type Range = (typeof RANGES)[number];

/**
 * The hero: attendance rate per working day, with a 7 / 30 day switch. The server hands over
 * the last 30 days once; switching only filters them, so it is instant and never refetches. Working
 * days that are over only (today's figure lives in the KPI strip), and the average of what is shown
 * sits in the heading so the line has a number to be read against.
 */
export default function TrendCard({ points, order }: { points: TrendPointModel[]; order: number }) {
  const [range, setRange] = useState<Range>(30);
  const visible = points.filter((p) => p.daysAgo <= range);
  const average = averageRate(visible);
  const enough = visible.length >= 2;

  return (
    <DashCard
      id="trend"
      title="Tren kehadiran"
      order={order}
      hint={visible.length > 0 ? `rata-rata ${formatPercent(average)} · ${visible.length} hari kerja` : undefined}
      action={
        <div role="group" aria-label="Rentang tren" className="flex shrink-0 gap-0.5 rounded-input border border-border bg-surface p-0.5">
          {RANGES.map((r) => {
            const active = r === range;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(r)}
                className={`inline-flex h-6 items-center rounded-[8px] px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-9 pointer-coarse:px-3 ${
                  active ? 'bg-secondary text-secondary-fg shadow-xs' : 'text-muted hover:bg-accent hover:text-text'
                }`}
              >
                {r} hari
              </button>
            );
          })}
        </div>
      }
    >
      <div className="dash-chart">
        {enough ? (
          <AreaTrend
            points={visible.map((p) => ({
              id: p.id,
              label: p.label,
              weekday: p.weekday,
              value: p.value,
              detail: `${p.attended} dari ${p.obligated} karyawan hadir`,
            }))}
            seriesLabel="Kehadiran"
            ariaLabel={`Tingkat kehadiran per hari kerja, ${range} hari terakhir`}
            average={average}
            animationKey={String(range)}
          />
        ) : (
          <DashEmpty icon={ChartLine}>Tren tampil setelah ada minimal dua hari kerja yang selesai. Hari ini masuk ke angka di atas.</DashEmpty>
        )}
      </div>
    </DashCard>
  );
}
