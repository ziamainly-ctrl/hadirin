import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { requireSession } from '@/lib/auth';
import { NotFoundError } from '@/lib/db';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import type { UserRole } from '@/lib/constants/roles';
import type { UserStatus } from '@/lib/constants/statuses';
import { idParam } from '@/lib/validators/common';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { listBranches } from '@/lib/queries/branches';
import { listShifts } from '@/lib/queries/shifts';
import EmployeeFormDialog from '../employee-form-dialog';
import ResetPasswordButton from '../reset-password-button';

// Same local label/color maps as app/app/employees/page.tsx — see that file's comment
// for why these stay local instead of living in lib/constants/.
const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Pemilik',
  ADMIN: 'Admin',
  MANAGER: 'Manajer',
  EMPLOYEE: 'Karyawan',
};

const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Nonaktif',
};

const USER_STATUS_BADGE_CLASSES: Record<UserStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  INACTIVE: 'bg-black/5 dark:bg-white/5 text-muted',
};

// timeZone: 'UTC' keeps a pure calendar date (DATE column, no time component) from
// shifting to the previous/next day when formatted — same trick as RequestCard.tsx.
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

  const [branches, shifts] = await Promise.all([listBranches(orgId), listShifts(orgId)]);
  const branchOptions = branches.map((branch) => ({ id: branch.id, name: branch.name, isActive: branch.isActive }));
  const shiftOptions = shifts.map((shift) => ({ id: shift.id, name: shift.name, isActive: shift.isActive }));
  const branchName = employee.branchId != null ? branches.find((b) => b.id === employee.branchId)?.name ?? '—' : '—';
  const shiftName = employee.shiftId != null ? shifts.find((s) => s.id === employee.shiftId)?.name ?? '—' : '—';

  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/employees" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke Karyawan
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">{employee.name}</h1>
          <p className="text-sm text-muted">{employee.position ?? 'Tanpa posisi'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EmployeeFormDialog existingUser={employee} branches={branchOptions} shifts={shiftOptions} />
          {isOrgWide ? <ResetPasswordButton userId={employee.id} userName={employee.name} /> : null}
        </div>
      </div>

      <Card>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Kode Karyawan</dt>
            <dd className="mt-1 text-sm text-text">{employee.employeeCode ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Peran</dt>
            <dd className="mt-1">
              <Badge className="bg-primary/10 text-primary">{ROLE_LABELS[employee.role]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Status</dt>
            <dd className="mt-1">
              <Badge className={USER_STATUS_BADGE_CLASSES[employee.status]}>
                {USER_STATUS_LABELS[employee.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-1 text-sm text-text">{employee.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Telepon</dt>
            <dd className="mt-1 text-sm text-text">{employee.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Cabang</dt>
            <dd className="mt-1 text-sm text-text">{branchName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Shift</dt>
            <dd className="mt-1 text-sm text-text">{shiftName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Tanggal Bergabung</dt>
            <dd className="mt-1 text-sm text-text">{formatJoinedAt(employee.joinedAt)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
