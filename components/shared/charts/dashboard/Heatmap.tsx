'use client';

import { Fragment, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import ChartTooltip from '../ChartTooltip';
import { heatColor, heatTextColor } from './heat-colors';
import type { HeatLevel } from './heat-colors';

export interface HeatmapCellData {
  date: string;
  /** "7 Okt" */
  label: string;
  week: number;
  row: number;
  /** Percent 0..100, null when there is nothing to show. */
  rate: number | null;
  /** 1..5 (darker = more people showed up), set when `state` is 'data'. */
  level: HeatLevel | null;
  attended: number;
  obligated: number;
  state: 'data' | 'empty' | 'today' | 'future';
}

export interface HeatmapProps {
  /** Column headers, oldest week first ("29 Sep"). */
  weekLabels: readonly string[];
  /** Row headers, Monday first ("Sen"). */
  rowLabels: readonly string[];
  cells: readonly HeatmapCellData[];
  ariaLabel: string;
}

const NUMBER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/**
 * Attendance rate per weekday (rows) and week (columns): a quiet grid in the primary token at five
 * strengths, so a hollow cell is a weak day and a column that fades is a weak week. A CSS grid, not
 * an SVG: the cells fill whatever box the card gives them. The percentage is printed inside a cell
 * only while the cells are tall enough (a container query in dashboard.css hides it otherwise); the
 * tooltip and the sr-only table always have it.
 */
export default function Heatmap({ weekLabels, rowLabels, cells, ariaLabel }: HeatmapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ cell: HeatmapCellData; x: number; top: number; bounds: number } | null>(null);
  const columns = `1.75rem repeat(${weekLabels.length}, minmax(0, 1fr))`;

  function show(cell: HeatmapCellData, el: HTMLElement) {
    const wrap = wrapRef.current;
    if (!wrap || cell.state === 'future') return;
    const a = wrap.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setTip({ cell, x: b.left - a.left + b.width / 2, top: Math.max(0, b.top - a.top - 56), bounds: a.width });
  }

  return (
    <div ref={wrapRef} className="relative flex h-full min-h-0 w-full flex-col gap-1" role="group" aria-label={ariaLabel}>
      <div className="grid shrink-0 gap-[3px] text-[10px] leading-none text-muted" style={{ gridTemplateColumns: columns }}>
        <span />
        {weekLabels.map((label, i) => (
          <span key={i} className="truncate text-center">
            {label}
          </span>
        ))}
      </div>
      <div
        className="dash-heat-grid grid flex-1 gap-[3px]"
        style={{ gridTemplateColumns: columns, gridTemplateRows: `repeat(${rowLabels.length}, minmax(0, 1fr))` }}
      >
        {rowLabels.map((rowLabel, r) => (
          <Fragment key={rowLabel}>
            <span className="flex items-center text-[10px] leading-none text-muted">{rowLabel}</span>
            {weekLabels.map((_, w) => {
              const cell = cells.find((c) => c.row === r && c.week === w);
              if (!cell) return <span key={w} />;
              const filled = cell.state === 'data' && cell.level !== null;
              const style: CSSProperties = {
                '--i': w * rowLabels.length + r,
                ...(filled ? { backgroundColor: heatColor(cell.level!), color: heatTextColor(cell.level!) } : {}),
              } as CSSProperties;
              return (
                <div
                  key={w}
                  className={`dash-cell flex min-h-0 items-center justify-center rounded-[5px] border text-[10px] font-medium tabular-nums transition-[box-shadow] ${
                    filled
                      ? 'border-transparent'
                      : cell.state === 'today'
                        ? 'border-field border-dashed'
                        : cell.state === 'future'
                          ? 'border-transparent'
                          : 'border-transparent bg-border/40'
                  } ${tip?.cell.date === cell.date ? 'ring-2 ring-ring' : ''}`}
                  style={style}
                  onPointerEnter={(e) => show(cell, e.currentTarget)}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setTip(null);
                  }}
                  onPointerDown={(e) => show(cell, e.currentTarget)}
                >
                  {filled ? <span className="dash-heat-val">{Math.round(cell.rate ?? 0)}</span> : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      {tip ? (
        <ChartTooltip x={tip.x} boundsWidth={tip.bounds} top={tip.top}>
          <p className="text-sm font-semibold tabular-nums text-text">
            {tip.cell.state === 'data' ? `${NUMBER.format(tip.cell.rate ?? 0)}%` : tip.cell.state === 'today' ? 'Hari ini' : 'Tidak ada data'}
          </p>
          <p className="text-muted">{tip.cell.label}</p>
          {tip.cell.state === 'data' ? (
            <p className="text-muted">
              {tip.cell.attended} dari {tip.cell.obligated} hadir
            </p>
          ) : tip.cell.state === 'today' ? (
            <p className="text-muted">Belum final</p>
          ) : (
            <p className="text-muted">Libur atau tanpa jadwal</p>
          )}
        </ChartTooltip>
      ) : null}

      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Hari</th>
              {weekLabels.map((label, i) => (
                <th key={i} scope="col">
                  Minggu {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rowLabel, r) => (
              <tr key={rowLabel}>
                <th scope="row">{rowLabel}</th>
                {weekLabels.map((_, w) => {
                  const cell = cells.find((c) => c.row === r && c.week === w);
                  return (
                    <td key={w}>
                      {cell?.state === 'data'
                        ? `${NUMBER.format(cell.rate ?? 0)}%, ${cell.attended} dari ${cell.obligated} hadir`
                        : cell?.state === 'today'
                          ? 'hari ini, belum final'
                          : cell?.state === 'future'
                            ? ''
                            : 'tidak ada data'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
