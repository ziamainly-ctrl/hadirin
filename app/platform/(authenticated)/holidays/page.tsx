import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import { listNationalHolidays } from '@/lib/queries/holidays';
import HolidayForm, { DeleteHolidayButton } from './holiday-form';

// Pure calendar date (no time component), same timeZone: 'UTC' convention as
// components/shared/RequestCard.tsx's DATE_FORMATTER, to avoid shifting to the
// previous/next day when formatted in a viewer's local zone.
// The weekday is shown too: whether a holiday lands on a weekday is what matters to the
// orgs that inherit it.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export const metadata: Metadata = { title: 'Hari Libur Nasional' };

// holidayDate is typed as a 'YYYY-MM-DD' string, but the driver currently hands a DATE
// column back as a JS Date at *server-local* midnight; formatted in UTC that showed every
// holiday one day early on a UTC+7 machine (17 Agustus listed as "Minggu, 16 Agustus").
// Rebuild the calendar day from whichever shape arrives, as UTC midnight, so the
// timeZone: 'UTC' formatter above always prints the stored day.
function toCalendarDay(value: string | Date): Date {
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const [y = 1970, m = 1, d = 1] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Year filter chip: h-9 (36px, 40px on a touch screen; was ~30px) and px-2.5 + gap-1.5 so "Semua" plus four years
// still fit on one row at 360px instead of orphaning the last year on a second line. The
// selected chip is filled (primary), the clearest "this filter is on" state in both themes.
function chipClasses(active: boolean): string {
  return `inline-flex h-9 items-center rounded-input border px-2.5 pointer-coarse:h-10 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
    active ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface text-muted hover:bg-accent hover:text-text'
  }`;
}

interface HolidaysPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function parseYear(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const year = Number.parseInt(raw, 10);
  return Number.isInteger(year) ? year : undefined;
}

/**
 * Server Component: calls listNationalHolidays() directly (TRD.md §5) — the same call
 * GET /api/platform/holidays makes, including its optional ?year= filter. National
 * holidays only (org_id IS NULL); a tenant's own company holidays have their own
 * separate page under /app, not part of this task (PRD.md P5).
 */
export default async function HolidaysPage({ searchParams }: HolidaysPageProps) {
  const year = parseYear((await searchParams).year);
  const holidays = await listNationalHolidays({ year });
  const thisYear = new Date().getFullYear();
  const yearOptions = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

  return (
    <Page>
      <Page.Header
        title="Hari Libur Nasional"
        description="Kelola tanggal libur nasional dan cuti bersama untuk semua organisasi."
        actions={<HolidayForm />}
      />

      {/* Year filter: fixed under the header; only the list below it scrolls. */}
      <Page.Toolbar>
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter tahun">
          <Link href="/platform/holidays" aria-current={year === undefined ? 'page' : undefined} className={chipClasses(year === undefined)}>
            Semua
          </Link>
          {yearOptions.map((y) => (
            <Link
              key={y}
              href={`/platform/holidays?year=${y}`}
              aria-current={year === y ? 'page' : undefined}
              className={chipClasses(year === y)}
            >
              {y}
            </Link>
          ))}
        </nav>
      </Page.Toolbar>

      <Page.Body>
        {holidays.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            message={
              year === undefined
                ? 'Belum ada hari libur nasional. Tambahkan lewat tombol Tambah Hari Libur.'
                : `Belum ada hari libur nasional di tahun ${year}.`
            }
          />
        ) : (
          <Table aria-label="Daftar hari libur nasional">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Tanggal</Table.HeadCell>
                <Table.HeadCell>Nama</Table.HeadCell>
                <Table.HeadCell>Jenis</Table.HeadCell>
                <Table.HeadCell className="text-right">Aksi</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {holidays.map((holiday) => (
                <Table.Row key={holiday.id}>
                  <Table.Cell>{DATE_FORMATTER.format(toCalendarDay(holiday.holidayDate))}</Table.Cell>
                  <Table.Cell className="font-medium">{holiday.name}</Table.Cell>
                  <Table.Cell>
                    {/* Filled vs outlined: the old bg-accent / bg-primary/10 pair were two
                        near-identical grey pills, so the two kinds didn't read apart. */}
                    {holiday.isCollectiveLeave ? (
                      <Badge className="border border-input text-muted">Cuti Bersama</Badge>
                    ) : (
                      <Badge className="bg-secondary text-secondary-fg">Libur Nasional</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <DeleteHolidayButton holidayId={holiday.id} holidayName={holiday.name} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Page.Body>
    </Page>
  );
}
