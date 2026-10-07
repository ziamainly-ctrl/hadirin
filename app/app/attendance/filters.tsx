'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import BranchFilter from '@/components/shared/BranchFilter';
// The badge's own labels, so a filter option and the badge in the filtered rows read the same.
import { STATUS_LABELS } from '@/components/shared/StatusBadge';
import type { BranchFilterOption } from '@/components/shared/BranchFilter';
import { ATTENDANCE_STATUSES } from '@/lib/constants/statuses';

export interface AttendanceFiltersProps {
  branches: BranchFilterOption[];
}

const FILTER_KEYS = ['dateFrom', 'dateTo', 'branchId', 'status'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

/**
 * Client wrapper around the shared DateRangeFilter + BranchFilter (plus a status select)
 * for app/app/attendance/page.tsx. Holds no data itself — it reads the current filters
 * straight from useSearchParams() and pushes any change back onto the URL (same
 * createQueryString pattern as Next's own useSearchParams docs), which makes the Server
 * Component page above re-run with the new filters. Changing a filter resets `page` back
 * to 1. `status` has a visible control so a deep link such as ?status=LATE never filters
 * the table invisibly, and "Hapus Filter" clears every filter in one step.
 */
export default function AttendanceFilters({ branches }: AttendanceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const branchId = searchParams.get('branchId') ?? '';
  const status = searchParams.get('status') ?? '';
  const hasFilter = FILTER_KEYS.some((key) => searchParams.get(key));

  function pushFilter(key: FilterKey, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    router.push(pathname);
  }

  // Phones: the two dates side by side (a date always fits half the width), then branch and
  // status full width each — at half width a longer branch name or "Libur Mingguan" was cut
  // off inside the select. From sm up the controls sit in one wrapping row.
  return (
    <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
      <DateRangeFilter
        className="col-span-2"
        from={dateFrom}
        to={dateTo}
        onFromChange={(value) => pushFilter('dateFrom', value)}
        onToChange={(value) => pushFilter('dateTo', value)}
      />
      <div className="col-span-2">
        <BranchFilter
          branches={branches}
          value={branchId}
          onChange={(value) => pushFilter('branchId', value)}
          className="w-full sm:min-w-42"
        />
      </div>
      <div className="col-span-2">
        <Select
          label="Status"
          value={status}
          onChange={(e) => pushFilter('status', e.target.value)}
          className="w-full sm:min-w-42"
        >
          <option value="">Semua Status</option>
          {ATTENDANCE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
      {hasFilter ? (
        <Button variant="outline" onClick={resetFilters} className="col-span-2 justify-self-start">
          <X className="h-4 w-4" aria-hidden="true" />
          Hapus Filter
        </Button>
      ) : null}
    </div>
  );
}
