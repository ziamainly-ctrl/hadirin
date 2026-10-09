import type { CSSProperties } from 'react';

export interface SparklineProps {
  /** Oldest first. Fewer than two values draws a dotted baseline ("not enough days yet"). */
  values: readonly number[];
  /** Sizes the drawing (it keeps the 64 x 24 aspect ratio). */
  className?: string;
  /** Spoken description, e.g. "Hadir, 7 hari kerja terakhir: 5, 6, 6, 4, 6, 6, 5". */
  label: string;
}

const W = 64;
const H = 24;
const PAD = 3;

/**
 * A tiny line with its last point marked: shape only, no axes (Tufte). The scale is the series'
 * own min to max, so it shows whether the figure is steady or moving, not its size. Draws itself
 * in (the shared `draw-in` utility). A Server Component: nothing in it needs the client.
 */
export default function Sparkline({ values, className, label }: SparklineProps) {
  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Belum cukup hari kerja untuk grafik mini">
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--color-field)" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const x = (i: number) => PAD + (i / (values.length - 1)) * (W - PAD * 2);
  const y = (v: number) => (span === 0 ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2));
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={label}>
      <path
        d={path}
        pathLength={1}
        className="draw-in"
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(last)}
        cy={y(values[last]!)}
        r={2.25}
        fill="var(--color-primary)"
        stroke="var(--color-surface)"
        strokeWidth={1}
        className="dash-pop"
        style={{ '--i': 28 } as CSSProperties}
      />
    </svg>
  );
}
