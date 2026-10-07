import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listRequestsForOrg } from '@/lib/queries/attendance-requests';
import { listUsers } from '@/lib/queries/users';
import RequestCard from '@/components/shared/RequestCard';
import EmptyState from '@/components/shared/EmptyState';
import ReviewActions from './review-actions';

type ReviewableStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const TABS: ReadonlyArray<{ value: ReviewableStatus; label: string }> = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
];

const EMPTY_MESSAGES: Record<ReviewableStatus, string> = {
  PENDING: 'Tidak ada pengajuan yang menunggu persetujuan',
  APPROVED: 'Belum ada pengajuan yang disetujui',
  REJECTED: 'Belum ada pengajuan yang ditolak',
};

function parseStatus(value: string | string[] | undefined): ReviewableStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'APPROVED' || raw === 'REJECTED' ? raw : 'PENDING';
}

interface RequestsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Admin/manager approval inbox (PRD.md A2, TRD.md §8). Server Component: calls
 * lib/queries/attendance-requests + lib/queries/users directly (TRD.md §5), no
 * self-fetch over /api/*. Mirrors the exact role scoping that
 * GET /api/attendance-requests uses (app/api/attendance-requests/route.ts) —
 * OWNER/ADMIN see the whole org, MANAGER sees only their direct reports via a
 * server-side managerId filter. Approve/reject is wired through
 * ./review-actions.tsx (client) so this page needs no "use client" of its own.
 */
export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const { userId, orgId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const status = parseStatus((await searchParams).status);
  const isOrgWide = role === 'OWNER' || role === 'ADMIN';

  const [requests, users] = await Promise.all([
    listRequestsForOrg(orgId, { status, managerId: isOrgWide ? undefined : userId }),
    listUsers(orgId, isOrgWide ? {} : { managerId: userId }),
  ]);
  const nameByUserId = new Map(users.map((u) => [u.id, u.name] as const));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text">Persetujuan</h1>
        <p className="text-sm text-muted">Tinjau pengajuan koreksi, cuti, sakit, dan izin dari tim Anda.</p>
      </div>

      <nav className="flex gap-4 border-b border-black/10" aria-label="Filter status pengajuan">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === 'PENDING' ? '/app/requests' : `/app/requests?status=${tab.value}`}
            aria-current={status === tab.value ? 'page' : undefined}
            className={`-mb-px border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
              status === tab.value ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <EmptyState icon={Inbox} message={EMPTY_MESSAGES[status]} />
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req) => {
            const requesterName = nameByUserId.get(req.userId) ?? `#${req.userId}`;
            return status === 'PENDING' ? (
              <ReviewActions
                key={req.id}
                requestId={req.id}
                type={req.type}
                dateFrom={req.dateFrom}
                dateTo={req.dateTo}
                reason={req.reason}
                requesterName={requesterName}
              />
            ) : (
              <RequestCard
                key={req.id}
                type={req.type}
                dateFrom={req.dateFrom}
                dateTo={req.dateTo}
                reason={req.reason}
                status={req.status}
                requesterName={requesterName}
                reviewNote={req.reviewNote ?? undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
