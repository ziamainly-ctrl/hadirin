import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Card from '@/components/ui/Card';
import Page from '@/components/shared/Page';
import { requireSession } from '@/lib/auth';
import { NotFoundError } from '@/lib/db';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { idParam } from '@/lib/validators/common';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { listBranches } from '@/lib/queries/branches';
import { listShifts } from '@/lib/queries/shifts';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { safeTimezone } from '@/lib/safe-timezone';
import EmployeeAttendance from './employee-attendance';
import EmployeeFormDialog from '../employee-form-dialog';
import ResetPasswordButton from '../reset-password-button';
import { toCalendarDate } from '../../attendance/format';
import { RoleBadge, UserStatusBadge } from '../user-status-badge';

export const metadata: Metadata = { title: 'Detail Karyawan' };

// timeZone: 'UTC' keeps a pure calendar date (DATE column, no time component) from
// shifting to the previous/next day when formatted — same trick as RequestCard.tsx. The
// value is normalised with toCalendarDate first (see below), so it is always "YYYY-MM-DD".
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function formatJoinedAt(value: string | null): string {
  return value ? DATE_FORMATTER.format(new Date(value)) : '—';
}

interface EmployeeDetailPageProps {
  params: Promise<{ id: string }>;
}

// Server Component: reads the session and queries directly (TRD.md §5), no self-fetch.
export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { userId, orgId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);

  const parsedId = idParam.safeParse((await params).id);
  if (!parsedId.success) notFound();
  const id = parsedId.data;

  let employee;
  try {
    employee = await getUserByIdInOrg(orgId, id);
  } catch (error) {
    // AGENTS.md domain rule #7: cross-tenant ids → 404, not an error page.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const isOrgWide = ORG_WIDE_ROLES.includes(role);
  // AGENTS.md domain rules #1/#2: a MANAGER only acts on direct reports — this mirrors
  // the managerId scoping app/app/employees/page.tsx applies via listUsers, extended
  // here so a MANAGER can't open an arbitrary org member's page by guessing an id.
  if (!isOrgWide && employee.managerId !== userId) {
    notFound();
  }

  // joined_at is a DATE column, which the driver hands back as a JS Date at server-local
  // midnight although the row type says string. Left as is, the edit dialog's date field came
  // up empty (saving would then send an ISO timestamp the validator rejects, or blank the
  // date) and the facts card printed the day before on an Asia/Jakarta server. Normalising
  // once here, in the Server Component that received the row, fixes both.
  const joinedAt = employee.joinedAt ? toCalendarDate(employee.joinedAt) : null;
  const employeeForForm = { ...employee, joinedAt };

  const [branches, shifts, org] = await Promise.all([listBranches(orgId), listShifts(orgId), getOrganizationPlanContext(orgId)]);
  const timeZone = safeTimezone(org?.timezone ?? 'Asia/Jakarta');
  const branchOptions = branches.map((branch) => ({ id: branch.id, name: branch.name, isActive: branch.isActive }));
  const shiftOptions = shifts.map((shift) => ({ id: shift.id, name: shift.name, isActive: shift.isActive }));
  const branchName = employee.branchId != null ? branches.find((b) => b.id === employee.branchId)?.name ?? '—' : '—';
  const shiftName = employee.shiftId != null ? shifts.find((s) => s.id === employee.shiftId)?.name ?? '—' : '—';

  const details: { label: string; value: React.ReactNode }[] = [
    { label: 'Peran', value: <RoleBadge role={employee.role} /> },
    { label: 'Status', value: <UserStatusBadge status={employee.status} /> },
    { label: 'Kode Karyawan', value: employee.employeeCode ?? '—' },
    { label: 'Email', value: employee.email ?? '—' },
    { label: 'Telepon', value: employee.phone ?? '—' },
    { label: 'Tanggal Bergabung', value: formatJoinedAt(joinedAt) },
    { label: 'Cabang', value: branchName },
    { label: 'Shift', value: employee.shiftId == null ? 'Tanpa shift (tidak perlu absen)' : shiftName },
  ];

  // max-w-4xl: the same reading column as the settings pages, so on a wide monitor the
  // detail grid doesn't drift a whole screen apart. Three columns from lg keep all eight
  // facts on one short screen (no scrolling at 1024x600).
  return (
    <Page className="w-full max-w-4xl">
      <Link
        href="/app/employees"
        className="-mb-1 inline-flex min-h-8 items-center gap-1.5 self-start rounded-input text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-10"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke Karyawan
      </Link>

      {/* Edit and reset both go through OWNER/ADMIN-only routes (app/api/users/[id]),
          so a MANAGER viewing a direct report gets a read-only page instead of
          buttons that can only fail with 403. */}
      <Page.Header
        title={employee.name}
        description={employee.position ?? 'Posisi belum diisi'}
        actions={
          isOrgWide ? (
            <>
              <EmployeeFormDialog existingUser={employeeForForm} branches={branchOptions} shifts={shiftOptions} actorRole={role} />
              <ResetPasswordButton userId={employee.id} userName={employee.name} />
            </>
          ) : null
        }
      />

      <Page.Body>
        <Card className="fit-pad shrink-0">
          <dl className="grid gap-x-6 gap-y-5 fit-gap-y sm:grid-cols-2 lg:grid-cols-3 [@media(min-width:1024px)_and_(max-height:700px)]:grid-cols-4">
            {details.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{item.label}</dt>
                <dd className="mt-1 break-words text-sm text-text">{item.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        {/* What this person's check-ins look like: the month at a glance and their latest rows, from the
            same queries the Absensi table and Riwayat Saya use. */}
        <EmployeeAttendance orgId={orgId} employeeId={employee.id} timeZone={timeZone} tracked={employee.shiftId != null} />
      </Page.Body>
    </Page>
  );
}
