import { History } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { listHistoryForUser } from '@/lib/queries/attendance';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';

const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  // work_date is a pure calendar date (no time component) — format in UTC so it never
  // shifts to the previous/next day in a viewer's local zone (see RequestCard.tsx).
  timeZone: 'UTC',
});

/** HH:MM in the display timezone (TRD.md §14); '—' for a log with no timestamp yet.
 * Mirrors lib/export/xlsx.ts's formatTimeJakarta(). */
function formatTimeJakarta(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Server Component: reads the session directly and calls lib/queries/attendance.ts
// (TRD.md §5) — no self-fetch over /api/*.
export default async function HistoryPage() {
  const { orgId, userId } = await requireSession();
  const history = await listHistoryForUser(orgId, userId, 30);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Riwayat Absensi</h1>

      {history.length === 0 ? (
        <EmptyState icon={History} message="Belum ada riwayat absensi." />
      ) : (
        <ul className="flex flex-col gap-3">
          {history.map((log) => (
            <li key={log.id}>
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text">
                    {DATE_FORMATTER.format(new Date(log.workDate))}
                  </span>
                  <StatusBadge status={log.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-muted">
                  <span>Masuk: {formatTimeJakarta(log.checkInAt)}</span>
                  <span>Keluar: {formatTimeJakarta(log.checkOutAt)}</span>
                </div>
                {log.lateMinutes > 0 || log.workMinutes !== null ? (
                  <div className="mt-1 flex gap-3 text-xs text-muted">
                    {log.lateMinutes > 0 ? <span>Terlambat {log.lateMinutes} menit</span> : null}
                    {log.workMinutes !== null ? <span>Durasi kerja {log.workMinutes} menit</span> : null}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
