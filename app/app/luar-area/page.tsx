import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { MapPinOff, Settings2, Signal, Target } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { listBranches } from '@/lib/queries/branches';
import { getLocationAuditCounts, listLocationEvents, LOCATION_KINDS } from '@/lib/queries/insights';
import type { LocationKind } from '@/lib/queries/insights';
import { parsePeriod } from '@/lib/date-range';
import { NEAR_EDGE_RATIO, WEAK_ACCURACY_M } from '@/lib/insights-constants';
import { formatPeriod } from '@/lib/insights-format';
import { formatMeters } from '@/lib/geo-link';
import { firstValue, hrefWith, lastPage, parseOneOf, parsePageNumber, parsePositiveInt, scopeFor } from '@/lib/insights-params';
import type { RawSearchParams } from '@/lib/insights-params';
import { todayInZone } from '@/app/m/format';
import ButtonLink from '@/components/ui/ButtonLink';
import Pagination from '@/components/ui/Pagination';
import StatTile from '@/components/shared/StatTile';
import EmptyState from '@/components/shared/EmptyState';
import LinkTabs from '@/components/shared/LinkTabs';
import Page from '@/components/shared/Page';
import PeriodFilters from '@/components/shared/PeriodFilters';
import LocationView from './location-view';

export const metadata: Metadata = { title: 'Di Luar Area' };

// One server chunk; the client fit pager (components/shared/FitPager) splits it into screen-sized pages.
const PAGE_SIZE = 100;
const MAX_DAYS = 92;
const BASE_PATH = '/app/luar-area';
const EDGE_PERCENT = Math.round(NEAR_EDGE_RATIO * 100);

const GEOFENCE_LABELS = { STRICT: 'Ketat', FLAG: 'Longgar' } as const;

interface LuarAreaPageProps {
  searchParams: Promise<RawSearchParams>;
}

/**
 * Location audit (ERD.md section 3.2 geofence, PRD.md US-01). Server Component, OWNER/ADMIN
 * org-wide and MANAGER limited to direct reports. A strict-mode org rejects every check-in outside
 * the radius, so "Di Luar Area" alone would stay empty forever there; the page therefore also
 * audits two nearby signals that exist in every org: weak GPS (accuracy over 100 m) and check-ins
 * that landed close to the edge of the radius. Coordinates are shown as text plus a plain maps link;
 * no external map or script is loaded.
 */
export default async function LuarAreaPage({ searchParams }: LuarAreaPageProps) {
  const { userId, orgId, role } = await requireSession(['OWNER', 'ADMIN', 'MANAGER']);
  const params = await searchParams;

  const branchId = parsePositiveInt(firstValue(params.branchId));
  const scope = scopeFor(role, userId, branchId);
  if (!scope) redirect('/m');

  const tab: LocationKind = parseOneOf(firstValue(params.tab), LOCATION_KINDS, 'outside');
  const page = parsePageNumber(firstValue(params.page));

  const org = await getOrganizationPlanContext(orgId);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const today = todayInZone(timeZone);
  const period = parsePeriod(
    { dateFrom: firstValue(params.dateFrom), dateTo: firstValue(params.dateTo) },
    { today, maxDays: MAX_DAYS, defaultFrom: (t) => `${t.slice(0, 7)}-01` },
  );
  const range = { from: period.from, to: period.to };

  const [branches, counts] = await Promise.all([
    listBranches(orgId, { activeOnly: true }),
    getLocationAuditCounts(orgId, range, scope),
  ]);

  const total = tab === 'outside' ? counts.outside : tab === 'weak' ? counts.weak : counts.edge;
  const linkParams = {
    dateFrom: firstValue(params.dateFrom),
    dateTo: firstValue(params.dateTo),
    branchId: branchId !== undefined ? String(branchId) : undefined,
  };

  const lastPageNumber = lastPage(total, PAGE_SIZE);
  if (page > lastPageNumber) {
    redirect(hrefWith(BASE_PATH, { ...linkParams, tab: tab === 'outside' ? undefined : tab }, { page: lastPageNumber > 1 ? String(lastPageNumber) : undefined }));
  }

  const events = total > 0 ? await listLocationEvents(orgId, range, scope, tab, page, PAGE_SIZE) : { rows: [], total: 0 };

  const periodLabel = formatPeriod(period.from, period.to);
  const hasFilter = Boolean(linkParams.dateFrom || linkParams.dateTo || linkParams.branchId);
  const geofenceMode = org?.geofenceMode ?? 'STRICT';
  const isOrgWide = ORG_WIDE_ROLES.includes(role);
  const tabHref = (key: LocationKind) => hrefWith(BASE_PATH, linkParams, { tab: key === 'outside' ? undefined : key });

  const DESCRIPTIONS: Record<LocationKind, string> = {
    outside: 'Absen yang tercatat di luar radius cabang, lengkap dengan jarak, akurasi GPS, dan lokasi.',
    weak: `Absen dengan akurasi GPS lebih dari ${WEAK_ACCURACY_M} m: lokasinya kurang pasti, tinjau fotonya.`,
    edge: `Absen di dalam radius tetapi sudah ${EDGE_PERCENT}% radius atau lebih. Bila sering terjadi, pertimbangkan memperbesar radius.`,
  };

  const filteredHint = hasFilter ? ' Ubah periode atau cabang di atas untuk melihat data lain.' : '';
  const EMPTY: Record<LocationKind, { message: string; action?: ReactNode }> = {
    outside:
      geofenceMode === 'STRICT'
        ? {
            message: `Tidak ada absen di luar area pada ${periodLabel}. Mode geofence organisasi Anda Ketat, sehingga absen di luar radius ditolak dan tidak tercatat. Pilih mode Longgar bila ingin absen di luar radius tetap diterima dan ditandai di sini.${filteredHint}`,
            action: isOrgWide ? (
              <ButtonLink href="/app/settings/organization" variant="outline">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Atur Mode Geofence
              </ButtonLink>
            ) : undefined,
          }
        : { message: `Tidak ada absen di luar area pada ${periodLabel}. Semua absen tercatat di dalam radius cabang.${filteredHint}` },
    weak: {
      message: `Tidak ada absen dengan akurasi GPS lemah (lebih dari ${WEAK_ACCURACY_M} m) pada ${periodLabel}.${filteredHint}`,
    },
    edge: {
      message: `Tidak ada absen yang mendekati batas radius (${EDGE_PERCENT}% radius atau lebih) pada ${periodLabel}.${filteredHint}`,
    },
  };

  return (
    <Page>
      <Page.Header
        title="Di Luar Area"
        description={DESCRIPTIONS[tab]}
        actions={
          isOrgWide ? (
            <ButtonLink href="/app/branches" variant="outline">
              <Target className="h-4 w-4" aria-hidden="true" />
              Atur Cabang
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

      <LinkTabs
        aria-label="Jenis tinjauan lokasi"
        activeKey={tab}
        items={[
          { key: 'outside', label: 'Di Luar Area', href: tabHref('outside'), count: counts.outside },
          { key: 'weak', label: 'Akurasi GPS Lemah', href: tabHref('weak'), count: counts.weak },
          { key: 'edge', label: 'Mendekati Batas', href: tabHref('edge'), count: counts.edge },
        ]}
      />

      {/* On a short desktop window (1024x600 is common) the tiles give their 100px to the table. */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4 [@media(min-width:1024px)_and_(max-height:700px)]:hidden">
        <StatTile
          label="Di Luar Area"
          value={counts.outside}
          subLabel={
            counts.outside > 0
              ? `${counts.outsideEmployees} karyawan · rata-rata ${formatMeters(counts.avgOutsideM)}`
              : `dari ${counts.events} absen`
          }
        />
        <StatTile label="Terjauh" value={counts.outside > 0 ? formatMeters(counts.maxOutsideM) : '—'} subLabel="dari titik cabang" />
        <StatTile label="Akurasi GPS Lemah" value={counts.weak} subLabel={`lebih dari ${WEAK_ACCURACY_M} m`} />
        <StatTile
          label="Mode Geofence"
          value={GEOFENCE_LABELS[geofenceMode]}
          subLabel={geofenceMode === 'STRICT' ? 'di luar radius ditolak' : 'di luar radius ditandai'}
        />
      </div>

      <Page.Body>
        {total === 0 ? (
          <EmptyState
            icon={tab === 'weak' ? Signal : MapPinOff}
            message={EMPTY[tab].message}
            action={EMPTY[tab].action}
          />
        ) : (
          <>
            <LocationView rows={events.rows} timeZone={timeZone} />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath={BASE_PATH}
              searchParams={{ ...linkParams, tab: tab === 'outside' ? undefined : tab }}
              className="shrink-0"
            />
          </>
        )}
      </Page.Body>
    </Page>
  );
}
