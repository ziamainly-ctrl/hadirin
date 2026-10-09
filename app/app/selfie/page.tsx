import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Images, Settings2 } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { listBranches } from '@/lib/queries/branches';
import { getSelfieSummary, listSelfies, SELFIE_FLAGS, SELFIE_PUNCHES } from '@/lib/queries/insights';
import { parsePeriod } from '@/lib/date-range';
import { formatDayShort, formatPeriod } from '@/lib/insights-format';
import { formatAccuracy, formatMeters, mapsUrl } from '@/lib/geo-link';
import { firstValue, hrefWith, lastPage, parseOneOf, parsePageNumber, parsePositiveInt, scopeFor } from '@/lib/insights-params';
import type { RawSearchParams } from '@/lib/insights-params';
import { formatMinutes } from '@/app/app/attendance/format';
import { formatClock, todayInZone } from '@/app/m/format';
import ButtonLink from '@/components/ui/ButtonLink';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import PeriodFilters from '@/components/shared/PeriodFilters';
import SelfieFilters, { SELFIE_FILTER_KEYS } from './selfie-filters';
import SelfieGallery from './selfie-gallery';
import type { SelfieCardData } from './selfie-gallery';

export const metadata: Metadata = { title: 'Galeri Selfie' };

// One server chunk; the client fit pager (components/shared/FitPager) splits it into screen-sized pages.
const PAGE_SIZE = 48;
// Seven days at most: a photo is personal data, so the page shows a short window by default (today)
// and never a whole quarter at once.
const MAX_DAYS = 7;
const BASE_PATH = '/app/selfie';

interface SelfiePageProps {
  searchParams: Promise<RawSearchParams>;
}

/**
 * Selfie review gallery. Server Component, OWNER/ADMIN org-wide and MANAGER limited to direct
 * reports (the same people the files route lets them open). The query returns no Blob URL, only
 * (logId, punch): every image is requested through /api/files/attendance-logs/{id}/{kind}, which
 * re-checks role and tenant on each request. Window capped at 7 days, 24 photos per page, images
 * lazy-loaded, and the page is never cached (no Redis, no static export).
 */
export default async function SelfiePage({ searchParams }: SelfiePageProps) {
  const { userId, orgId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const params = await searchParams;

  const branchId = parsePositiveInt(firstValue(params.branchId));
  const scope = scopeFor(role, userId, branchId);
  if (!scope) redirect('/m');

  const punch = parseOneOf(firstValue(params.punch), SELFIE_PUNCHES, 'all');
  const flag = parseOneOf(firstValue(params.flag), SELFIE_FLAGS, 'all');
  const page = parsePageNumber(firstValue(params.page));

  const org = await getOrganizationPlanContext(orgId);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const today = todayInZone(timeZone);
  const period = parsePeriod(
    { dateFrom: firstValue(params.dateFrom), dateTo: firstValue(params.dateTo) },
    { today, maxDays: MAX_DAYS, defaultFrom: (t) => t },
  );
  const range = { from: period.from, to: period.to };
  const filter = { punch, flag };

  const [branches, summary] = await Promise.all([
    listBranches(orgId, { activeOnly: true }),
    getSelfieSummary(orgId, range, scope, filter),
  ]);

  const linkParams = {
    dateFrom: firstValue(params.dateFrom),
    dateTo: firstValue(params.dateTo),
    branchId: branchId !== undefined ? String(branchId) : undefined,
    punch: punch === 'all' ? undefined : punch,
    flag: flag === 'all' ? undefined : flag,
  };

  const lastPageNumber = lastPage(summary.photos, PAGE_SIZE);
  if (page > lastPageNumber) {
    redirect(hrefWith(BASE_PATH, linkParams, { page: lastPageNumber > 1 ? String(lastPageNumber) : undefined }));
  }

  const list = summary.photos > 0 ? await listSelfies(orgId, range, scope, filter, page, PAGE_SIZE) : { rows: [], total: 0 };

  const items: SelfieCardData[] = list.rows.map((row) => {
    const kind = row.kind === 'IN' ? 'check-in' : 'check-out';
    return {
      key: `${row.logId}-${row.kind}`,
      logId: row.logId,
      userId: row.userId,
      name: row.name,
      kind,
      src: `/api/files/attendance-logs/${row.logId}/${kind}`,
      workDate: row.workDate,
      dateLabel: formatDayShort(row.workDate),
      timeLabel: formatClock(row.at, timeZone),
      branchName: row.branchName,
      status: row.status,
      lateMinutes: row.lateMinutes,
      earlyLeaveMinutes: row.earlyLeaveMinutes,
      lateLabel: row.lateMinutes > 0 ? formatMinutes(row.lateMinutes) : null,
      earlyLeaveLabel: row.earlyLeaveMinutes > 0 ? `Pulang awal ${formatMinutes(row.earlyLeaveMinutes)}` : null,
      isOutside: row.isOutside,
      distanceLabel: row.distanceM !== null ? formatMeters(row.distanceM) : null,
      accuracyLabel: row.accuracyM !== null ? formatAccuracy(row.accuracyM) : null,
      mapHref: mapsUrl(row.lat, row.lng),
      note: row.note,
      attendanceHref: hrefWith('/app/attendance', { dateFrom: row.workDate, dateTo: row.workDate }),
    };
  });

  const periodLabel = formatPeriod(period.from, period.to);
  const hasFilter = Boolean(linkParams.dateFrom || linkParams.dateTo || linkParams.branchId || linkParams.punch || linkParams.flag);
  const isOrgWide = ORG_WIDE_ROLES.includes(role);
  const selfieRequired = org?.selfieRequired ?? true;

  const emptyMessage = hasFilter
    ? `Tidak ada foto yang cocok pada ${periodLabel}. Ubah periode atau filter di atas, atau hapus filter.`
    : selfieRequired
      ? `Belum ada foto pada ${periodLabel}. Foto muncul setelah karyawan check-in atau check-out dengan selfie.`
      : `Belum ada foto pada ${periodLabel}. Selfie belum diwajibkan di organisasi Anda, jadi absen tidak disertai foto.`;

  return (
    <Page>
      <Page.Header
        title="Galeri Selfie"
        description="Foto check-in dan check-out karyawan untuk ditinjau. Foto bersifat pribadi: hanya pemilik, admin, dan atasan langsung yang dapat melihatnya."
        actions={
          isOrgWide && !selfieRequired ? (
            <ButtonLink href="/app/settings/organization" variant="outline">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Wajibkan Selfie
            </ButtonLink>
          ) : undefined
        }
      />

      <PeriodFilters
        today={today}
        from={period.from}
        to={period.to}
        preset={period.preset}
        presets={['today', '7d']}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        extraKeys={SELFIE_FILTER_KEYS}
      >
        <SelfieFilters />
      </PeriodFilters>

      {period.clamped ? (
        <p role="status" className="shrink-0 text-sm text-muted">
          Galeri dibatasi maksimal {MAX_DAYS} hari; yang ditampilkan {periodLabel}.
        </p>
      ) : null}

      {summary.photos > 0 ? (
        <p className="shrink-0 text-sm text-muted" aria-live="polite">
          <span className="font-medium tabular-nums text-text">{summary.photos}</span> foto dari{' '}
          <span className="font-medium tabular-nums text-text">{summary.employees}</span> karyawan pada {periodLabel}
          {summary.late > 0 ? <> · {summary.late} terlambat</> : null}
          {summary.outside > 0 ? <> · {summary.outside} di luar area</> : null}
        </p>
      ) : null}

      <Page.Body>
        {summary.photos === 0 ? (
          <EmptyState icon={Images} message={emptyMessage} />
        ) : (
          <>
            {/* key: a new page or filter remounts the gallery, so an open-photo index never points at a different photo. */}
            <SelfieGallery
              key={`${page}|${period.from}|${period.to}|${branchId ?? ''}|${punch}|${flag}`}
              items={items}
              serverPager={{ page, pageSize: PAGE_SIZE, total: summary.photos, basePath: BASE_PATH, searchParams: linkParams }}
            />
            {/* Desktop pages through the gallery's own footer (FitPager serverPager); this plain pager
                is for a phone, where the whole chunk is on one scrolling page. */}
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={summary.photos}
              basePath={BASE_PATH}
              searchParams={linkParams}
              className="fit-hide-desktop shrink-0"
            />
          </>
        )}
      </Page.Body>
    </Page>
  );
}
