import { CalendarDays } from 'lucide-react';
import Heatmap from '@/components/shared/charts/dashboard/Heatmap';
import { heatColor } from '@/components/shared/charts/dashboard/heat-colors';
import type { HeatLevel } from '@/components/shared/charts/dashboard/heat-colors';
import DashCard from './DashCard';
import DashEmpty from './DashEmpty';
import { heatLevel } from './model';
import type { HeatmapModel } from './model';

const LEVELS: HeatLevel[] = [1, 2, 3, 4, 5];

/** The weekday x week grid of the attendance rate: a quiet answer to "which days are weak?". */
export default function HeatCard({ heatmap, orgWide, order }: { heatmap: HeatmapModel; orgWide: boolean; order: number }) {
  const cells = heatmap.cells.map((c) => ({
    date: c.date,
    label: c.label,
    week: c.week,
    row: c.row,
    rate: c.rate,
    level: c.state === 'data' && c.rate !== null ? heatLevel(c.rate) : null,
    attended: c.attended,
    obligated: c.obligated,
    state: c.state,
  }));
  return (
    <DashCard
      id="heat"
      title="Pola mingguan"
      order={order}
      hint="5 minggu"
      href={orgWide ? '/app/statistik' : '/app/kalender'}
      hrefLabel={orgWide ? 'Statistik' : 'Kalender'}
    >
      <div className="dash-chart">
        {heatmap.hasData ? (
          <Heatmap
            weekLabels={heatmap.weeks.map((w) => w.label)}
            rowLabels={heatmap.rows.map((r) => r.label)}
            cells={cells}
            ariaLabel={`Tingkat kehadiran per hari, ${heatmap.weeks.length} minggu terakhir`}
          />
        ) : (
          <DashEmpty icon={CalendarDays}>Pola tampil setelah ada hari kerja yang selesai.</DashEmpty>
        )}
      </div>
      {heatmap.hasData ? (
        <div className="flex shrink-0 items-center justify-end gap-1.5 text-[10px] leading-none text-muted" aria-hidden="true">
          rendah
          {LEVELS.map((level) => (
            <span key={level} className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: heatColor(level) }} />
          ))}
          tinggi
        </div>
      ) : null}
    </DashCard>
  );
}
