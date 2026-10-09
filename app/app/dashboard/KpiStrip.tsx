import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronRight, Minus } from 'lucide-react';
import CountUp from '@/components/shared/motion/CountUp';
import Reveal from '@/components/shared/motion/Reveal';
import Sparkline from '@/components/shared/charts/dashboard/Sparkline';
import { formatSigned } from './model';
import type { KpiDelta, KpiModel, KpiSet } from './model';

const TONE_CLASS: Record<KpiDelta['tone'], string> = {
  good: 'text-success',
  bad: 'text-destructive',
  neutral: 'text-muted',
};

const DIRECTION_WORD: Record<KpiDelta['direction'], string> = { up: 'naik', down: 'turun', flat: 'sama' };

function Delta({ kpi, refLabel }: { kpi: KpiModel; refLabel: string | null }) {
  const { delta } = kpi;
  if (!delta || !refLabel) {
    return <span className="truncate text-[11px] leading-4 text-muted">Belum ada pembanding</span>;
  }
  const Icon = delta.direction === 'up' ? ArrowUp : delta.direction === 'down' ? ArrowDown : Minus;
  const text = kpi.format === 'pct' ? `${formatSigned(delta.diff)} poin` : formatSigned(delta.diff);
  return (
    <span className="flex min-w-0 items-center gap-1 text-[11px] leading-4 text-muted" title={`Dibanding ${refLabel} pada jam yang sama`}>
      {/* Colour only on the arrow (good news / bad news); the words carry the meaning too. */}
      <Icon className={`h-3 w-3 shrink-0 ${TONE_CLASS[delta.tone]}`} aria-hidden="true" />
      <span className="sr-only">{DIRECTION_WORD[delta.direction]}</span>
      <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-text">{text}</span>
      <span className="truncate">vs {refLabel}</span>
    </span>
  );
}

/**
 * The strip of five big numbers above everything: one bordered surface, hairline dividers, each cell a
 * link to the page that lists the people behind it. A cell is: label, count-up value with a tiny
 * sparkline of the last working days, and a change against the same time on the last working day
 * (so a half-finished morning is never compared with a finished day). Neutral surfaces; the only colour
 * is on the little arrow.
 */
export default function KpiStrip({ kpis }: { kpis: KpiSet }) {
  return (
    <Reveal as="div" index={0} role="group" aria-label="Ringkasan hari ini" className="dash-kpis rounded-card border border-border bg-border">
      {kpis.items.map((kpi) => (
        <Link
          key={kpi.id}
          href={kpi.href}
          className="dash-kpi group bg-surface transition-colors hover:bg-accent focus-visible:outline-none"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted">{kpi.label}</span>
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            />
          </span>
          <span className="flex items-end justify-between gap-2">
            <span className="dash-kpi-num font-semibold tracking-tight text-text">
              {kpi.value === null ? (
                '—'
              ) : (
                <CountUp
                  value={kpi.value}
                  options={{ maximumFractionDigits: kpi.format === 'pct' ? 1 : 0 }}
                  suffix={kpi.format === 'pct' ? '%' : ''}
                />
              )}
            </span>
            <Sparkline
              className="dash-kpi-spark shrink-0"
              values={kpi.spark}
              label={`${kpi.label}, ${kpi.spark.length} hari kerja terakhir: ${kpi.spark.join(', ') || 'belum ada'}`}
            />
          </span>
          <Delta kpi={kpi} refLabel={kpis.refLabel} />
        </Link>
      ))}
    </Reveal>
  );
}
