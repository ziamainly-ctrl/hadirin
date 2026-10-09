'use client';

import { useRouter } from 'next/navigation';
import BranchFilter from '@/components/shared/BranchFilter';
import type { BranchFilterOption } from '@/components/shared/BranchFilter';
import { calendarHref } from './calendar-url';

export interface CalendarFiltersProps {
  month: string;
  branches: BranchFilterOption[];
  branchId?: string;
}

/** Branch picker of the calendar: pushes `branchId` onto the URL (and closes any opened day). */
export default function CalendarFilters({ month, branches, branchId }: CalendarFiltersProps) {
  const router = useRouter();
  return (
    <BranchFilter
      branches={branches}
      value={branchId ?? ''}
      onChange={(value) => router.push(calendarHref({ month, branchId: value }))}
      className="sm:min-w-42"
    />
  );
}
