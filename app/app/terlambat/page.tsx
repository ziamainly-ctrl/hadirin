import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ClockAlert, ListChecks, LogOut, Timer } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { listBranches } from '@/lib/queries/branches';
import {
  getEarlyLeaveTotals,
  getForgottenCheckoutTotals,
  getLateSummaryByEmployee,
  getLateTotals,
  listEarlyLeaveLogs,
  listForgottenCheckouts,
  listLateLogs,
} from '@/lib/queries/insights';
import { parsePeriod } from '@/lib/date-range';
import { LATE_CATEGORY_B_MAX_MIN } from '@/lib/insights-constants';
import { formatLongDate, formatPeriod, percent } from '@/lib/insights-format';
import { firstValue, hrefWith, lastPage, parseOneOf, parsePageNumber, parsePositiveInt, scopeFor } from '@/lib/insights-params';
import type { RawSearchParams } from '@/lib/insights-params';
import { formatMinutes } from '@/app/app/attendance/format';
import { todayInZone } from '@/app/m/format';
import ButtonLink from '@/components/ui/ButtonLink';
import Pagination from '@/components/ui/Pagination';
import StatTile from '@/components/shared/StatTile';
import EmptyState from '@/components/shared/EmptyState';
import LinkTabs from '@/components/shared/LinkTabs';
import Page from '@/components/shared/Page';
import PeriodFilters from '@/components/shared/PeriodFilters';
import { CATEGORY_LEGEND, EarlyLeaveView, ForgottenCheckoutView, LateDetailView, LateSummaryView } from './late-views';

export const metadata: Metadata = { title: 'Terlambat' };

const TABS = ['late', 'detail', 'early', 'forgot'] as const;
type Tab = (typeof TABS)[number];
// One server chunk; the client fit pager (components/shared/FitPager) splits it into screen-sized pages.
const PAGE_SIZE = 100;
const MAX_DAYS = 92;
const BASE_PATH = '/app/terlambat';

const DESCRIPTIONS: Record<Tab, string> = {
  late: 'Siapa yang sering terlambat dan seberapa lama, dihitung dari jam masuk shift.',
  detail: 'Setiap kejadian terlambat, terbaru lebih dulu, lengkap dengan jam masuk dan foto.',
  early: 'Karyawan yang check-out sebelum jam pulang shift.',
  forgot: 'Sudah masuk tetapi belum check-out pada hari yang sudah lewat. Minta karyawan mengajukan koreksi absensi agar jam keluar tercatat.',
};

interface TerlambatPageProps {
  searchParams: Promise<RawSearchParams>;
}

/**
 * Time-discipline review (PRD.md US-05 spirit, ERD.md section 3.2 late categories). Server
 * Component, OWNER/ADMIN org-wide and MANAGER limited to direct reports: reads lib/queries/insights
 * directly (TRD.md section 5). Four tabs share one period + branch filter (URL params, so a link is
 * shareable): per employee, every late log, early leaves and forgotten check-outs. All of it is
 * derived from attendance_logs, nothing is stored for this page.
 */
export default async function TerlambatPage({ searchParams }: TerlambatPageProps) {
  const { userId, orgId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const params = await searchParams;

  const branchId = parsePositiveInt(firstValue(params.branchId));
  const scope = scopeFor(role, userId, branchId);
  if (!scope) redirect('/m');

  const tab: Tab = parseOneOf(firstValue(params.tab), TABS, 'late');
  const page = parsePageNumber(firstValue(params.page));

  const org = await getOrganizationPlanContext(orgId);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const today = todayInZone(timeZone);
  const period = parsePeriod(
    { dateFrom: firstValue(params.dateFrom), dateTo: firstValue(params.dateTo) },
    { today, maxDays: MAX_DAYS, defaultFrom: (t) => `${t.slice(0, 7)}-01` },
  );
  const range = { from: period.from, to: period.to };
  const clock = { today, timeZone };

  // Totals for every tab (the tab badges) plus the data of the active tab, in one round of queries.
  const [branches, lateTotals, earlyTotals, forgotTotals] = await Promise.all([
    listBranches(orgId, { activeOnly: true }),
    getLateTotals(orgId, range, scope),
    getEarlyLeaveTotals(orgId, range, scope),
    getForgottenCheckoutTotals(orgId, range, scope, clock),
  ]);

  const total = tab === 'detail' ? lateTotals.lateCount : tab === 'early' ? earlyTotals.count : tab === 'forgot' ? forgotTotals.count : 0;
  const lastPageNumber = lastPage(total, PAGE_SIZE);

  const linkParams = {
    dateFrom: firstValue(params.dateFrom),
    dateTo: firstValue(params.dateTo),
    branchId: branchId !== undefined ? String(branchId) : undefined,
  };

  // A page past the end (a stale bookmark, or the data shrank under a filter) goes to the last page.
  if (page > lastPageNumber && tab !== 'late') {
    redirect(hrefWith(BASE_PATH, { ...linkParams, tab }, { page: lastPageNumber > 1 ? String(lastPageNumber) : undefined }));
  }

  const [summaryRows, detail, early, forgot] = await Promise.all([
    tab === 'late' ? getLateSummaryByEmployee(orgId, range, scope) : null,
    tab === 'detail' ? listLateLogs(orgId, range, scope, page, PAGE_SIZE) : null,
    tab === 'early' ? listEarlyLeaveLogs(orgId, range, scope, page, PAGE_SIZE) : null,
    tab === 'forgot' ? listForgottenCheckouts(orgId, range, scope, clock, page, PAGE_SIZE) : null,
  ]);

  const periodLabel = formatPeriod(period.from, period.to);
  const hasFilter = Boolean(linkParams.dateFrom || linkParams.dateTo || linkParams.branchId);
  const tabHref = (key: Tab) => hrefWith(BASE_PATH, linkParams, { tab: key === 'late' ? undefined : key });

  const attendanceHref = hrefWith('/app/attendance', {
    dateFrom: period.from,
    dateTo: period.to,
    branchId: linkParams.branchId,
    status: 'LATE',
  });

  const tiles =
    tab === 'early'
      ? [
          { label: 'Pulang Lebih Awal', value: earlyTotals.count, subLabel: 'kejadian' },
          { label: 'Karyawan', value: earlyTotals.employees, subLabel: 'pernah pulang lebih awal' },
          { label: 'Total Waktu', value: formatMinutes(earlyTotals.totalMinutes), subLabel: 'sebelum jam pulang' },
          { label: 'Rata-rata', value: formatMinutes(earlyTotals.avgMinutes), subLabel: 'per kejadian' },
        ]
      : tab === 'forgot'
        ? [
            { label: 'Belum Check-out', value: forgotTotals.count, subLabel: 'hari kerja yang sudah lewat' },
            { label: 'Karyawan', value: forgotTotals.employees, subLabel: 'terdampak' },
            {
              label: 'Tertua',
              value: forgotTotals.oldestDate ? formatLongDate(forgotTotals.oldestDate) : '—',
              subLabel: forgotTotals.oldestDate ? 'tanggal kerja' : 'tidak ada',
            },
          ]
        : [
            {
              label: 'Terlambat',
              value: lateTotals.lateCount,
              subLabel: `${percent(lateTotals.lateCount, lateTotals.attendedDays)}% dari ${lateTotals.attendedDays} hari hadir`,
            },
            { label: 'Karyawan', value: lateTotals.employees, subLabel: 'pernah terlambat' },
            {
              label: 'Total Keterlambatan',
              value: formatMinutes(lateTotals.totalLateMinutes),
              subLabel: `rata-rata ${formatMinutes(lateTotals.avgLateMinutes)}`,
            },
            { label: 'Kategori C', value: lateTotals.catC, subLabel: `lebih dari ${LATE_CATEGORY_B_MAX_MIN} menit` },
          ];

  const tabItems = [
    { key: 'late', label: 'Per Karyawan', href: tabHref('late'), count: lateTotals.employees },
    { key: 'detail', label: 'Rincian', href: tabHref('detail'), count: lateTotals.lateCount },
    { key: 'early', label: 'Pulang Awal', href: tabHref('early'), count: earlyTotals.count },
    { key: 'forgot', label: 'Lupa Check-out', href: tabHref('forgot'), count: forgotTotals.count },
  ];

  const activeEmpty = tab === 'late' ? (summaryRows?.length ?? 0) === 0 : total === 0;

  const emptyMessages: Record<Tab, { icon: typeof ClockAlert; message: string }> = {
    late: {
      icon: ClockAlert,
      message: `Tidak ada keterlambatan pada ${periodLabel}. ${hasFilter ? 'Ubah periode atau cabang di atas untuk melihat data lain.' : 'Data muncul saat karyawan check-in lewat jam masuk ditambah toleransi.'}`,
    },
    detail: {
      icon: ClockAlert,
      message: `Tidak ada kejadian terlambat pada ${periodLabel}. ${hasFilter ? 'Ubah periode atau cabang di atas untuk melihat data lain.' : ''}`.trim(),
    },
    early: {
      icon: LogOut,
      message: `Tidak ada karyawan yang pulang lebih awal pada ${periodLabel}. Karyawan yang check-out sebelum jam pulang shift akan muncul di sini.`,
    },
    forgot: {
      icon: Timer,
      message: `Tidak ada log yang belum di-check-out pada ${periodLabel}. Log yang tidak ditutup karyawan akan muncul di sini setelah hari kerjanya lewat.`,
    },
  };
  const empty = emptyMessages[tab];

  // Desktop: header, filters, tabs and tiles stay put; the table scrolls inside its own box with the
  // column head pinned (ui/TableFrame) and the pager pinned under it. Below lg the page just scrolls.
  return (
    <Page>
      <Page.Header
        title="Terlambat"
        description={DESCRIPTIONS[tab]}
        actions={
          tab === 'late' || tab === 'detail' ? (
            <ButtonLink href={attendanceHref} variant="outline">
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Lihat di Absensi
            </ButtonLink>
          ) : undefined
        }
      />

      <PeriodFilters
        today={today}
        from={period.from}
        to={period.to}
        preset={period.preset}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      />

      {period.clamped ? (
        <p role="status" className="shrink-0 text-sm text-muted">
          Periode dibatasi maksimal {MAX_DAYS} hari; yang ditampilkan {periodLabel}.
        </p>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <LinkTabs aria-label="Jenis data" items={tabItems} activeKey={tab} />
        {tab === 'late' || tab === 'detail' ? <p className="text-xs text-muted">Kategori: {CATEGORY_LEGEND}.</p> : null}
      </div>

      {/* The tiles repeat what the tab badges already count, so on a short desktop window (1024x600 is
          common) they give their 100px to the table instead. */}
      <div className={`grid shrink-0 grid-cols-2 gap-3 [@media(min-width:1024px)_and_(max-height:700px)]:hidden ${tiles.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} value={tile.value} subLabel={tile.subLabel} />
        ))}
      </div>

      <Page.Body>
        {activeEmpty ? (
          <EmptyState icon={empty.icon} message={empty.message} />
        ) : (
          <>
            {tab === 'late' && summaryRows ? <LateSummaryView rows={summaryRows} /> : null}
            {tab === 'detail' && detail ? <LateDetailView rows={detail.rows} timeZone={timeZone} /> : null}
            {tab === 'early' && early ? <EarlyLeaveView rows={early.rows} timeZone={timeZone} /> : null}
            {tab === 'forgot' && forgot ? <ForgottenCheckoutView rows={forgot.rows} timeZone={timeZone} today={today} /> : null}
            {tab !== 'late' ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                basePath={BASE_PATH}
                searchParams={{ ...linkParams, tab }}
                className="shrink-0"
              />
            ) : null}
          </>
        )}
      </Page.Body>
    </Page>
  );
}
