'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, TriangleAlert } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Dialog from '@/components/ui/Dialog';
import StatusBadge, { StatusDot } from '@/components/shared/StatusBadge';
import type { AttendanceStatus } from '@/lib/constants/statuses';
import HolidayDeleteButton from './holiday-delete-button';
import HolidayForm from './holiday-form';
import { holidayKindLabel } from './holiday-types';
import type { DayDialogRow, HolidayEntry } from './holiday-types';

export interface DayDialogProps {
  date: string;
  /** "Rabu, 7 Oktober 2026". */
  title: string;
  holidays: HolidayEntry[];
  rows: DayDialogRow[];
  truncated: boolean;
  isToday: boolean;
  isFuture: boolean;
  canManageHolidays: boolean;
  /** Calendar URL without `day`: where closing the dialog goes. */
  closeHref: string;
  /** /app/attendance for this day, for the full list with filters and selfies. */
  attendanceHref: string;
}

const SUMMARY_ORDER: ReadonlyArray<{ label: string; status: AttendanceStatus; match: (s: AttendanceStatus) => boolean }> = [
  { label: 'Hadir', status: 'PRESENT', match: (s) => s === 'PRESENT' },
  { label: 'Terlambat', status: 'LATE', match: (s) => s === 'LATE' },
  { label: 'Tidak hadir', status: 'ABSENT', match: (s) => s === 'ABSENT' },
  { label: 'Cuti/Sakit/Izin', status: 'LEAVE', match: (s) => s === 'LEAVE' || s === 'SICK' || s === 'PERMIT' },
];

function emptyMessage(isToday: boolean, isFuture: boolean, hasHoliday: boolean): string {
  if (isFuture) return 'Hari ini belum tiba, jadi belum ada catatan absensi.';
  if (isToday) return 'Belum ada catatan absensi hari ini. Check-in pertama akan muncul di sini.';
  if (hasHoliday) return 'Tidak ada catatan absensi pada hari libur ini.';
  return 'Tidak ada catatan absensi pada tanggal ini.';
}

/**
 * The opened day of the calendar (`?day=`). The page renders it on the server with that day's
 * rows already in the props, so opening a day is one navigation and no client fetch. OWNER/ADMIN also
 * manage COMPANY holidays here (POST/DELETE /api/holidays); national holidays are read-only.
 */
export default function DayDialog({
  date,
  title,
  holidays,
  rows,
  truncated,
  isToday,
  isFuture,
  canManageHolidays,
  closeHref,
  attendanceHref,
}: DayDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const closing = useRef(false);

  function close() {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  }

  const counts = SUMMARY_ORDER.map((entry) => ({
    ...entry,
    count: rows.filter((r) => entry.match(r.status)).length,
  }));

  return (
    <Dialog open={open} onClose={close} title={title} size="lg">
      <Dialog.Body className="flex flex-col gap-4">
        {holidays.length > 0 ? (
          <section aria-label="Hari libur" className="flex flex-col gap-2">
            {holidays.map((holiday) => (
              <div key={`${holiday.scope}-${holiday.id}`} className="flex items-center justify-between gap-3 rounded-input border border-border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusDot status="HOLIDAY" className="h-2 w-2" />
                  <span className="min-w-0 break-words text-sm font-medium text-text">{holiday.name}</span>
                  <Badge tone="neutral" dot={false} className="border border-border bg-accent text-muted">
                    {holidayKindLabel(holiday)}
                  </Badge>
                </div>
                {canManageHolidays && holiday.scope === 'COMPANY' ? (
                  <HolidayDeleteButton holidayId={holiday.id} holidayName={holiday.name} />
                ) : null}
              </div>
            ))}
            <p className="text-xs text-muted">Hari libur tidak menutup check-in. Yang bekerja pada hari ini tetap tercatat hadir.</p>
          </section>
        ) : null}

        {rows.length > 0 ? (
          <section aria-label="Ringkasan kehadiran">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {counts.map((c) => (
                <li key={c.label} className="inline-flex items-center gap-1.5 tabular-nums">
                  <StatusDot status={c.status} />
                  <span className="font-semibold text-text">{c.count}</span>
                  <span className="text-muted">{c.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {rows.length === 0 ? (
          <p className="rounded-input border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            {emptyMessage(isToday, isFuture, holidays.length > 0)}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border" aria-label={`Catatan absensi ${title}`}>
            {rows.map((row) => (
              <li key={row.logId} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-medium text-text">{row.name}</p>
                  <p className="text-xs tabular-nums text-muted">
                    Masuk {row.checkIn} · Keluar {row.checkOut}
                    {row.branchName ? ` · ${row.branchName}` : ''}
                  </p>
                  {row.note || row.isOutside ? (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      {row.note ? <span className="tabular-nums">{row.note}</span> : null}
                      {row.isOutside ? (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Luar area
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={row.status} className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
        {truncated ? (
          <p className="text-xs text-muted">Hanya sebagian catatan yang ditampilkan. Buka Absensi untuk daftar lengkap dengan filter.</p>
        ) : null}

        {canManageHolidays && holidays.length === 0 ? (
          adding ? (
            <section aria-label="Tandai libur perusahaan" className="rounded-card border border-border p-3">
              <h3 className="mb-3 text-sm font-semibold text-text">Tandai sebagai libur perusahaan</h3>
              <HolidayForm
                date={date}
                onCreated={() => {
                  setAdding(false);
                  router.refresh();
                }}
                onCancel={() => setAdding(false)}
              />
            </section>
          ) : (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Tandai Libur Perusahaan
              </Button>
            </div>
          )
        ) : null}
      </Dialog.Body>
      <Dialog.Footer>
        <Button type="button" variant="ghost" onClick={close}>
          Tutup
        </Button>
        {isFuture ? null : (
          <ButtonLink href={attendanceHref} variant="outline">
            Buka di Absensi
          </ButtonLink>
        )}
      </Dialog.Footer>
    </Dialog>
  );
}
