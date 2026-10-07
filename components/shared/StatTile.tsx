import type { ReactNode } from 'react';
import Card from '@/components/ui/Card';

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
  down: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted',
};

/**
 * Big-number stat card. When `onClick` is passed it renders as a real
 * <button> instead of a plain Card, so the filter action stays keyboard- and
 * screen-reader-accessible. No hooks/state of its own, so it stays a Server
 * Component — same reasoning as ui/Button.
 */
export default function StatTile({ label, value, subLabel, trend, icon, onClick, className }: StatTileProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted">{label}</span>
        {icon ? <span className="text-primary">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
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
        className={`rounded-card bg-surface p-4 text-left transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className ?? ''}`}
      >
        {content}
      </button>
    );
  }

  return <Card className={className}>{content}</Card>;
}
