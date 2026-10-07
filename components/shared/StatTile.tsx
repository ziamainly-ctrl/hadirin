import type { ReactNode } from 'react';

export type StatTileTrendDirection = 'up' | 'down' | 'neutral';

export interface StatTileTrend {
  value: string;
  direction?: StatTileTrendDirection;
}

export interface StatTileProps {
  label: string;
  value: string | number;
  subLabel?: string;
  trend?: StatTileTrend;
  icon?: ReactNode;
  /** PRD.md A1/US-03: "Clicking a count opens the filtered list". */
  onClick?: () => void;
  className?: string;
}

const TREND_CLASSES: Record<StatTileTrendDirection, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-destructive',
  neutral: 'text-muted',
};

// The card frame, written out here (not <Card>) so the tile can run tighter than a regular card
// on the short desktop windows the dashboard has to fit in (p-3, p-4 from xl): Card bakes in
// p-4, and a second padding class would tie with it on specificity.
const TILE_CLASSES = 'flex min-w-0 flex-col rounded-card border border-border bg-surface p-3 xl:p-4';

/**
 * Big-number stat card. When `onClick` is passed it renders as a real
 * <button> instead of a plain <div>, so the filter action stays keyboard- and
 * screen-reader-accessible. No hooks/state of its own, so it stays a Server
 * Component — same reasoning as ui/Button.
 *
 * The icon sits beside the number, not beside the label: in a three-column grid on a 1024px
 * window a tile is ~130px wide, and an icon next to the label left it no room for "Total
 * Karyawan" on one line.
 */
export default function StatTile({ label, value, subLabel, trend, icon, onClick, className }: StatTileProps) {
  const content = (
    <>
      <span className="text-sm leading-5 font-medium text-muted">{label}</span>
      {/* mt-auto: tiles in one grid row stretch to the same height, so a label that wraps
          to two lines on a phone must not push its number below its neighbours'. */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <p className="text-2xl font-bold leading-none tabular-nums text-text xl:text-3xl">{value}</p>
        {icon ? <span className="flex shrink-0 items-center text-muted">{icon}</span> : null}
      </div>
      {subLabel || trend ? (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {trend ? <span className={TREND_CLASSES[trend.direction ?? 'neutral']}>{trend.value}</span> : null}
          {subLabel ? <span className="text-muted">{subLabel}</span> : null}
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${TILE_CLASSES} text-left transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${className ?? ''}`}
      >
        {content}
      </button>
    );
  }

  return <div className={`${TILE_CLASSES} ${className ?? ''}`}>{content}</div>;
}
