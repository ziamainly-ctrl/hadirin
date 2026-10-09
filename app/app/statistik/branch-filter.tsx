'use client';

import { useRouter } from 'next/navigation';
import BranchFilter from '@/components/shared/BranchFilter';
import type { BranchFilterOption } from '@/components/shared/BranchFilter';
import { statistikHref } from './statistik-url';

export interface StatistikBranchFilterProps {
  days: number;
  branches: BranchFilterOption[];
  branchId?: string;
}

/** Branch picker of /app/statistik: keeps the chosen period and pushes `branchId` onto the URL. */
export default function StatistikBranchFilter({ days, branches, branchId }: StatistikBranchFilterProps) {
  const router = useRouter();
  return (
    <BranchFilter
      branches={branches}
      value={branchId ?? ''}
      onChange={(value) => router.push(statistikHref({ days, branchId: value }))}
      className="sm:min-w-42"
    />
  );
}
