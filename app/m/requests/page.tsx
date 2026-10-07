import type { Metadata } from 'next';
import { ClipboardList, Plus } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listRequestsForOrg } from '@/lib/queries/attendance-requests';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import RequestCard from '@/components/shared/RequestCard';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import RequestActions from './request-actions';
import { toCalendarDate } from '../format';

export const metadata: Metadata = { title: 'Pengajuan Saya' };

// Server Component: reads the session directly and calls listRequestsForOrg() with this
// user's own id (TRD.md §5) — the same query the admin inbox will use, scoped to "mine"
// instead of a new query function. No onApprove/onReject props are passed to RequestCard,
// so it renders without the admin action row (components/shared/RequestCard.tsx); the
// cancel action for a pending request goes inside the card as its children instead.
export default async function RequestsPage() {
  const { orgId, userId } = await requireSession();
  const [requests, org] = await Promise.all([listRequestsForOrg(orgId, { userId }), getOrganizationPlanContext(orgId)]);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';

  const newButton = (
    <ButtonLink href="/m/requests/new" className="shrink-0">
      <Plus className="h-4 w-4" aria-hidden="true" />
      Ajukan Baru
    </ButtonLink>
  );

  return (
    <Page>
      <Page.Header
        title="Pengajuan Saya"
        description="Koreksi absensi, cuti, sakit, dan izin Anda."
        actions={requests.length > 0 ? newButton : null}
      />

      {/* The list scrolls inside the phone column on desktop; the title and tab bar stay put. */}
      <Page.Body>
        {requests.length === 0 ? (
          <Card>
            <EmptyState
              icon={ClipboardList}
              message="Belum ada pengajuan. Ajukan koreksi jika lupa absen, atau cuti, sakit, dan izin saat tidak masuk kerja."
              action={newButton}
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((req) => (
              <li key={req.id}>
                {/* DATE columns arrive as server-local Dates (see ../format.ts); RequestCard
                    formats in UTC, so hand it the plain calendar date. The requested times,
                    attachment and submit time are the same details the admin inbox shows, so
                    the employee can check what they sent (/api/files lets the owner read
                    their own attachment). */}
                <RequestCard
                  type={req.type}
                  dateFrom={toCalendarDate(req.dateFrom)}
                  dateTo={toCalendarDate(req.dateTo)}
                  reason={req.reason}
                  status={req.status}
                  requesterName="Anda"
                  reviewNote={req.reviewNote ?? undefined}
                  requestedCheckIn={req.requestedCheckIn}
                  requestedCheckOut={req.requestedCheckOut}
                  attachmentHref={req.attachmentUrl ? `/api/files/attendance-requests/${req.id}/attachment` : undefined}
                  submittedAt={req.createdAt}
                  timeZone={timeZone}
                >
                  {req.status === 'PENDING' ? <RequestActions requestId={req.id} /> : null}
                </RequestCard>
              </li>
            ))}
          </ul>
        )}
      </Page.Body>
    </Page>
  );
}
