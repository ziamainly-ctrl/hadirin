import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Flame, Trophy } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { listBranches } from '@/lib/queries/branches';
import { getLeaderboardSources } from '@/lib/queries/analytics';
import type { AttendanceScope } from '@/lib/queries/calendar';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { idParam } from '@/lib/validators/common';
import { todayInZone } from '@/app/m/format';
import ButtonLink from '@/components/ui/ButtonLink';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import { formatMonthLabel, monthOf, monthStart, parseMonthParam } from '@/lib/insights/calendar-grid';
import { podium, rankEmployees } from '@/lib/insights/leaderboard';
import type { LeaderboardEntry } from '@/lib/insights/leaderboard';
import ReportFilters from '../reports/filters';
import RankBadge from './rank-badge';

export const metadata: Metadata = { title: 'Peringkat' };

interface LeaderboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const NUM = 'text-right tabular-nums';

function OnTimeBar({ pct }: { pct: number | null }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/20" aria-hidden="true">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct ?? 0}%` }} />
      </span>
      <span className="w-10 text-right font-semibold tabular-nums text-text">{pct === null ? '—' : `${pct}%`}</span>
    </span>
  );
}

function Streak({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Flame className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      {value} hari
    </span>
  );
}

/**
 * Discipline leaderboard for one month (OWNER, ADMIN: all tracked employees; MANAGER: direct
 * reports). Everything is derived from attendance_logs.status; lib/insights/leaderboard.ts holds
 * the maths and its tests. Only days with a final result count (on time, late, absent): approved
 * leave, sick, permit and holidays are not in the denominator and do not break a streak.
 */
export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  // An EMPLOYEE has no admin shell (the layout already sends them to /m); this keeps the page safe on its own.
  const { orgId, userId, role } = await requireSession();
  if (role === 'EMPLOYEE') redirect('/m');
  const params = await searchParams;
  const isOrgWide = ORG_WIDE_ROLES.includes(role);

  const org = await getOrganizationPlanContext(orgId);
  const currentMonth = monthOf(todayInZone(org?.timezone ?? 'Asia/Jakarta'));
  const month = parseMonthParam(firstValue(params.month), currentMonth);

  const branchRaw = firstValue(params.branchId);
  const branchParsed = branchRaw ? idParam.safeParse(branchRaw) : undefined;
  const branchId = branchParsed?.success ? branchParsed.data : undefined;
  const scope: AttendanceScope = isOrgWide ? { branchId } : { managerId: userId, branchId };

  const [sources, branches] = await Promise.all([
    getLeaderboardSources(orgId, monthStart(month), scope),
    listBranches(orgId, { activeOnly: true }),
  ]);
  const board = rankEmployees(sources);
  const top = podium(board);
  const monthLabel = formatMonthLabel(month);

  return (
    <Page>
      <Page.Header
        title="Peringkat"
        description={
          isOrgWide
            ? 'Siapa yang paling tepat waktu bulan ini. Dihitung dari hari kerja dengan hasil final.'
            : 'Ketepatan waktu tim Anda bulan ini. Dihitung dari hari kerja dengan hasil final.'
        }
      />

      <ReportFilters
        month={month}
        currentMonth={currentMonth}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        branchId={branchId !== undefined ? String(branchId) : undefined}
      />

      <Page.Body>
        {sources.length === 0 ? (
          <EmptyState
            icon={Trophy}
            message={
              isOrgWide
                ? 'Belum ada karyawan yang dijadwalkan. Tetapkan shift ke karyawan agar kehadirannya terhitung di peringkat.'
                : 'Belum ada anggota tim yang dijadwalkan. Peringkat muncul setelah admin menetapkan shift untuk tim Anda.'
            }
            action={
              isOrgWide ? (
                <ButtonLink href="/app/employees" variant="outline">
                  Buka Karyawan
                </ButtonLink>
              ) : undefined
            }
          />
        ) : board.ranked.length === 0 ? (
          <EmptyState
            icon={Trophy}
            message={`Belum ada kehadiran yang bisa dihitung untuk ${monthLabel}. Peringkat muncul setelah karyawan punya hari kerja dengan hasil final.`}
          />
        ) : (
          <>
            <ol className="hidden shrink-0 grid-cols-3 gap-3 sm:grid" aria-label={`Tiga teratas ${monthLabel}`}>
              {top.map((entry) => (
                <li key={entry.userId} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
                  <RankBadge rank={entry.rank ?? 0} large />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text" title={entry.name}>
                      {entry.name}
                    </p>
                    <p className="truncate text-xs text-muted">{entry.branchName ?? 'Tanpa cabang'}</p>
                  </div>
                  <p className="text-right">
                    <span className="block text-xl font-bold leading-none tabular-nums text-text">{entry.onTimePct}%</span>
                    <span className="mt-1 block text-[11px] text-muted">tepat waktu</span>
                  </p>
                </li>
              ))}
            </ol>

            <section className="flex min-h-0 flex-col gap-3 lg:flex-1" aria-labelledby="leaderboard-heading">
              <div className="flex flex-col gap-0.5 lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-4">
                <h2 id="leaderboard-heading" className="text-base font-semibold text-text">
                  Peringkat {monthLabel}
                </h2>
                <p className="text-xs text-muted">
                  Cuti, sakit, izin, dan hari libur tidak dihitung dan tidak memutus streak.
                </p>
              </div>

              <RankList rows={board.ranked} />
              <div className="hidden min-h-0 flex-col sm:flex">
                <Table aria-label={`Peringkat ketepatan waktu ${monthLabel}`}>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeadCell className="w-16">#</Table.HeadCell>
                      <Table.HeadCell>Karyawan</Table.HeadCell>
                      <Table.HeadCell className={NUM}>Tepat Waktu</Table.HeadCell>
                      <Table.HeadCell priority={3} className={NUM}>Hari Tepat Waktu</Table.HeadCell>
                      <Table.HeadCell className={NUM}>Terlambat</Table.HeadCell>
                      <Table.HeadCell priority={2} className={NUM}>Tidak Hadir</Table.HeadCell>
                      <Table.HeadCell priority={1} className={NUM}>Streak</Table.HeadCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {board.ranked.map((entry) => (
                      <Table.Row key={entry.userId}>
                        <Table.Cell>
                          <RankBadge rank={entry.rank ?? 0} />
                        </Table.Cell>
                        <Table.Cell>
                          <span className="block max-w-56 truncate font-medium" title={entry.name}>
                            {entry.name}
                          </span>
                          <span className="block max-w-56 truncate text-xs text-muted">{entry.branchName ?? 'Tanpa cabang'}</span>
                        </Table.Cell>
                        <Table.Cell className={NUM}>
                          <OnTimeBar pct={entry.onTimePct} />
                        </Table.Cell>
                        <Table.Cell className={NUM}>
                          {entry.present} <span className="text-muted">dari {entry.obligated}</span>
                        </Table.Cell>
                        <Table.Cell className={NUM}>
                          <span className={entry.late === 0 ? 'text-muted' : undefined}>{entry.late}</span>
                        </Table.Cell>
                        <Table.Cell className={NUM}>
                          <span className={entry.absent === 0 ? 'text-muted' : undefined}>{entry.absent}</span>
                        </Table.Cell>
                        <Table.Cell className={NUM}>
                          <Streak value={entry.streak} />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>

              {board.unranked.length > 0 ? (
                <p className="shrink-0 text-xs text-muted">
                  Belum cukup data ({board.minDays} hari kerja dengan hasil final dibutuhkan):{' '}
                  {board.unranked.map((e) => e.name).join(', ')}.
                </p>
              ) : null}
            </section>
          </>
        )}
      </Page.Body>
    </Page>
  );
}

// Phones: seven columns do not fit 360px, so each person is a small card (rank, name, share, counts).
function RankList({ rows }: { rows: LeaderboardEntry[] }) {
  return (
    <ul className="divide-y divide-border rounded-card border border-border bg-surface sm:hidden" aria-label="Peringkat ketepatan waktu">
      {rows.map((entry) => (
        <li key={entry.userId} className="flex flex-col gap-2 px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <RankBadge rank={entry.rank ?? 0} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words font-medium text-text">{entry.name}</p>
              <p className="truncate text-xs text-muted">{entry.branchName ?? 'Tanpa cabang'}</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-text">{entry.onTimePct}%</p>
          </div>
          <dl className="grid grid-cols-4 gap-x-2 whitespace-nowrap tabular-nums">
            <div>
              <dt className="text-xs text-muted">Tepat waktu</dt>
              <dd className="text-text">
                {entry.present}/{entry.obligated}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Terlambat</dt>
              <dd className={entry.late === 0 ? 'text-muted' : 'text-text'}>{entry.late}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tidak hadir</dt>
              <dd className={entry.absent === 0 ? 'text-muted' : 'text-text'}>{entry.absent}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Streak</dt>
              <dd className="text-text">
                <Streak value={entry.streak} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
