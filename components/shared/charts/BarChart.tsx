'use client';

import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { niceMax } from '@/lib/insights/statistics';
import ChartTooltip from './ChartTooltip';
import { useElementSize } from './useElementSize';

export interface BarChartBar {
  id: string;
  /** x-axis label, e.g. "08.00" or "Sen". */
  label: string;
  value: number;
  /** Tooltip heading, e.g. "08.00 - 08.59". Falls back to `label`. */
  title?: string;
  /** Second tooltip line. */
  detail?: string;
  /** The bar the story is about (the peak): full strength, value printed on its cap. */
  highlight?: boolean;
}

export interface BarChartProps {
  bars: BarChartBar[];
  /** What a bar counts, e.g. "check-in". */
  unitLabel: string;
  /** 'integer' rounds ("12"), 'decimal' keeps one decimal in id-ID ("12,5"). */
  valueFormat?: 'integer' | 'decimal';
  ariaLabel: string;
  className?: string;
}

const MARGIN = { top: 18, right: 8, bottom: 24, left: 34 };
const MAX_BAR = 24; // marks-and-anatomy: bars are never thicker than 24px
const RADIUS = 4; // rounded data end, square baseline
const INTEGER_FORMAT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const DECIMAL_FORMAT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

function roundedTopBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Hand-rolled SVG column chart (no chart library). Columns are at most 24px wide with a rounded
 * top and a square base, hairline grid, one highlighted column labelled on its cap. Hovering a
 * column, or arrowing through them with the keyboard, shows its tooltip; the same values exist as a
 * table for screen readers.
 */
export default function BarChart({ bars, unitLabel, valueFormat = 'integer', ariaLabel, className }: BarChartProps) {
  const formatValue = (value: number) => (valueFormat === 'decimal' ? DECIMAL_FORMAT.format(value) : INTEGER_FORMAT.format(value));
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const n = bars.length;

  const geometry = useMemo(() => {
    if (n === 0 || plotW <= 0 || plotH <= 0) return null;
    const yMax = niceMax(Math.max(...bars.map((b) => b.value)));
    const slot = plotW / n;
    const barW = Math.max(2, Math.min(MAX_BAR, slot * 0.7));
    const ticks = plotH >= 110 ? [0, yMax / 2, yMax] : [0, yMax];
    const items = bars.map((b, i) => {
      const h = (b.value / yMax) * plotH;
      const x = MARGIN.left + slot * i + (slot - barW) / 2;
      return { x, y: MARGIN.top + plotH - h, w: barW, h, cx: MARGIN.left + slot * (i + 0.5) };
    });
    return { yMax, slot, ticks, items };
  }, [bars, n, plotW, plotH]);

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
  // Label every bar when the slots are wide enough for the text, else every second or third.
  const labelEvery = geometry ? Math.max(1, Math.ceil(36 / geometry.slot)) : 1;

  return (
    <div
      ref={wrapRef}
      className={`relative w-full select-none ${className ?? ''}`}
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
            const y = MARGIN.top + plotH - (tick / geometry.yMax) * plotH;
            return (
              <g key={tick}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} />
                <text x={MARGIN.left - 8} y={y} textAnchor="end" dominantBaseline="central" className="fill-muted text-[11px] tabular-nums">
                  {formatValue(tick)}
                </text>
              </g>
            );
          })}

          {bars.map((b, i) => {
            const item = geometry.items[i]!;
            const isActive = i === active;
            return (
              <g key={b.id}>
                {b.value > 0 ? (
                  <path
                    d={roundedTopBar(item.x, item.y, item.w, Math.max(item.h, 1))}
                    fill="var(--color-primary)"
                    fillOpacity={b.highlight || isActive ? 1 : 0.45}
                  />
                ) : (
                  <rect x={item.x} y={MARGIN.top + plotH - 1} width={item.w} height={1} fill="var(--color-border)" />
                )}
                {b.highlight && b.value > 0 ? (
                  <text x={item.cx} y={item.y - 5} textAnchor="middle" className="fill-text text-[11px] font-semibold tabular-nums">
                    {formatValue(b.value)}
                  </text>
                ) : null}
                {i % labelEvery === 0 ? (
                  <text x={item.cx} y={MARGIN.top + plotH + 16} textAnchor="middle" className="fill-muted text-[11px]">
                    {b.label}
                  </text>
                ) : null}
                {/* The slot is the hit target, much bigger than the (at most 24px) column itself. */}
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
        </svg>
      ) : null}

      {activeBar && activeItem ? (
        <ChartTooltip x={activeItem.cx} boundsWidth={width} top={Math.max(0, activeItem.y - 56)}>
          <p className="text-sm font-semibold tabular-nums text-text">{formatValue(activeBar.value)}</p>
          <p className="text-muted">
            {unitLabel} · {activeBar.title ?? activeBar.label}
          </p>
          {activeBar.detail ? <p className="text-muted">{activeBar.detail}</p> : null}
        </ChartTooltip>
      ) : null}

      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Kategori</th>
              <th scope="col">{unitLabel}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.id}>
                <th scope="row">{b.title ?? b.label}</th>
                <td>{formatValue(b.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
