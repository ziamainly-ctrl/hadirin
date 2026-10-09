import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import ReviewCardList from '@/components/shared/ReviewCardList';
import SelfieLink from '@/components/shared/SelfieLink';
import { formatMinutes } from '@/app/app/attendance/format';
import { formatClock, formatScheduleTime } from '@/app/m/format';
import { lateCategory } from '@/lib/attendance-rules';
import { LATE_CATEGORY_A_MAX_MIN, LATE_CATEGORY_B_MAX_MIN } from '@/lib/insights-constants';
import { formatDaysAgo, formatWorkDate, percent } from '@/lib/insights-format';
import type {
  EarlyLeaveLogRow,
  ForgottenCheckoutRow,
  LateEmployeeRow,
  LateLogRow,
} from '@/lib/queries/insights';

// Server-rendered tab bodies of /app/terlambat. Each view is a phone card list (below sm) plus a
// <Table> that is a direct flex child of Page.Body, so on desktop the rows scroll inside the card
// with the head pinned and the pager (rendered by the page) stays in view.

const NUM = 'text-right tabular-nums';

/** Header hint for the A / B / C columns, also the wording of the legend on the page. */
export const CATEGORY_LEGEND = `A sampai ${LATE_CATEGORY_A_MAX_MIN} mnt, B sampai ${LATE_CATEGORY_B_MAX_MIN} mnt, C lebih dari ${LATE_CATEGORY_B_MAX_MIN} mnt`;

function CategoryBadge({ minutes }: { minutes: number }) {
  const category = lateCategory(minutes);
  if (!category) return <span className="text-muted">—</span>;
  const tone = category === 'C' ? 'danger' : category === 'B' ? 'warning' : 'neutral';
  return (
    <Badge tone={tone} title={CATEGORY_LEGEND}>
      Kategori {category}
    </Badge>
  );
}

/** "2 / 1 / 0": zeros muted so the categories that happened stand out, a category C in red text. */
function Spread({ a, b, c }: { a: number; b: number; c: number }) {
  const tone = (n: number) => (n === 0 ? 'text-muted' : 'text-text');
  return (
    <span className="tabular-nums" title={CATEGORY_LEGEND}>
      <span className={tone(a)}>{a}</span>
      <span className="text-muted"> / </span>
      <span className={tone(b)}>{b}</span>
      <span className="text-muted"> / </span>
      <span className={c > 0 ? 'font-medium text-destructive' : 'text-muted'}>{c}</span>
    </span>
  );
}

function EmployeeLink({ id, name }: { id: number; name: string }) {
  return (
    <Link
      href={`/app/employees/${id}`}
      className="block max-w-56 truncate rounded-sm font-medium text-text hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      title={name}
    >
      {name}
    </Link>
  );
}

function OutsideFlag() {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Luar area
    </span>
  );
}

// ---------------------------------------------------------------------------------------------

export function LateSummaryView({ rows }: { rows: LateEmployeeRow[] }) {
  return (
    <>
      <ReviewCardList
        aria-label="Keterlambatan per karyawan"
        items={rows.map((row) => ({
          key: row.userId,
          title: <EmployeeLink id={row.userId} name={row.name} />,
          subtitle: row.branchName ?? 'Tanpa cabang',
          badge: <span className="font-semibold tabular-nums text-text">{row.lateCount}x</span>,
          facts: [
            { label: 'Total', value: formatMinutes(row.totalLateMinutes) },
            { label: 'Rata-rata', value: formatMinutes(row.avgLateMinutes) },
            { label: 'Terlama', value: formatMinutes(row.maxLateMinutes) },
            { label: 'Dari hadir', value: `${percent(row.lateCount, row.attendedDays)}%` },
          ],
          footer: (
            <>
              <span>A / B / C</span>
              <Spread a={row.catA} b={row.catB} c={row.catC} />
            </>
          ),
        }))}
      />
      <div className="hidden min-h-0 flex-col sm:flex">
        <Table aria-label="Keterlambatan per karyawan">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Karyawan</Table.HeadCell>
              <Table.HeadCell className={NUM}>Terlambat</Table.HeadCell>
              <Table.HeadCell className={NUM}>Dari Hari Hadir</Table.HeadCell>
              <Table.HeadCell className={NUM}>Total</Table.HeadCell>
              <Table.HeadCell className={NUM}>Rata-rata</Table.HeadCell>
              <Table.HeadCell className={NUM}>Terlama</Table.HeadCell>
              <Table.HeadCell className={NUM} title={CATEGORY_LEGEND}>
                A / B / C
              </Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={row.userId}>
                <Table.Cell>
                  <EmployeeLink id={row.userId} name={row.name} />
                  <span className="block max-w-56 truncate text-xs text-muted">{row.branchName ?? 'Tanpa cabang'}</span>
                </Table.Cell>
                <Table.Cell className={`${NUM} font-medium`}>{row.lateCount}x</Table.Cell>
                <Table.Cell className={NUM}>
                  <span className="font-medium">{percent(row.lateCount, row.attendedDays)}%</span>{' '}
                  <span className="text-muted">({row.lateCount} dari {row.attendedDays})</span>
                </Table.Cell>
                <Table.Cell className={NUM}>{formatMinutes(row.totalLateMinutes)}</Table.Cell>
                <Table.Cell className={NUM}>{formatMinutes(row.avgLateMinutes)}</Table.Cell>
                <Table.Cell className={NUM}>{formatMinutes(row.maxLateMinutes)}</Table.Cell>
                <Table.Cell className={NUM}>
                  <Spread a={row.catA} b={row.catB} c={row.catC} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

export function LateDetailView({ rows, timeZone }: { rows: LateLogRow[]; timeZone: string }) {
  return (
    <>
      <ReviewCardList
        aria-label="Rincian keterlambatan"
        items={rows.map((row) => ({
          key: row.logId,
          title: <EmployeeLink id={row.userId} name={row.name} />,
          subtitle: formatWorkDate(row.workDate),
          badge: <CategoryBadge minutes={row.lateMinutes} />,
          facts: [
            { label: 'Jadwal', value: row.scheduledIn ? formatScheduleTime(row.scheduledIn) : '—' },
            { label: 'Masuk', value: formatClock(row.checkInAt, timeZone) },
            { label: 'Terlambat', value: formatMinutes(row.lateMinutes) },
            { label: 'Cabang', value: row.branchName ?? '—' },
          ],
          footer: (
            <>
              {row.isOutside ? <OutsideFlag /> : null}
              {row.hasPhoto ? <SelfieLink logId={row.logId} kind="check-in" /> : null}
            </>
          ),
        }))}
      />
      <div className="hidden min-h-0 flex-col sm:flex">
        <Table aria-label="Rincian keterlambatan">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Tanggal</Table.HeadCell>
              <Table.HeadCell>Karyawan</Table.HeadCell>
              <Table.HeadCell className={NUM}>Jadwal Masuk</Table.HeadCell>
              <Table.HeadCell className={NUM}>Masuk</Table.HeadCell>
              <Table.HeadCell className={NUM}>Terlambat</Table.HeadCell>
              <Table.HeadCell>Kategori</Table.HeadCell>
              <Table.HeadCell>Cabang</Table.HeadCell>
              <Table.HeadCell>Foto</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={row.logId}>
                <Table.Cell>{formatWorkDate(row.workDate)}</Table.Cell>
                <Table.Cell>
                  <EmployeeLink id={row.userId} name={row.name} />
                </Table.Cell>
                <Table.Cell className={NUM}>{row.scheduledIn ? formatScheduleTime(row.scheduledIn) : '—'}</Table.Cell>
                <Table.Cell className={NUM}>
                  <span className="inline-flex items-center gap-2">
                    {formatClock(row.checkInAt, timeZone)}
                    {row.isOutside ? <OutsideFlag /> : null}
                  </span>
                </Table.Cell>
                <Table.Cell className={`${NUM} font-medium`}>{formatMinutes(row.lateMinutes)}</Table.Cell>
                <Table.Cell>
                  <CategoryBadge minutes={row.lateMinutes} />
                </Table.Cell>
                <Table.Cell>
                  <span className="block max-w-40 truncate" title={row.branchName ?? undefined}>
                    {row.branchName ?? '—'}
                  </span>
                </Table.Cell>
                <Table.Cell>{row.hasPhoto ? <SelfieLink logId={row.logId} kind="check-in" /> : <span className="text-muted">—</span>}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

export function EarlyLeaveView({ rows, timeZone }: { rows: EarlyLeaveLogRow[]; timeZone: string }) {
  return (
    <>
      <ReviewCardList
        aria-label="Pulang lebih awal"
        items={rows.map((row) => ({
          key: row.logId,
          title: <EmployeeLink id={row.userId} name={row.name} />,
          subtitle: formatWorkDate(row.workDate),
          badge: <span className="font-semibold tabular-nums text-text">{formatMinutes(row.earlyLeaveMinutes)}</span>,
          facts: [
            { label: 'Jadwal', value: row.scheduledOut ? formatScheduleTime(row.scheduledOut) : '—' },
            { label: 'Keluar', value: formatClock(row.checkOutAt, timeZone) },
            { label: 'Cabang', value: row.branchName ?? '—' },
          ],
          footer: row.hasPhoto ? <SelfieLink logId={row.logId} kind="check-out" /> : null,
        }))}
      />
      <div className="hidden min-h-0 flex-col sm:flex">
        <Table aria-label="Pulang lebih awal">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Tanggal</Table.HeadCell>
              <Table.HeadCell>Karyawan</Table.HeadCell>
              <Table.HeadCell className={NUM}>Jadwal Keluar</Table.HeadCell>
              <Table.HeadCell className={NUM}>Keluar</Table.HeadCell>
              <Table.HeadCell className={NUM}>Lebih Awal</Table.HeadCell>
              <Table.HeadCell>Cabang</Table.HeadCell>
              <Table.HeadCell>Foto</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={row.logId}>
                <Table.Cell>{formatWorkDate(row.workDate)}</Table.Cell>
                <Table.Cell>
                  <EmployeeLink id={row.userId} name={row.name} />
                </Table.Cell>
                <Table.Cell className={NUM}>{row.scheduledOut ? formatScheduleTime(row.scheduledOut) : '—'}</Table.Cell>
                <Table.Cell className={NUM}>{formatClock(row.checkOutAt, timeZone)}</Table.Cell>
                <Table.Cell className={`${NUM} font-medium`}>{formatMinutes(row.earlyLeaveMinutes)}</Table.Cell>
                <Table.Cell>
                  <span className="block max-w-40 truncate" title={row.branchName ?? undefined}>
                    {row.branchName ?? '—'}
                  </span>
                </Table.Cell>
                <Table.Cell>{row.hasPhoto ? <SelfieLink logId={row.logId} kind="check-out" /> : <span className="text-muted">—</span>}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

export function ForgottenCheckoutView({
  rows,
  timeZone,
  today,
}: {
  rows: ForgottenCheckoutRow[];
  timeZone: string;
  today: string;
}) {
  return (
    <>
      <ReviewCardList
        aria-label="Lupa check-out"
        items={rows.map((row) => ({
          key: row.logId,
          title: <EmployeeLink id={row.userId} name={row.name} />,
          subtitle: formatWorkDate(row.workDate),
          badge: <span className="text-xs text-muted">{formatDaysAgo(row.workDate, today)}</span>,
          facts: [
            { label: 'Masuk', value: formatClock(row.checkInAt, timeZone) },
            { label: 'Jadwal keluar', value: row.scheduledOut ? formatScheduleTime(row.scheduledOut) : '—' },
            { label: 'Cabang', value: row.branchName ?? '—' },
          ],
          footer: row.hasPhoto ? <SelfieLink logId={row.logId} kind="check-in" /> : null,
        }))}
      />
      <div className="hidden min-h-0 flex-col sm:flex">
        <Table aria-label="Lupa check-out">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Tanggal</Table.HeadCell>
              <Table.HeadCell>Karyawan</Table.HeadCell>
              <Table.HeadCell className={NUM}>Masuk</Table.HeadCell>
              <Table.HeadCell className={NUM}>Jadwal Keluar</Table.HeadCell>
              <Table.HeadCell>Cabang</Table.HeadCell>
              <Table.HeadCell>Sudah Berlalu</Table.HeadCell>
              <Table.HeadCell>Foto</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={row.logId}>
                <Table.Cell>{formatWorkDate(row.workDate)}</Table.Cell>
                <Table.Cell>
                  <EmployeeLink id={row.userId} name={row.name} />
                </Table.Cell>
                <Table.Cell className={NUM}>{formatClock(row.checkInAt, timeZone)}</Table.Cell>
                <Table.Cell className={NUM}>{row.scheduledOut ? formatScheduleTime(row.scheduledOut) : '—'}</Table.Cell>
                <Table.Cell>
                  <span className="block max-w-40 truncate" title={row.branchName ?? undefined}>
                    {row.branchName ?? '—'}
                  </span>
                </Table.Cell>
                <Table.Cell className="text-muted">{formatDaysAgo(row.workDate, today)}</Table.Cell>
                <Table.Cell>{row.hasPhoto ? <SelfieLink logId={row.logId} kind="check-in" /> : <span className="text-muted">—</span>}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </>
  );
}
