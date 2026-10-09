'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { niceMax } from '@/lib/insights/statistics';
import ChartTooltip from '../ChartTooltip';
import { useElementSize } from '../useElementSize';

export interface HourChartBar {
  hour: number;
  /** Check-ins in that hour today. */
  today: number;
  /** Average check-ins in that hour on a usual working day. */
  usual: number;
}

export interface HourChartProps {
  bars: readonly HourChartBar[];
  /** Whether the "usual" line has a baseline to draw (at least one past working day). */
  hasUsual: boolean;
  ariaLabel: string;
}

const MARGIN = { top: 8, right: 6, bottom: 20, left: 26 };
const MAX_BAR = 26;
const RADIUS = 4;
const INTEGER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

function roundedTopBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

const hh = (hour: number) => String(hour).padStart(2, '0');

/**
 * Check-ins per hour: today's bars (the primary token, rounded tops) against the usual working day
 * (a dashed line with hollow dots, averaged over the last two weeks of working days). Hover a slot
 * or arrow through them for the readout; the numbers are also a table for screen readers. Hand-rolled
 * SVG, sized by ResizeObserver so the labels stay 11px at any window.
 */
export default function HourChart({ bars, hasUsual, ariaLabel }: HourChartProps) {
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = bars.length;
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const geometry = useMemo(() => {
    if (n === 0 || plotW <= 0 || plotH <= 0) return null;
    const peak = Math.max(...bars.map((b) => Math.max(b.today, hasUsual ? b.usual : 0)));
    const yMax = niceMax(peak);
    const slot = plotW / n;
    const barW = Math.max(3, Math.min(MAX_BAR, slot * 0.58));
    const yAt = (v: number) => MARGIN.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
    const items = bars.map((b, i) => {
      const cx = MARGIN.left + slot * (i + 0.5);
      const top = yAt(b.today);
      return { cx, x: cx - barW / 2, y: top, h: MARGIN.top + plotH - top, w: barW, uy: yAt(b.usual) };
    });
    const usualPath = hasUsual ? items.map((it, i) => `${i === 0 ? 'M' : 'L'}${it.cx.toFixed(1)},${it.uy.toFixed(1)}`).join(' ') : '';
    const ticks = plotH >= 120 ? [0, yMax / 2, yMax] : [0, yMax];
    return { yMax, slot, items, usualPath, ticks, yAt };
  }, [bars, n, plotW, plotH, hasUsual]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (n === 0) return;
    const current = active ?? 0;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (event.key === 'ArrowRight') next = Math.min(n - 1, current + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = n - 1;
    else if (event.key === 'Escape') {
      setActive(null);
      return;
    }
    if (next !== null) {
      event.preventDefault();
      setActive(next);
    }
  }

  const activeBar = active !== null ? bars[active] : undefined;
  const activeItem = active !== null ? geometry?.items[active] : undefined;
  const labelEvery = geometry ? Math.max(1, Math.ceil(24 / geometry.slot)) : 1;

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 w-full select-none"
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((prev) => prev ?? 0)}
      onBlur={() => setActive(null)}
    >
      {geometry ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
          {geometry.ticks.map((tick) => {
            const y = geometry.yAt(tick);
            return (
              <g key={tick}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} />
                <text x={MARGIN.left - 6} y={y} textAnchor="end" dominantBaseline="central" className="fill-muted text-[11px] tabular-nums">
                  {INTEGER.format(tick)}
                </text>
              </g>
            );
          })}

          {bars.map((b, i) => {
            const it = geometry.items[i]!;
            const isActive = i === active;
            return (
              <g key={b.hour}>
                {b.today > 0 ? (
                  <path
                    d={roundedTopBar(it.x, it.y, it.w, Math.max(it.h, 1))}
                    fill="var(--color-primary)"
                    fillOpacity={isActive ? 1 : 0.82}
                    className="dash-grow"
                    style={{ '--i': i } as CSSProperties}
                  />
                ) : (
                  <rect x={it.x} y={MARGIN.top + plotH - 1} width={it.w} height={1} fill="var(--color-border)" />
                )}
                {i % labelEvery === 0 ? (
                  <text x={it.cx} y={MARGIN.top + plotH + 14} textAnchor="middle" className="fill-muted text-[11px] tabular-nums">
                    {hh(b.hour)}
                  </text>
                ) : null}
                <rect
                  x={MARGIN.left + geometry.slot * i}
                  y={MARGIN.top}
                  width={geometry.slot}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setActive(null);
                  }}
                />
              </g>
            );
          })}

          {hasUsual ? (
            <g pointerEvents="none">
              <path
                d={geometry.usualPath}
                pathLength={1}
                className="draw-in"
                style={{ '--i': 4 } as CSSProperties}
                fill="none"
                stroke="var(--color-muted)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {geometry.items.map((it, i) => (
                <circle
                  key={bars[i]!.hour}
                  cx={it.cx}
                  cy={it.uy}
                  r={2.75}
                  fill="var(--color-surface)"
                  stroke="var(--color-muted)"
                  strokeWidth={1.5}
                  className="dash-pop"
                  style={{ '--i': i + 6 } as CSSProperties}
                />
              ))}
            </g>
          ) : null}
        </svg>
      ) : null}

      {activeBar && activeItem ? (
        <ChartTooltip x={activeItem.cx} boundsWidth={width} top={Math.max(0, Math.min(activeItem.y, activeItem.uy) - 62)}>
          <p className="text-sm font-semibold tabular-nums text-text">{hh(activeBar.hour)}.00 – {hh(activeBar.hour)}.59</p>
          <p className="text-muted">
            Hari ini <span className="font-medium tabular-nums text-text">{INTEGER.format(activeBar.today)}</span> check-in
          </p>
          {hasUsual ? (
            <p className="text-muted">
              Biasanya <span className="font-medium tabular-nums text-text">{DECIMAL.format(activeBar.usual)}</span>
            </p>
          ) : null}
        </ChartTooltip>
      ) : null}

      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Jam</th>
              <th scope="col">Check-in hari ini</th>
              {hasUsual ? <th scope="col">Biasanya per hari</th> : null}
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.hour}>
                <th scope="row">{hh(b.hour)}.00</th>
                <td>{INTEGER.format(b.today)}</td>
                {hasUsual ? <td>{DECIMAL.format(b.usual)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
