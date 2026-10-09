import type { CSSProperties, ReactNode } from 'react';

export interface DonutRingSegment {
  label: string;
  value: number;
  /** A CSS colour, normally a status token such as 'var(--color-status-present)'. */
  color: string;
}

export interface DonutRingProps {
  segments: readonly DonutRingSegment[];
  /** Printed in the middle (usually an <AnimatedNumber>). */
  center: ReactNode;
  centerLabel: string;
  /** Sizes the ring box, e.g. "dash-donut". */
  className?: string;
  ariaLabel: string;
}

const R = 40;
const STROKE = 10;
// A gap of 2% of the circle between arcs: the "2px surface gap between fills" rule, in ring units.
const GAP = 0.02;

/**
 * Hand-rolled SVG ring (no chart library: AGENTS.md keeps the dependency list fixed). Every arc is
 * a circle whose `pathLength` is 1, so a segment is just a dash of its share of the whole and the
 * sweep-in animation (the shared `arc-in` utility, `--circ: 1`) is a CSS keyframe on stroke-dasharray. The centre is a plain
 * HTML overlay. A Server Component.
 */
export default function DonutRing({ segments, center, centerLabel, className, ariaLabel }: DonutRingProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const live = segments.filter((s) => s.value > 0);
  const gap = live.length > 1 ? GAP : 0;
  // Each arc starts where the shares before it end (a running total, built without reassigning).
  const arcs = live.map((segment, i) => {
    const before = live.slice(0, i).reduce((sum, s) => sum + s.value, 0);
    return { segment, start: before / total, length: Math.max(0.004, segment.value / total - gap), i };
  });
  return (
    <div className={`relative shrink-0 ${className ?? ''}`} role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
        <g transform="rotate(-90 50 50)">
          <circle cx={50} cy={50} r={R} fill="none" stroke="var(--color-border)" strokeWidth={STROKE} />
          {arcs.map(({ segment, start: s, length, i }) => (
            <circle
              key={segment.label}
              cx={50}
              cy={50}
              r={R}
              fill="none"
              stroke={segment.color}
              strokeWidth={STROKE}
              pathLength={1}
              strokeDasharray={`${length} ${1 - length}`}
              strokeDashoffset={-s}
              className="arc-in"
              style={{ '--i': i, '--circ': 1 } as CSSProperties}
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl leading-none font-semibold tabular-nums text-text">{center}</span>
        <span className="mt-0.5 text-[10px] leading-none text-muted">{centerLabel}</span>
      </div>
    </div>
  );
}
