'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import BranchFilter from '@/components/shared/BranchFilter';
import type { BranchFilterOption } from '@/components/shared/BranchFilter';

export interface AttendanceFiltersProps {
  branches: BranchFilterOption[];
}

/**
 * Client wrapper around the shared DateRangeFilter + BranchFilter for
 * app/app/attendance/page.tsx. Holds no data itself — it reads the current
 * dateFrom/dateTo/branchId straight from useSearchParams() and pushes any
 * change back onto the URL (same createQueryString pattern as Next's own
 * useSearchParams docs), which makes the Server Component page above re-run
 * with the new filters. Changing a filter resets `page` back to 1; it never
 * touches `status`, which is deep-link-only (e.g. a dashboard stat tile
 * linking to ?status=LATE) and has no control here.
 */
export default function AttendanceFilters({ branches }: AttendanceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const branchId = searchParams.get('branchId') ?? '';

  function pushFilter(key: 'dateFrom' | 'dateTo' | 'branchId', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <DateRangeFilter
        from={dateFrom}
        to={dateTo}
        onFromChange={(value) => pushFilter('dateFrom', value)}
        onToChange={(value) => pushFilter('dateTo', value)}
      />
      <BranchFilter branches={branches} value={branchId} onChange={(value) => pushFilter('branchId', value)} />
    </div>
  );
}
