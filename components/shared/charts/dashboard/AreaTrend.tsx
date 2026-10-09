'use client';

import { useId, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import ChartTooltip from '../ChartTooltip';
import { useElementSize } from '../useElementSize';

export interface AreaTrendPoint {
  id: string;
  /** Axis and tooltip date, e.g. "7 Okt". */
  label: string;
  /** Short weekday for the tooltip, e.g. "Rab". */
  weekday: string;
  /** Percent 0..100. */
  value: number;
  /** Second tooltip line, e.g. "22 dari 24 karyawan hadir". */
  detail: string;
}

export interface AreaTrendProps {
  points: readonly AreaTrendPoint[];
  /** What the line measures, e.g. "Kehadiran". */
  seriesLabel: string;
  ariaLabel: string;
  /** A dashed reference line (the period average), percent. */
  average?: number | null;
  /** Changing it replays the draw-in (the 7 / 14 / 30 day switch). */
  animationKey?: string;
}

const MARGIN = { top: 10, right: 12, bottom: 22, left: 38 };
const MAX_MARKERS = 16;
const NUMBER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

function percent(value: number): string {
  return `${NUMBER.format(value)}%`;
}

function yTicks(lo: number, plotH: number): number[] {
  const range = 100 - lo;
  const target = plotH >= 170 ? 4 : plotH >= 100 ? 3 : 2;
  const rough = range / (target - 1);
  const step = [5, 10, 20, 25, 50].find((s) => s >= rough) ?? 50;
  const ticks = [lo];
  for (let v = Math.ceil((lo + 1) / step) * step; v < 100; v += step) ticks.push(v);
  ticks.push(100);
  return ticks;
}

function labelIndexes(count: number, plotW: number): number[] {
  if (count === 0) return [];
  const maxLabels = Math.max(2, Math.floor(plotW / 62));
  const step = Math.max(1, Math.ceil(count / maxLabels));
  const out: number[] = [];
  for (let i = 0; i < count; i += step) out.push(i);
  const last = count - 1;
  if (out[out.length - 1] !== last) {
    if (last - out[out.length - 1]! < step * 0.6) out.pop();
    out.push(last);
  }
  return out;
}

/**
 * Hand-rolled SVG area/line chart of the attendance rate per working day (no chart library). One
 * series, so no legend: the card names it. 2px line that draws itself in, a soft fade under it
 * (the primary token at low strength, so it stays grayscale), hairline grid, 8px markers with a
 * surface ring, a dashed average line. Hover or arrow keys move a crosshair and a readout; the same
 * numbers are a table for screen readers. The y axis starts at the multiple of 10 under the lowest
 * value (never the 0 to 100 default that flattens a 90 to 100% month) and its labels say where.
 */
export default function AreaTrend({ points, seriesLabel, ariaLabel, average = null, animationKey = 'a' }: AreaTrendProps) {
  const gradientId = `dash-area-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const n = points.length;
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const geometry = useMemo(() => {
    if (n === 0 || plotW <= 0 || plotH <= 0) return null;
    const min = Math.min(...points.map((p) => p.value));
    const lo = Math.max(0, Math.min(90, Math.floor((min - 4) / 10) * 10));
    const xAt = (i: number) => (n === 1 ? MARGIN.left + plotW / 2 : MARGIN.left + (i / (n - 1)) * plotW);
    const yAt = (v: number) => MARGIN.top + plotH - ((Math.min(Math.max(v, lo), 100) - lo) / (100 - lo)) * plotH;
    const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }));
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const baseY = MARGIN.top + plotH;
    const area =
      coords.length > 1 ? `${line} L${coords[coords.length - 1]!.x.toFixed(1)},${baseY} L${coords[0]!.x.toFixed(1)},${baseY} Z` : '';
    return { lo, yAt, coords, line, area, baseY, ticks: yTicks(lo, plotH) };
  }, [points, n, plotW, plotH]);

  function indexFromPointer(event: PointerEvent<SVGRectElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (n === 0) return;
    const current = active ?? n - 1;
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

  const activePoint = active !== null ? points[active] : undefined;
  const activeCoord = active !== null ? geometry?.coords[active] : undefined;
  const last = n - 1;
  const showAllMarkers = n <= MAX_MARKERS;

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 w-full select-none"
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((prev) => prev ?? (n > 0 ? n - 1 : null))}
      onBlur={() => setActive(null)}
    >
      {geometry ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {geometry.ticks.map((tick) => {
            const y = geometry.yAt(tick);
            return (
              <g key={tick}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} />
                <text x={MARGIN.left - 8} y={y} textAnchor="end" dominantBaseline="central" className="fill-muted text-[11px] tabular-nums">
                  {tick}%
                </text>
              </g>
            );
          })}
          {labelIndexes(n, plotW).map((i) => (
            <text
              key={points[i]!.id}
              x={geometry.coords[i]!.x}
              y={MARGIN.top + plotH + 16}
              textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
              className="fill-muted text-[11px]"
            >
              {points[i]!.label}
            </text>
          ))}

          {average !== null && plotH >= 80 ? (
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + plotW}
              y1={geometry.yAt(average)}
              y2={geometry.yAt(average)}
              stroke="var(--color-field)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ) : null}

          <g key={animationKey}>
            {geometry.area ? <path d={geometry.area} fill={`url(#${gradientId})`} className="wipe-in" /> : null}
            {n > 1 ? (
              <path
                d={geometry.line}
                pathLength={1}
                className="draw-in"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {points.map((p, i) => {
              const c = geometry.coords[i]!;
              const isActive = i === active;
              if (!showAllMarkers && !isActive && i !== last) return null;
              return (
                <circle
                  key={p.id}
                  cx={c.x}
                  cy={c.y}
                  r={isActive ? 5 : 4}
                  fill="var(--color-primary)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                  className="dash-pop"
                  style={{ '--i': i } as CSSProperties}
                />
              );
            })}
          </g>

          {activeCoord ? (
            <line x1={activeCoord.x} x2={activeCoord.x} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--color-field)" strokeWidth={1} />
          ) : null}

          {/* One transparent hit layer for the whole plot: the pointer only has to be near an x. */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={(e) => setActive(indexFromPointer(e))}
            onPointerDown={(e) => setActive(indexFromPointer(e))}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setActive(null);
            }}
          />
        </svg>
      ) : null}

      {activePoint && activeCoord ? (
        <ChartTooltip x={activeCoord.x} boundsWidth={width} top={Math.max(0, activeCoord.y - 66)}>
          <p className="text-sm font-semibold tabular-nums text-text">{percent(activePoint.value)}</p>
          <p className="text-muted">
            {seriesLabel} · {activePoint.weekday}, {activePoint.label}
          </p>
          <p className="text-muted">{activePoint.detail}</p>
        </ChartTooltip>
      ) : null}

      {/* The same numbers as a table, for screen readers; the tooltip only enhances. */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Tanggal</th>
              <th scope="col">{seriesLabel}</th>
              <th scope="col">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <th scope="row">
                  {p.weekday}, {p.label}
                </th>
                <td>{percent(p.value)}</td>
                <td>{p.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
