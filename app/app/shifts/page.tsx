import { Clock } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listShifts } from '@/lib/queries/shifts';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/shared/EmptyState';
import ShiftFormDialog from './shift-form-dialog';
import DeleteShiftButton from './delete-shift-button';

// ISO weekday (1=Mon…7=Sun, ERD.md §1.1) → short Indonesian label, for display
// only. The raw "1,2,3,4,5" string is never shown to the admin.
const WEEKDAY_SHORT_LABELS: Record<number, string> = {
  1: 'Sen',
  2: 'Sel',
  3: 'Rab',
  4: 'Kam',
  5: 'Jum',
  6: 'Sab',
  7: 'Min',
};

function formatWorkDays(workDays: string): string {
  return workDays
    .split(',')
    .map((iso) => WEEKDAY_SHORT_LABELS[Number(iso)] ?? iso)
    .join(', ');
}

// shifts.time_in/time_out come back as TIME strings ("HH:MM" or "HH:MM:SS");
// only the "HH:MM" part is ever displayed.
function formatTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * Server Component: same shape as app/app/branches/page.tsx — orgId from the
 * session, lib/queries/shifts called directly (TRD.md §5), no self-fetch over
 * /api/shifts. Reading the list is open to any active role (TRD.md §6), so
 * this calls requireSession() with no role filter; the write controls below
 * only work through the API routes, which enforce OWNER/ADMIN server-side.
 */
export default async function ShiftsPage() {
  const { orgId } = await requireSession();
  const shifts = await listShifts(orgId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Shift</h1>
          <p className="text-sm text-muted">Kelola jam kerja, toleransi, dan hari kerja tiap shift.</p>
        </div>
        <ShiftFormDialog />
      </div>

      {shifts.length === 0 ? (
        <EmptyState icon={Clock} message="Belum ada shift." />
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Nama</Table.HeadCell>
              <Table.HeadCell>Jam Kerja</Table.HeadCell>
              <Table.HeadCell>Hari Kerja</Table.HeadCell>
              <Table.HeadCell>Toleransi</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell className="text-right">Aksi</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {shifts.map((shift) => (
              <Table.Row key={shift.id}>
                <Table.Cell className="font-medium text-text">
                  <div className="flex items-center gap-2">
                    {shift.name}
                    {shift.isCrossDay ? <Badge className="bg-primary/10 text-primary">Lintas Hari</Badge> : null}
                  </div>
                </Table.Cell>
                <Table.Cell className="text-muted">
                  {formatTime(shift.timeIn)}–{formatTime(shift.timeOut)}
                </Table.Cell>
                <Table.Cell className="text-muted">{formatWorkDays(shift.workDays)}</Table.Cell>
                <Table.Cell className="text-muted">{shift.lateToleranceMinutes} menit</Table.Cell>
                <Table.Cell>
                  <Badge
                    className={
                      shift.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-black/5 dark:bg-white/5 text-muted'
                    }
                  >
                    {shift.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex justify-end gap-2">
                    <ShiftFormDialog shift={shift} />
                    <DeleteShiftButton shiftId={shift.id} shiftName={shift.name} />
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}
