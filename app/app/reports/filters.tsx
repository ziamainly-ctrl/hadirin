'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Select from '@/components/ui/Select';
import BranchFilter from '@/components/shared/BranchFilter';
import type { BranchFilterOption } from '@/components/shared/BranchFilter';

export interface ReportFiltersProps {
  /** Selected month, "YYYY-MM". */
  month: string;
  /** This month in the org's timezone, "YYYY-MM" — the newest option in the list. */
  currentMonth: string;
  branches: BranchFilterOption[];
  branchId?: string;
}

const MONTHS_BACK = 24;

// Month names in Bahasa Indonesia. timeZone: 'UTC' because the Date below is UTC midnight
// on the 1st, built only to carry year + month into the formatter.
const MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function monthLabel(value: string): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** currentMonth and the 23 months before it, newest first; an older selected month is kept. */
function monthOptions(currentMonth: string, selected: string): { value: string; label: string }[] {
  const year = Number(currentMonth.slice(0, 4));
  const month = Number(currentMonth.slice(5, 7));
  const values: string[] = [];
  for (let i = 0; i < MONTHS_BACK; i += 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    values.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  if (!values.includes(selected)) values.push(selected);
  return values.map((value) => ({ value, label: monthLabel(value) }));
}

/**
 * Month + branch pickers for app/app/reports/page.tsx (same search-params-push pattern as
 * app/app/attendance/filters.tsx). The month is a <select> of Indonesian month names
 * rather than <input type="month">: that native control renders in the *browser's*
 * language ("October 2026" on an English Chrome) and is not supported at all by Safari
 * or Firefox desktop, where it falls back to a bare text box expecting "YYYY-MM"
 * (MDN recommends a <select> fallback for exactly this).
 */
export default function ReportFilters({ month, currentMonth, branches, branchId }: ReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushParam(key: 'month' | 'branchId', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Phones: one full-width control per row. Two half-width columns clipped the longest
  // month names ("September 2026" → "September 202") on a 360px screen.
  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:flex sm:flex-wrap">
      <Select
        label="Bulan"
        value={month}
        onChange={(e) => pushParam('month', e.target.value)}
        options={monthOptions(currentMonth, month)}
        className="sm:min-w-42"
      />
      <BranchFilter
        branches={branches}
        value={branchId ?? ''}
        onChange={(value) => pushParam('branchId', value)}
        className="sm:min-w-42"
      />
    </div>
  );
}
