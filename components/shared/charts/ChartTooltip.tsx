import type { ReactNode } from 'react';

export interface ChartTooltipProps {
  /** Horizontal anchor in px, relative to the chart wrapper (the wrapper must be `relative`). */
  x: number;
  /** Width of the wrapper, so the tooltip can be kept inside it. */
  boundsWidth: number;
  /** Top of the tooltip in px. */
  top?: number;
  children: ReactNode;
}

const HALF_WIDTH = 104; // half of the max tooltip width (max-w-52 = 208px)

/**
 * The floating readout of a chart: value first (strong), then the name of the mark, then the
 * detail. Presentational and pointer-transparent, so it can never steal the hover from the mark it
 * describes. Text arrives as React children (escaped), never as HTML.
 */
export default function ChartTooltip({ x, boundsWidth, top = 0, children }: ChartTooltipProps) {
  const left = Math.min(Math.max(x, HALF_WIDTH), Math.max(HALF_WIDTH, boundsWidth - HALF_WIDTH));
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 w-max max-w-52 -translate-x-1/2 rounded-input border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md"
      style={{ left, top }}
    >
      {children}
    </div>
  );
}
