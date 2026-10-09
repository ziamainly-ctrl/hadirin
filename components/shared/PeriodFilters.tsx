'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import BranchFilter from '@/components/shared/BranchFilter';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import type { BranchFilterOption } from '@/components/shared/BranchFilter';
import { useUrlFilters } from '@/components/shared/useUrlFilters';
import { PRESET_LABELS, QUICK_PRESETS, presetRange } from '@/lib/date-range';
import type { Preset, QuickPreset } from '@/lib/date-range';

export interface PeriodFiltersProps {
  /** The org's calendar date today, "YYYY-MM-DD": what the quick presets count back from. */
  today: string;
  /** The range the server actually used (defaults and clamping applied), so the inputs never lie. */
  from: string;
  to: string;
  preset: Preset;
  branches: BranchFilterOption[];
  presets?: readonly QuickPreset[];
  /** Page-specific controls (a select for the kind of record), placed after the branch filter. */
  children?: ReactNode;
  /** URL keys of those extra controls, so "Hapus Filter" clears them too. */
  extraKeys?: readonly string[];
}

const BASE_KEYS = ['dateFrom', 'dateTo', 'branchId'] as const;

/**
 * Period + branch filter bar for the review pages: quick presets (Hari ini ... Bulan lalu), the
 * shared DateRangeFilter and BranchFilter, then the page's own controls. The URL parameter names
 * (`dateFrom`, `dateTo`, `branchId`) are the same ones /app/attendance uses, so a deep link from one
 * page to another carries the filter. Holds no data: it reads the URL and writes it back through
 * useUrlFilters, which makes the Server Component page re-run.
 *
 * Phones: the presets are one swipeable row and the date / branch / page-specific controls sit behind
 * a "Filter" toggle (stacked, they were ~400px of a 740px screen before any data showed). From sm up
 * everything is one wrapping row, chips aligned with the field bottoms.
 */
export default function PeriodFilters({
  today,
  from,
  to,
  preset,
  branches,
  presets = QUICK_PRESETS,
  children,
  extraKeys = [],
}: PeriodFiltersProps) {
  const url = useUrlFilters();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const resetKeys = [...BASE_KEYS, ...extraKeys];
  const hasFilter = url.has(resetKeys);
  // The date pair counts once, so the badge reads as "how many things are narrowed".
  const activeCount =
    (url.get('dateFrom') || url.get('dateTo') ? 1 : 0) +
    (url.get('branchId') ? 1 : 0) +
    extraKeys.filter((key) => url.get(key)).length;

  return (
    <div
      className={`flex shrink-0 flex-col gap-3 transition-opacity sm:flex-row sm:flex-wrap sm:items-end ${url.pending ? 'opacity-60' : ''}`}
      aria-busy={url.pending || undefined}
    >
      {/* py-1/-my-1 and -mx-4/px-4: the swipe row bleeds to the screen edge and keeps room for the 3px focus ring. */}
      <div
        role="group"
        aria-label="Periode cepat"
        className="-mx-4 -my-1 flex items-center gap-2 overflow-x-auto px-4 py-1 sm:m-0 sm:h-10 sm:flex-wrap sm:overflow-visible sm:p-0"
      >
        {presets.map((key) => {
          const range = presetRange(key, today);
          const active = preset === key;
          return (
            <Button
              key={key}
              size="sm"
              variant={active ? 'secondary' : 'outline'}
              aria-pressed={active}
              onClick={() => url.setMany({ dateFrom: range.from, dateTo: range.to })}
              className="shrink-0"
            >
              {PRESET_LABELS[key]}
            </Button>
          );
        })}
        {hasFilter ? (
          <Button variant="ghost" size="sm" onClick={() => url.reset(resetKeys)} className="hidden shrink-0 sm:inline-flex">
            <X className="h-4 w-4" aria-hidden="true" />
            Hapus Filter
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 sm:hidden">
        <Button
          variant="outline"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex-1 justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filter
            {activeCount > 0 ? (
              <span className="rounded-full bg-accent px-1.5 text-xs tabular-nums">{activeCount}</span>
            ) : null}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </Button>
        {hasFilter ? (
          <Button variant="ghost" onClick={() => url.reset(resetKeys)}>
            <X className="h-4 w-4" aria-hidden="true" />
            Hapus
          </Button>
        ) : null}
      </div>

      {/* sm:contents lifts the controls into the parent's wrapping row; below sm the panel is the
          toggle's content (hidden until opened). */}
      <div id={panelId} className={`${open ? 'flex flex-col gap-3' : 'hidden'} sm:contents`}>
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={(value) => url.set('dateFrom', value)}
          onToChange={(value) => url.set('dateTo', value)}
        />
        <BranchFilter
          branches={branches}
          value={url.get('branchId')}
          onChange={(value) => url.set('branchId', value)}
          className="w-full sm:min-w-42"
        />
        {children}
      </div>
    </div>
  );
}
