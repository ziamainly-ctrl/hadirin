import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listRequestsForOrg } from '@/lib/queries/attendance-requests';
import Button from '@/components/ui/Button';
import RequestCard from '@/components/shared/RequestCard';
import EmptyState from '@/components/shared/EmptyState';
import RequestActions from './request-actions';

// Server Component: reads the session directly and calls listRequestsForOrg() with this
// user's own id (TRD.md §5) — the same query the admin inbox will use, scoped to "mine"
// instead of a new query function. No onApprove/onReject props are passed to RequestCard,
// so it renders without the admin action row (components/shared/RequestCard.tsx).
export default async function RequestsPage() {
  const { orgId, userId } = await requireSession();
  const requests = await listRequestsForOrg(orgId, { userId });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-text">Pengajuan Saya</h1>
        <Link href="/m/requests/new">
          <Button size="sm">Ajukan Baru</Button>
        </Link>
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={ClipboardList} message="Belum ada pengajuan." />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((req) => (
            <li key={req.id} className="flex flex-col gap-1.5">
              <RequestCard
                type={req.type}
                dateFrom={req.dateFrom}
                dateTo={req.dateTo}
                reason={req.reason}
                status={req.status}
                requesterName="Anda"
                reviewNote={req.reviewNote ?? undefined}
              />
              {req.status === 'PENDING' ? (
                <div className="flex justify-end">
                  <RequestActions requestId={req.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
