import Link from 'next/link';
import BarList from '@/components/shared/BarList';
import type { BranchPresence } from '@/lib/queries/live';

export interface BranchPresenceListProps {
  branches: BranchPresence[];
  /** OWNER/ADMIN get a link to add the first branch when there is none. */
  canManageBranches: boolean;
}

// Per-branch headcount for the right-hand card of /app/live: a bar per branch (people on site now)
// and the day's totals under it. Server Component, re-rendered on every refresh.
export default function BranchPresenceList({ branches, canManageBranches }: BranchPresenceListProps) {
  if (branches.length === 0) {
    return (
      <p className="text-sm text-muted">
        Belum ada cabang aktif.{' '}
        {canManageBranches ? (
          <Link
            href="/app/branches"
            className="rounded-sm font-medium text-text underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Tambah cabang
          </Link>
        ) : (
          'Minta admin menambahkan cabang.'
        )}
      </p>
    );
  }

  const totalOnSite = branches.reduce((sum, b) => sum + b.onSite, 0);
  const totalOut = branches.reduce((sum, b) => sum + b.checkedOut, 0);
  const totalLate = branches.reduce((sum, b) => sum + b.late, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <BarList
        items={branches.map((b) => ({ id: b.branchId, label: b.name, value: b.onSite }))}
        formatValue={(value) => `${value} orang`}
        fit={{ label: 'Jumlah orang di tiap cabang', noun: 'cabang' }}
      />
      <dl className="grid shrink-0 grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <div>
          <dt className="text-xs text-muted">Di lokasi</dt>
          <dd className="text-base font-semibold tabular-nums text-text">{totalOnSite}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Pulang</dt>
          <dd className="text-base font-semibold tabular-nums text-text">{totalOut}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Terlambat</dt>
          <dd className="text-base font-semibold tabular-nums text-text">{totalLate}</dd>
        </div>
      </dl>
    </div>
  );
}
