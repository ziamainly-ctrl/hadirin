export interface DonutSegment {
  label: string;
  value: number;
  /** A CSS color, e.g. 'var(--color-status-present)' — resolved through the normal CSS
   * cascade, so a token-based value stays dark-mode-correct with no dark: variant needed. */
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  className?: string;
}

/**
 * Hand-rolled SVG donut chart (no charting dependency — AGENTS.md §"Dependencies" keeps
 * this to the fixed list). Stacks each segment as its own ring arc via stroke-dasharray,
 * rotated -90deg so the first segment starts at 12 o'clock, matching the category's
 * common "big number in the middle of a ring + legend" dashboard pattern.
 */
export default function DonutChart({ segments, centerValue, centerLabel, size = 160, className }: DonutChartProps) {
  const strokeWidth = 14;
  const radius = size / 2 - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  // Each arc's offset is the running sum of every prior arc's length — threaded through
  // a single reduce (not a `let` mutated across renders) so this stays a pure render.
  const arcPlacements = segments
    .filter((s) => s.value > 0)
    .reduce<{ segment: DonutSegment; length: number; offset: number }[]>((acc, segment) => {
      const length = total > 0 ? (segment.value / total) * circumference : 0;
      const previous = acc[acc.length - 1];
      const offset = previous ? previous.offset + previous.length : 0;
      return [...acc, { segment, length, offset }];
    }, []);

  return (
    <div className={`flex flex-col items-center gap-5 sm:flex-row ${className ?? ''}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-black/5 dark:stroke-white/5"
          />
          {arcPlacements.map(({ segment, length, offset }) => (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-text">{centerValue}</span>
          <span className="text-xs text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="flex-1 text-muted">{segment.label}</span>
            <span className="font-semibold tabular-nums text-text">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
