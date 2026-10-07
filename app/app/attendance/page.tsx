import type { Metadata } from 'next';
import { Camera, ListChecks, TriangleAlert } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listAttendanceForOrg } from '@/lib/queries/attendance';
import { listUsers, getUserByIdInOrg } from '@/lib/queries/users';
import { listBranches } from '@/lib/queries/branches';
import { dateStringSchema, idParam } from '@/lib/validators/common';
import { ATTENDANCE_STATUSES } from '@/lib/constants/statuses';
import type { AttendanceStatus } from '@/lib/constants/statuses';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import AttendanceFilters from './filters';

export const metadata: Metadata = { title: 'Absensi' };

const PAGE_SIZE = 25;

interface AttendancePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateParam(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const result = dateStringSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function parseIdParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const result = idParam.safeParse(value);
  return result.success ? result.data : undefined;
}

function parseStatusParam(value: string | undefined): AttendanceStatus | undefined {
  return value && (ATTENDANCE_STATUSES as readonly string[]).includes(value) ? (value as AttendanceStatus) : undefined;
}

// Pure calendar date (no time component) — timeZone: 'UTC' keeps it from shifting to the
// previous/next day under a viewer's local offset, same convention as
// components/shared/RequestCard.tsx and app/app/settings/billing/page.tsx.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

// HH:MM in the org's display timezone — same convention as lib/export/xlsx.ts's
// formatTimeJakarta (no date library in TRD.md §3's fixed dependency list).
function formatTime(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
}

/**
 * Admin attendance table (PRD.md, TRD.md §6 `GET /api/attendance`). Server Component:
 * calls lib/queries/attendance + lib/queries/users + lib/queries/branches directly
 * (TRD.md §5), never a self-fetch over /api/*. Role scoping mirrors
 * app/api/attendance/route.ts's GET handler verbatim — this page has no userId search
 * param of its own, so the API's `query.userId` branch is always undefined here:
 * ADMIN+ see everything, MANAGER is scoped to their team via managerId, EMPLOYEE sees
 * only their own. Filtering (date range, branch) is wired through ./filters.tsx
 * (client) so this page needs no "use client" of its own.
 */
export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const { userId, orgId, role } = await requireSession();
  const params = await searchParams;

  const dateFrom = parseDateParam(firstValue(params.dateFrom));
  const dateTo = parseDateParam(firstValue(params.dateTo));
  const branchId = parseIdParam(firstValue(params.branchId));
  const status = parseStatusParam(firstValue(params.status));
  const page = Math.max(1, Number(firstValue(params.page)) || 1);

  const isOrgWide = role === 'OWNER' || role === 'ADMIN';

  // Name lookup is scoped the same way as the attendance rows themselves (same
  // pattern as app/app/requests/page.tsx) rather than fetching the whole org roster.
  const namesPromise: Promise<Map<number, string>> = isOrgWide
    ? listUsers(orgId, {}).then((users) => new Map(users.map((u) => [u.id, u.name] as const)))
    : role === 'MANAGER'
      ? listUsers(orgId, { managerId: userId }).then((users) => new Map(users.map((u) => [u.id, u.name] as const)))
      : getUserByIdInOrg(orgId, userId).then((me) => new Map([[me.id, me.name] as const]));

  const [{ rows, total }, branches, nameByUserId] = await Promise.all([
    listAttendanceForOrg(
      orgId,
      {
        dateFrom,
        dateTo,
        branchId,
        status,
        userId: isOrgWide ? undefined : role === 'MANAGER' ? undefined : userId,
        managerId: role === 'MANAGER' ? userId : undefined,
      },
      page,
      PAGE_SIZE,
    ),
    listBranches(orgId, { activeOnly: true }),
    namesPromise,
  ]);

  const branchOptions = branches.map((b) => ({ id: b.id, name: b.name }));
  const filterSearchParams = {
    dateFrom,
    dateTo,
    branchId: branchId !== undefined ? String(branchId) : undefined,
    status,
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text">Absensi</h1>
        <p className="text-sm text-muted">Riwayat check-in dan check-out karyawan.</p>
      </div>

      <AttendanceFilters branches={branchOptions} />

      {total === 0 ? (
        <EmptyState icon={ListChecks} message="Belum ada data absensi untuk filter ini." />
      ) : (
        <>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Karyawan</Table.HeadCell>
                <Table.HeadCell>Tanggal</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Masuk</Table.HeadCell>
                <Table.HeadCell>Keluar</Table.HeadCell>
                <Table.HeadCell>Menit Terlambat</Table.HeadCell>
                <Table.HeadCell>Menit Kerja</Table.HeadCell>
                <Table.HeadCell>Lokasi</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.map((log) => {
                const isOutside = log.checkInIsOutside || log.checkOutIsOutside;
                return (
                  <Table.Row key={log.id}>
                    <Table.Cell>{nameByUserId.get(log.userId) ?? `#${log.userId}`}</Table.Cell>
                    <Table.Cell>{DATE_FORMATTER.format(new Date(log.workDate))}</Table.Cell>
                    <Table.Cell>
                      <StatusBadge status={log.status} />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {formatTime(log.checkInAt)}
                        {log.checkInPhotoUrl ? (
                          <a
                            href={`/api/files/attendance-logs/${log.id}/check-in`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Lihat foto check-in"
                            className="text-muted hover:text-primary"
                          >
                            <Camera className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : null}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {formatTime(log.checkOutAt)}
                        {log.checkOutPhotoUrl ? (
                          <a
                            href={`/api/files/attendance-logs/${log.id}/check-out`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Lihat foto check-out"
                            className="text-muted hover:text-primary"
                          >
                            <Camera className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : null}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{log.lateMinutes}</Table.Cell>
                    <Table.Cell>{log.workMinutes ?? '-'}</Table.Cell>
                    <Table.Cell>
                      {isOutside ? (
                        <TriangleAlert
                          className="h-4 w-4 text-amber-600"
                          aria-label="Di luar radius cabang"
                        />
                      ) : null}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/app/attendance"
            searchParams={filterSearchParams}
          />
        </>
      )}
    </div>
  );
}
