'use client';

import { useMemo, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import ChartTooltip from './ChartTooltip';
import { useElementSize } from './useElementSize';

export interface TrendPoint {
  id: string;
  /** Short x-axis / tooltip label, e.g. "7 Okt". */
  label: string;
  value: number;
  /** Second tooltip line, e.g. "12 dari 14 karyawan". */
  detail?: string;
  /** The period is not over yet: drawn as a hollow dot with a dashed last segment. */
  partial?: boolean;
}

export interface TrendChartProps {
  points: TrendPoint[];
  /** What the line measures, e.g. "Tingkat kehadiran". */
  seriesLabel: string;
  /** How values read in the axis, tooltip and table: "92,3%" (percent) or "92,3" (number). */
  valueFormat?: 'percent' | 'number';
  /** Accessible name of the whole chart. */
  ariaLabel: string;
  /** Sets the wrapper's size, e.g. "h-48 lg:h-full lg:min-h-40". */
  className?: string;
}

const MARGIN = { top: 12, right: 14, bottom: 26, left: 40 };
const POINT_RADIUS = 4; // 8px marker (marks-and-anatomy: markers >= 8px)
const MAX_MARKERS = 40;
const NUMBER_FORMAT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

function yTicks(yMin: number, plotH: number): number[] {
  const all: number[] = [];
  for (let v = yMin; v <= 100; v += 20) all.push(v);
  if (all[all.length - 1] !== 100) all.push(100);
  return plotH < 150 && all.length > 3 ? all.filter((_, i) => i % 2 === 0 || all[i] === 100) : all;
}

function labelIndexes(count: number, plotW: number): number[] {
  if (count === 0) return [];
  const maxLabels = Math.max(2, Math.floor(plotW / 64));
  const step = Math.max(1, Math.ceil(count / maxLabels));
  const out: number[] = [];
  for (let i = 0; i < count; i += step) out.push(i);
  const last = count - 1;
  if (out[out.length - 1] !== last) {
    // Drop the previous label when it would sit too close to the last one.
    if (last - out[out.length - 1]! < step * 0.6) out.pop();
    out.push(last);
  }
  return out;
}

/**
 * Hand-rolled SVG line chart for a percentage over time (no chart library: AGENTS.md keeps the
 * dependency list fixed). One series, so no legend; 2px line, 8px markers with a surface ring, a
 * 10% area wash, hairline grid. Hover or arrow keys move a crosshair and a readout; the same data
 * is reachable as a table for screen readers. The y axis starts at the nearest multiple of 20 below
 * the lowest value, so a 90 to 100% month is not a flat line at the top of a 0 to 100 axis; the
 * axis labels always show where it starts.
 */
export default function TrendChart({ points, seriesLabel, valueFormat = 'percent', ariaLabel, className }: TrendChartProps) {
  const formatValue = (value: number) => (valueFormat === 'percent' ? `${NUMBER_FORMAT.format(value)}%` : NUMBER_FORMAT.format(value));
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const n = points.length;

  const geometry = useMemo(() => {
    if (n === 0 || plotW <= 0 || plotH <= 0) return null;
    const min = Math.min(...points.map((p) => p.value));
    const yMin = Math.min(80, Math.max(0, Math.floor((min - 5) / 20) * 20));
    const xAt = (i: number) => (n === 1 ? MARGIN.left + plotW / 2 : MARGIN.left + (i / (n - 1)) * plotW);
    const yAt = (v: number) => MARGIN.top + plotH - ((Math.min(Math.max(v, yMin), 100) - yMin) / (100 - yMin)) * plotH;
    const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }));
    return { yMin, xAt, yAt, coords };
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

  // The solid line runs through every point except a partial last one, which gets a dashed segment.
  const lastIsPartial = n > 1 && points[last]?.partial === true;
  const solidCoords = geometry ? (lastIsPartial ? geometry.coords.slice(0, -1) : geometry.coords) : [];
  const linePath = solidCoords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath =
    geometry && solidCoords.length > 1
      ? `${linePath} L${solidCoords[solidCoords.length - 1]!.x.toFixed(1)},${(MARGIN.top + plotH).toFixed(1)} L${solidCoords[0]!.x.toFixed(1)},${(MARGIN.top + plotH).toFixed(1)} Z`
      : '';

  return (
    <div
      ref={wrapRef}
      className={`relative w-full select-none ${className ?? ''}`}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((prev) => prev ?? (n > 0 ? n - 1 : null))}
      onBlur={() => setActive(null)}
    >
      {geometry ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
          {yTicks(geometry.yMin, plotH).map((tick) => {
            const y = geometry.yAt(tick);
            return (
              <g key={tick}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} />
                <text x={MARGIN.left - 8} y={y} textAnchor="end" dominantBaseline="central" className="fill-muted text-[11px] tabular-nums">
                  {formatValue(tick)}
                </text>
              </g>
            );
          })}
          {labelIndexes(n, plotW).map((i) => (
            <text
              key={points[i]!.id}
              x={geometry.coords[i]!.x}
              y={MARGIN.top + plotH + 17}
              textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
              className="fill-muted text-[11px]"
            >
              {points[i]!.label}
            </text>
          ))}

          {areaPath ? <path d={areaPath} fill="var(--color-primary)" fillOpacity={0.08} /> : null}
          {solidCoords.length > 1 ? (
            <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {lastIsPartial ? (
            <line
              x1={geometry.coords[last - 1]!.x}
              y1={geometry.coords[last - 1]!.y}
              x2={geometry.coords[last]!.x}
              y2={geometry.coords[last]!.y}
              stroke="var(--color-primary)"
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          ) : null}

          {activeCoord ? (
            <line x1={activeCoord.x} x2={activeCoord.x} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--color-field)" strokeWidth={1} />
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
                r={isActive ? POINT_RADIUS + 1 : POINT_RADIUS}
                fill={p.partial ? 'var(--color-surface)' : 'var(--color-primary)'}
                stroke={p.partial ? 'var(--color-primary)' : 'var(--color-surface)'}
                strokeWidth={2}
              />
            );
          })}

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
        <ChartTooltip x={activeCoord.x} boundsWidth={width} top={Math.max(0, activeCoord.y - 62)}>
          <p className="text-sm font-semibold tabular-nums text-text">{formatValue(activePoint.value)}</p>
          <p className="text-muted">
            {seriesLabel} · {activePoint.label}
          </p>
          {activePoint.detail ? <p className="text-muted">{activePoint.detail}</p> : null}
          {activePoint.partial ? <p className="text-muted">Hari berjalan, belum final</p> : null}
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
                <th scope="row">{p.label}</th>
                <td>{formatValue(p.value)}</td>
                <td>{[p.detail, p.partial ? 'Hari berjalan, belum final' : null].filter(Boolean).join('. ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
