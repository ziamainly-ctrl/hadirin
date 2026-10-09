import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listRequestsForOrg } from '@/lib/queries/attendance-requests';
import { listUsers } from '@/lib/queries/users';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import RequestCard from '@/components/shared/RequestCard';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import FitPager from '@/components/shared/FitPager';
import { toCalendarDate } from '../attendance/format';
import ReviewActions from './review-actions';

export const metadata: Metadata = { title: 'Persetujuan' };

type ReviewableStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const TABS: ReadonlyArray<{ value: ReviewableStatus; label: string }> = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
];

const EMPTY_MESSAGES: Record<ReviewableStatus, string> = {
  PENDING: 'Semua pengajuan sudah ditinjau. Pengajuan baru dari karyawan akan muncul di sini.',
  APPROVED: 'Belum ada pengajuan yang disetujui.',
  REJECTED: 'Belum ada pengajuan yang ditolak.',
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

  const managerId = isOrgWide ? undefined : userId;
  const [requests, users, org, pendingOnOtherTab] = await Promise.all([
    listRequestsForOrg(orgId, { status, managerId }),
    listUsers(orgId, isOrgWide ? {} : { managerId: userId }),
    getOrganizationPlanContext(orgId),
    // The "Menunggu" tab carries its count on every tab, so a reviewer looking at history
    // still sees that work is waiting; on the pending tab the list itself is that count.
    status === 'PENDING' ? Promise.resolve(null) : listRequestsForOrg(orgId, { status: 'PENDING', managerId }),
  ]);
  const pendingCount = (pendingOnOtherTab ?? requests).length;
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const nameByUserId = new Map(users.map((u) => [u.id, u.name] as const));

  // Desktop: the title and the status tabs stay put and only the list of requests scrolls
  // (Page.Body), so the tabs are always one click away however many requests are waiting.
  return (
    <Page>
      <Page.Header title="Persetujuan" description="Tinjau pengajuan koreksi, cuti, sakit, dan izin dari tim Anda." />

      <nav className="flex shrink-0 gap-4 border-b border-border" aria-label="Filter status pengajuan">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === 'PENDING' ? '/app/requests' : `/app/requests?status=${tab.value}`}
            aria-current={status === tab.value ? 'page' : undefined}
            className={`-mb-px inline-flex h-10 items-center rounded-t-input border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              status === tab.value ? 'border-primary text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {tab.value === 'PENDING' && pendingCount > 0 ? (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-fg">
                {pendingCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <Page.Body>
        {requests.length === 0 ? (
          <EmptyState icon={Inbox} message={EMPTY_MESSAGES[status]} />
        ) : (
          // grid-cols-1 (a minmax(0, 1fr) track) is what lets a long pasted link wrap inside a phone-width
          // card: the implicit track of a bare `grid` is auto and grew to the link's width.
          // Two columns from lg up (a card still has ~360px there) and three from 2xl: one
          // full-width card per row stretched the note field and the reason line to ~1,900px
          // on a wide monitor, and on a short laptop screen it showed one request at a time. The cards
          // in a row stretch to one height (RequestCard keeps its note field and buttons at the bottom),
          // so the Tolak / Setujui buttons line up across the row.
          // Desktop: paginated to the room under the tabs (FitPager) instead of scrolling the page body.
          <FitPager
            label="Daftar pengajuan"
            noun="pengajuan"
            className="grid grid-cols-1 content-start gap-4 fit-gap lg:grid-cols-2 2xl:grid-cols-3"
          >
            {requests.map((req) => {
              const requesterName = nameByUserId.get(req.userId) ?? `#${req.userId}`;
              const dateFrom = toCalendarDate(req.dateFrom);
              const dateTo = toCalendarDate(req.dateTo);
              const attachmentHref = req.attachmentUrl ? `/api/files/attendance-requests/${req.id}/attachment` : undefined;
              return status === 'PENDING' ? (
                <ReviewActions
                  key={req.id}
                  requestId={req.id}
                  type={req.type}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  reason={req.reason}
                  requesterName={requesterName}
                  requestedCheckIn={req.requestedCheckIn}
                  requestedCheckOut={req.requestedCheckOut}
                  attachmentHref={attachmentHref}
                  submittedAt={req.createdAt}
                  timeZone={timeZone}
                />
              ) : (
                <RequestCard
                  key={req.id}
                  type={req.type}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  reason={req.reason}
                  status={req.status}
                  requesterName={requesterName}
                  reviewNote={req.reviewNote ?? undefined}
                  requestedCheckIn={req.requestedCheckIn}
                  requestedCheckOut={req.requestedCheckOut}
                  attachmentHref={attachmentHref}
                  submittedAt={req.createdAt}
                  timeZone={timeZone}
                />
              );
            })}
          </FitPager>
        )}
      </Page.Body>
    </Page>
  );
}
