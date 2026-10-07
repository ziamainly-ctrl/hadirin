import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import EmployeeFormDialog from './employee-form-dialog';
import { RoleBadge, UserStatusBadge } from './user-status-badge';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { listUsers } from '@/lib/queries/users';
import { listBranches } from '@/lib/queries/branches';
import { listShifts } from '@/lib/queries/shifts';

export const metadata: Metadata = { title: 'Karyawan' };

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
    <Page>
      <Page.Header
        title="Karyawan"
        description="Kelola data karyawan, peran, cabang, dan shift."
        actions={isOrgWide ? <EmployeeFormDialog branches={branchOptions} shifts={shiftOptions} /> : null}
      />

      <Page.Body>
        {employees.length === 0 ? (
          <EmptyState
            icon={Users}
            className="lg:flex-1 lg:justify-center"
            message={
              isOrgWide
                ? 'Belum ada karyawan. Tambahkan karyawan pertama Anda agar mereka bisa mulai absen.'
                : 'Belum ada karyawan yang melapor kepada Anda.'
            }
          />
        ) : (
          <>
            {/* Phones and small tablets: one tappable card per employee. Six columns don't
                fit there, and a sideways-scrolling table hides the status column. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {employees.map((employee) => (
                <li key={employee.id}>
                  <Link
                    href={`/app/employees/${employee.id}`}
                    className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-text">{employee.name}</span>
                        <UserStatusBadge status={employee.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                        <RoleBadge role={employee.role} />
                        {employee.employeeCode ? <span className="tabular-nums">{employee.employeeCode}</span> : null}
                      </div>
                      <p className="truncate text-sm text-muted">
                        {employee.branchId == null ? 'Tanpa cabang' : lookupName(branchNameById, employee.branchId)}
                        {' · '}
                        {employee.shiftId == null ? 'Tanpa shift' : `Shift ${lookupName(shiftNameById, employee.shiftId)}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden md:contents">
              <Table aria-label="Daftar karyawan">
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
                      <Table.Cell wrap className="min-w-44">
                        {/* The ::after stretches the tap area over the whole cell height (it was an 18px
                            strip of text in a 48px row) without changing the box the focus ring hugs. */}
                        <Link
                          href={`/app/employees/${employee.id}`}
                          className="relative rounded-input font-medium text-text after:absolute after:-inset-x-2 after:-inset-y-3 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {employee.name}
                        </Link>
                      </Table.Cell>
                      <Table.Cell className="text-muted">{employee.employeeCode ?? '—'}</Table.Cell>
                      <Table.Cell>
                        <RoleBadge role={employee.role} />
                      </Table.Cell>
                      <Table.Cell wrap className="min-w-32">
                        {lookupName(branchNameById, employee.branchId)}
                      </Table.Cell>
                      <Table.Cell wrap className="min-w-24">
                        {lookupName(shiftNameById, employee.shiftId)}
                      </Table.Cell>
                      <Table.Cell>
                        <UserStatusBadge status={employee.status} />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </>
        )}
      </Page.Body>
    </Page>
  );
}
