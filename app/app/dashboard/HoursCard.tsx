import { ChartColumn } from 'lucide-react';
import HourChart from '@/components/shared/charts/dashboard/HourChart';
import DashCard from './DashCard';
import DashEmpty from './DashEmpty';
import type { HourSeries } from './model';

function Legend({ hasUsual }: { hasUsual: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2 w-2 rounded-[2px] bg-primary" />
        Hari ini
      </span>
      {hasUsual ? (
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0 w-3 border-t-[1.5px] border-muted" />
          Biasanya
        </span>
      ) : null}
    </div>
  );
}

/** Check-ins per hour: today's bars against the usual working day (the last two weeks). */
export default function HoursCard({ hours, order }: { hours: HourSeries; order: number }) {
  const hasUsual = hours.usualDays > 0;
  return (
    <DashCard
      id="hours"
      title="Jam check-in"
      order={order}
      action={hours.bars.length > 0 ? <Legend hasUsual={hasUsual} /> : undefined}
    >
      <div className="dash-chart">
        {hours.bars.length > 0 ? (
          <HourChart
            bars={hours.bars}
            hasUsual={hasUsual}
            ariaLabel={`Jumlah check-in per jam hari ini${hasUsual ? `, dibanding rata-rata ${hours.usualDays} hari kerja terakhir` : ''}`}
          />
        ) : (
          <DashEmpty icon={ChartColumn}>Belum ada check-in hari ini. Grafik jam muncul setelah check-in pertama.</DashEmpty>
        )}
      </div>
    </DashCard>
  );
}
