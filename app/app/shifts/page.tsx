import type { Metadata } from 'next';
import { Clock } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { listShifts } from '@/lib/queries/shifts';
import type { ShiftSummary } from '@/lib/queries/shifts';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
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

/**
 * "1,2,3,4,5" → "Sen–Jum", "1,3,5" → "Sen, Rab, Jum", "1,2,3,5" → "Sen–Rab, Jum".
 * Runs of three or more consecutive days collapse into a range, the way schedules are
 * written on paper; the table column stays short enough not to push the actions off.
 */
function formatWorkDays(workDays: string): string {
  const days = Array.from(new Set(workDays.split(',').map(Number)))
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b);
  if (days.length === 7) return 'Setiap hari';
  const parts: string[] = [];
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === (days[j] ?? 0) + 1) j++;
    const run = days.slice(i, j + 1).map((d) => WEEKDAY_SHORT_LABELS[d]);
    parts.push(run.length >= 3 ? `${run[0]}–${run[run.length - 1]}` : run.join(', '));
    i = j + 1;
  }
  return parts.join(', ');
}

// shifts.time_in/time_out come back as TIME strings ("HH:MM" or "HH:MM:SS");
// only the "HH:MM" part is ever displayed.
function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatHours(shift: ShiftSummary): string {
  return `${formatTime(shift.timeIn)}–${formatTime(shift.timeOut)}`;
}

export const metadata: Metadata = { title: 'Shift' };

// Aktif/Nonaktif is the shared Badge (neutral chip + a colored dot, no tinted fill: product-owner
// rule); the word stays the primary cue so the dot is never the only signal.
function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Aktif' : 'Nonaktif'}</Badge>;
}

function CrossDayBadge() {
  return (
    <Badge tone="neutral" dot={false}>
      Lintas Hari
    </Badge>
  );
}

/**
 * Server Component: same shape as app/app/branches/page.tsx — orgId from the
 * session, lib/queries/shifts called directly (TRD.md §5), no self-fetch over
 * /api/shifts. Reading the list is open to any active role (TRD.md §6), so
 * this calls requireSession() with no role filter; the write controls are only
 * rendered for OWNER/ADMIN (cosmetic — the API routes enforce it server-side).
 */
export default async function ShiftsPage() {
  const { orgId, role } = await requireSession();
  const canEdit = ORG_WIDE_ROLES.includes(role);
  const shifts = await listShifts(orgId);

  return (
    <Page>
      <Page.Header
        title="Shift"
        description="Kelola jam kerja, toleransi, dan hari kerja tiap shift."
        actions={canEdit ? <ShiftFormDialog /> : null}
      />

      <Page.Body>
        {shifts.length === 0 ? (
          <EmptyState
            icon={Clock}
            className="lg:flex-1 lg:justify-center"
            message="Belum ada shift. Buat shift agar karyawan punya jadwal masuk dan pulang."
          />
        ) : (
          <>
            {/* Phones and small tablets: a card per shift, actions in reach. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {shifts.map((shift) => (
                <li key={shift.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 flex-wrap items-center gap-2 break-words font-medium text-text">
                        {shift.name}
                        {shift.isCrossDay ? <CrossDayBadge /> : null}
                      </span>
                      <ActiveBadge isActive={shift.isActive} />
                    </div>
                    <p className="text-sm tabular-nums text-text">{formatHours(shift)}</p>
                    <p className="text-sm text-muted">
                      {formatWorkDays(shift.workDays)} · Toleransi {shift.lateToleranceMinutes} menit
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex gap-2 border-t border-border pt-3">
                      <ShiftFormDialog shift={shift} size="md" />
                      <DeleteShiftButton shiftId={shift.id} shiftName={shift.name} size="md" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="hidden md:contents">
              <Table aria-label="Daftar shift">
                <Table.Head>
                  <Table.Row>
                    <Table.HeadCell>Nama</Table.HeadCell>
                    <Table.HeadCell>Jadwal</Table.HeadCell>
                    <Table.HeadCell className="text-right">Toleransi</Table.HeadCell>
                    <Table.HeadCell>Status</Table.HeadCell>
                    {canEdit ? <Table.HeadCell className="text-right">Aksi</Table.HeadCell> : null}
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {shifts.map((shift) => (
                    <Table.Row key={shift.id}>
                      <Table.Cell wrap className="min-w-36 font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          {shift.name}
                          {shift.isCrossDay ? <CrossDayBadge /> : null}
                        </div>
                      </Table.Cell>
                      {/* Hours over weekdays in one cell: two columns pushed the Aksi buttons off the right
                          edge at 1024px (sidebar open), and the phone card already pairs them this way. */}
                      <Table.Cell>
                        <div>{formatHours(shift)}</div>
                        <div className="text-muted">{formatWorkDays(shift.workDays)}</div>
                      </Table.Cell>
                      <Table.Cell className="text-right text-muted">{shift.lateToleranceMinutes} menit</Table.Cell>
                      <Table.Cell>
                        <ActiveBadge isActive={shift.isActive} />
                      </Table.Cell>
                      {canEdit ? (
                        <Table.Cell className="text-right">
                          <div className="flex justify-end gap-1">
                            <ShiftFormDialog shift={shift} />
                            <DeleteShiftButton shiftId={shift.id} shiftName={shift.name} />
                          </div>
                        </Table.Cell>
                      ) : null}
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
