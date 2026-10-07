import Link from 'next/link';
import { Users } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/shared/EmptyState';
import EmployeeFormDialog from './employee-form-dialog';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import type { UserRole } from '@/lib/constants/roles';
import type { UserStatus } from '@/lib/constants/statuses';
import { listUsers } from '@/lib/queries/users';
import { listBranches } from '@/lib/queries/branches';
import { listShifts } from '@/lib/queries/shifts';

// Role is not an attendance status (StatusBadge.tsx is reserved for AttendanceStatus),
// so it gets its own small local label/color map — same pattern as RequestCard.tsx's
// local TYPE_LABELS and StatusBadge.tsx's own STATUS_LABELS.
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

function lookupName(map: Map<number, string>, id: number | null): string {
  if (id == null) return '—';
  return map.get(id) ?? '—';
}

// Server Component: reads the session and queries directly (TRD.md §5), no self-fetch
// over /api/users. TRD.md §6: OWNER/ADMIN see the whole org; MANAGER is scoped to their
// own direct reports via listUsers's managerId filter — same scoping app/api/users/route.ts's
// GET handler applies, re-derived here from the session rather than trusted from a query string.
export default async function EmployeesPage() {
  const { userId, orgId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const isOrgWide = ORG_WIDE_ROLES.includes(role);

  const [employees, branches, shifts] = await Promise.all([
    listUsers(orgId, { managerId: isOrgWide ? undefined : userId }),
    listBranches(orgId),
    listShifts(orgId),
  ]);

  // Unfiltered (not activeOnly) so a deactivated branch/shift still resolves to its
  // real name here, and so editing an employee already on one doesn't silently blank
  // that assignment in the form (see employee-form-dialog.tsx's isActive suffix).
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.name]));
  const shiftNameById = new Map(shifts.map((shift) => [shift.id, shift.name]));
  const branchOptions = branches.map((branch) => ({ id: branch.id, name: branch.name, isActive: branch.isActive }));
  const shiftOptions = shifts.map((shift) => ({ id: shift.id, name: shift.name, isActive: shift.isActive }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Karyawan</h1>
          <p className="text-sm text-muted">Kelola data karyawan, peran, cabang, dan shift.</p>
        </div>
        {isOrgWide ? <EmployeeFormDialog branches={branchOptions} shifts={shiftOptions} /> : null}
      </div>

      {employees.length === 0 ? (
        <EmptyState icon={Users} message="Belum ada karyawan." />
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Nama</Table.HeadCell>
              <Table.HeadCell>Kode</Table.HeadCell>
              <Table.HeadCell>Peran</Table.HeadCell>
              <Table.HeadCell>Cabang</Table.HeadCell>
              <Table.HeadCell>Shift</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {employees.map((employee) => (
              <Table.Row key={employee.id}>
                <Table.Cell>
                  <Link href={`/app/employees/${employee.id}`} className="font-medium text-text hover:underline">
                    {employee.name}
                  </Link>
                </Table.Cell>
                <Table.Cell>{employee.employeeCode ?? '—'}</Table.Cell>
                <Table.Cell>
                  <Badge className="bg-primary/10 text-primary">{ROLE_LABELS[employee.role]}</Badge>
                </Table.Cell>
                <Table.Cell>{lookupName(branchNameById, employee.branchId)}</Table.Cell>
                <Table.Cell>{lookupName(shiftNameById, employee.shiftId)}</Table.Cell>
                <Table.Cell>
                  <Badge className={USER_STATUS_BADGE_CLASSES[employee.status]}>
                    {USER_STATUS_LABELS[employee.status]}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}
