import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CalendarClock, ChartNoAxesCombined, Clock, TrendingUp } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { listBranches } from '@/lib/queries/branches';
import { getCheckInHourCounts, getWeekdayCounts } from '@/lib/queries/analytics';
import { getDailyStatusCounts } from '@/lib/queries/calendar';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { idParam } from '@/lib/validators/common';
import { addDaysToDateString } from '@/lib/tz';
import { todayInZone } from '@/app/m/format';
import Card from '@/components/ui/Card';
import BarChart from '@/components/shared/charts/BarChart';
import TrendChart from '@/components/shared/charts/TrendChart';
import DonutChart from '@/components/shared/DonutChart';
import EmptyState from '@/components/shared/EmptyState';
import LinkTabs from '@/components/shared/LinkTabs';
import Page from '@/components/shared/Page';
import StatTile from '@/components/shared/StatTile';
import { WEEKDAY_LONG, formatShortDate } from '@/lib/insights/calendar-grid';
import {
  attendanceRateSeries,
  comparePeriods,
  formatHour,
  hourHistogram,
  statusMix,
  summarizeTrend,
  weekdaySummary,
} from '@/lib/insights/statistics';
import StatistikBranchFilter from './branch-filter';
import { PERIOD_OPTIONS, parseDays, statistikHref } from './statistik-url';

export const metadata: Metadata = { title: 'Statistik' };

interface StatistikPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const NUMBER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const INTEGER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

function pct(value: number | null): string {
  return value === null ? '—' : `${NUMBER.format(value)}%`;
}

/** "+1,2 poin" / "-0,8 poin" / "0 poin" for a change in percentage points. */
function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  return `${sign}${NUMBER.format(Math.abs(delta))} poin`;
}

type TrendDirection = 'up' | 'down' | 'neutral';

/** Colour of a change: green when it is good news, red when it is bad (for lateness, a rise is bad). */
function directionOf(delta: number, upIsGood: boolean): TrendDirection {
  if (delta === 0) return 'neutral';
  return delta > 0 === upIsGood ? 'up' : 'down';
}

/**
 * Trends for the last 7, 30 or 90 days (OWNER, ADMIN). Three small queries (per-day status counts,
 * check-ins per local hour, per-weekday totals); every ratio comes from lib/insights/statistics.ts.
 * The charts are hand-rolled SVG (components/shared/charts), the donut is the dashboard's own.
 * Today is included but flagged as unfinished, and days with nothing expected (weekends, holidays)
 * are left out of the trend instead of drawn as 0%.
 */
export default async function StatistikPage({ searchParams }: StatistikPageProps) {
  // OWNER and ADMIN only. Any other role (a MANAGER who typed the URL) goes to the dashboard instead of
  // an error page; nothing below runs before this check.
  const { orgId, role } = await requireSession();
  if (!ORG_WIDE_ROLES.includes(role)) redirect('/app');
  const params = await searchParams;

  const org = await getOrganizationPlanContext(orgId);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const today = todayInZone(timeZone);
  const days = parseDays(firstValue(params.days));
  const from = addDaysToDateString(today, -(days - 1));

  const branchRaw = firstValue(params.branchId);
  const branchParsed = branchRaw ? idParam.safeParse(branchRaw) : undefined;
  const branchId = branchParsed?.success ? branchParsed.data : undefined;
  const scope = { branchId };

  // The period before this one, same length, for the "vs" figure on the first two tiles.
  const previousFrom = addDaysToDateString(from, -days);
  const previousTo = addDaysToDateString(from, -1);

  const [counts, previousCounts, hourRows, weekdayRows, branches] = await Promise.all([
    getDailyStatusCounts(orgId, from, today, scope),
    getDailyStatusCounts(orgId, previousFrom, previousTo, scope),
    getCheckInHourCounts(orgId, from, today, timeZone, scope),
    getWeekdayCounts(orgId, from, today, scope),
    listBranches(orgId, { activeOnly: true }),
  ]);

  const series = attendanceRateSeries(counts, today);
  const mix = statusMix(counts);
  const summary = summarizeTrend(series, mix);
  const comparison = comparePeriods(summary, summarizeTrend([], statusMix(previousCounts)));
  const histogram = hourHistogram(hourRows);
  const weekdays = weekdaySummary(weekdayRows);
  const hasData = mix.total > 0 || histogram.total > 0;
  const periodLabel = `${days} hari terakhir`;

  return (
    <Page>
      <Page.Header
        title="Statistik"
        description={`Tren kehadiran ${periodLabel}: tingkat kehadiran, jam check-in, dan hari tersibuk.`}
      />

      <Page.Toolbar className="items-end gap-x-4 gap-y-3">
        {/* A wrapper aligns the tabs with the bottom of the branch select (LinkTabs sets self-start itself). */}
        <div className="flex self-end">
          <LinkTabs
            aria-label="Periode"
            activeKey={String(days)}
            items={PERIOD_OPTIONS.map((option) => ({
              key: String(option),
              label: `${option} hari`,
              href: statistikHref({ days: option, branchId }),
            }))}
            className="mb-0.5"
          />
        </div>
        {branches.length > 0 ? (
          <StatistikBranchFilter
            days={days}
            branches={branches.map((b) => ({ id: b.id, name: b.name }))}
            branchId={branchId !== undefined ? String(branchId) : undefined}
          />
        ) : null}
      </Page.Toolbar>

      <Page.Body>
        {!hasData ? (
          <EmptyState
            icon={ChartNoAxesCombined}
            message={`Belum ada data kehadiran dalam ${periodLabel}${branchId !== undefined ? ' untuk cabang ini' : ''}. Statistik muncul setelah karyawan check-in.`}
          />
        ) : (
          <>
            <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Tingkat Kehadiran"
                value={pct(summary.overallRate)}
                subLabel={comparison.rateDelta === null ? 'hari kerja yang hadir' : `vs ${days} hari sebelumnya`}
                trend={
                  comparison.rateDelta === null
                    ? undefined
                    : { value: formatDelta(comparison.rateDelta), direction: directionOf(comparison.rateDelta, true) }
                }
                icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
              />
              <StatTile
                label="Porsi Terlambat"
                value={pct(summary.lateShare)}
                subLabel={comparison.lateShareDelta === null ? 'dari hari hadir' : `vs ${days} hari sebelumnya`}
                trend={
                  comparison.lateShareDelta === null
                    ? undefined
                    : { value: formatDelta(comparison.lateShareDelta), direction: directionOf(comparison.lateShareDelta, false) }
                }
                icon={<Clock className="h-5 w-5" aria-hidden="true" />}
              />
              <StatTile
                label="Jam Tersibuk"
                value={histogram.peakHour === null ? '—' : `${formatHour(histogram.peakHour)}`}
                subLabel={histogram.peakHour === null ? undefined : `${INTEGER.format(histogram.peakCount)} check-in dalam sejam`}
                icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
              />
              <StatTile
                label="Hari Tersibuk"
                value={weekdays.busiest ? WEEKDAY_LONG[weekdays.busiest.dow - 1]! : '—'}
                subLabel={weekdays.busiest ? `rata-rata ${NUMBER.format(weekdays.busiest.avgAttended)} check-in` : undefined}
                icon={<ChartNoAxesCombined className="h-5 w-5" aria-hidden="true" />}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[repeat(2,minmax(8.5rem,1fr))] xl:grid-cols-3">
              <Card className="flex min-h-0 flex-col xl:col-span-2">
                <Card.Header className="shrink-0">
                  <h2 className="text-sm font-semibold text-text">Kehadiran per hari kerja</h2>
                  <span className="hidden text-xs text-muted sm:inline">{periodLabel}</span>
                </Card.Header>
                <Card.Body className="min-h-0 flex-1">
                  {series.length >= 2 ? (
                    <TrendChart
                      className="h-48 lg:h-full"
                      points={series.map((p) => ({
                        id: p.date,
                        label: formatShortDate(p.date),
                        value: p.rate,
                        detail: `${p.attended} dari ${p.obligated} karyawan hadir`,
                        partial: p.partial,
                      }))}
                      seriesLabel="Tingkat kehadiran"
                      valueFormat="percent"
                      ariaLabel={`Tingkat kehadiran per hari kerja, ${periodLabel}`}
                    />
                  ) : (
                    <p className="flex h-full min-h-24 items-center text-sm text-muted">
                      Tren tampil setelah ada minimal dua hari kerja dengan data. Hari ini{series.length === 1 ? ' sudah tercatat' : ' belum tercatat'}.
                    </p>
                  )}
                </Card.Body>
              </Card>

              <Card className="flex min-h-0 flex-col">
                <Card.Header className="shrink-0">
                  <h2 className="text-sm font-semibold text-text">Komposisi status</h2>
                </Card.Header>
                <Card.Body className="flex min-h-0 flex-1 items-center">
                  <DonutChart
                    size={112}
                    className="w-full"
                    centerValue={INTEGER.format(mix.present + mix.late)}
                    centerLabel="Hari Hadir"
                    segments={[
                      { label: 'Tepat Waktu', value: mix.present, color: 'var(--color-status-present)' },
                      { label: 'Terlambat', value: mix.late, color: 'var(--color-status-late)' },
                      { label: 'Tidak Hadir', value: mix.absent, color: 'var(--color-status-absent)' },
                      { label: 'Cuti/Sakit/Izin', value: mix.away, color: 'var(--color-status-leave)' },
                    ]}
                  />
                </Card.Body>
              </Card>

              <Card className="flex min-h-0 flex-col xl:col-span-2">
                <Card.Header className="shrink-0">
                  <h2 className="shrink-0 whitespace-nowrap text-sm font-semibold text-text">Jam check-in</h2>
                  <span className="hidden text-xs text-muted sm:inline">per jam, waktu setempat</span>
                </Card.Header>
                <Card.Body className="min-h-0 flex-1">
                  {histogram.buckets.length > 0 ? (
                    <BarChart
                      className="h-48 lg:h-full"
                      bars={histogram.buckets.map((b) => ({
                        id: `h${b.hour}`,
                        label: String(b.hour).padStart(2, '0'),
                        title: `${formatHour(b.hour)} - ${String(b.hour).padStart(2, '0')}.59`,
                        value: b.count,
                        detail: `${NUMBER.format(Math.round((b.count / histogram.total) * 1000) / 10)}% dari semua check-in`,
                        highlight: b.hour === histogram.peakHour,
                      }))}
                      unitLabel="Check-in"
                      valueFormat="integer"
                      ariaLabel={`Jumlah check-in per jam, ${periodLabel}`}
                    />
                  ) : (
                    <p className="text-sm text-muted">Belum ada check-in dengan jam tercatat.</p>
                  )}
                </Card.Body>
              </Card>

              <Card className="flex min-h-0 flex-col">
                <Card.Header className="shrink-0">
                  <h2 className="shrink-0 whitespace-nowrap text-sm font-semibold text-text">Hari tersibuk</h2>
                  <span className="hidden text-xs text-muted sm:inline">rata-rata per hari</span>
                </Card.Header>
                <Card.Body className="min-h-0 flex-1">
                  <BarChart
                    className="h-48 lg:h-full"
                    bars={weekdays.stats.map((s) => ({
                      id: `d${s.dow}`,
                      label: s.label,
                      title: WEEKDAY_LONG[s.dow - 1]!,
                      value: s.avgAttended,
                      detail:
                        s.days > 0
                          ? `${s.days} hari tercatat${s.lateRate !== null ? `, ${NUMBER.format(s.lateRate)}% terlambat` : ''}`
                          : 'Tidak ada data',
                      highlight: weekdays.busiest?.dow === s.dow,
                    }))}
                    unitLabel="Rata-rata check-in"
                    valueFormat="decimal"
                    ariaLabel={`Rata-rata check-in per hari dalam seminggu, ${periodLabel}`}
                  />
                </Card.Body>
              </Card>
            </div>
          </>
        )}
      </Page.Body>
    </Page>
  );
}
