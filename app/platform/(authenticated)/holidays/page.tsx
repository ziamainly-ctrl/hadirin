import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/shared/EmptyState';
import { listNationalHolidays } from '@/lib/queries/holidays';
import HolidayForm, { DeleteHolidayButton } from './holiday-form';

// Pure calendar date (no time component), same timeZone: 'UTC' convention as
// components/shared/RequestCard.tsx's DATE_FORMATTER, to avoid shifting to the
// previous/next day when formatted in a viewer's local zone.
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text">Hari Libur Nasional</h1>
        <p className="text-sm text-muted">Kelola tanggal libur nasional dan cuti bersama untuk semua organisasi.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="flex flex-col gap-3">
          <nav className="flex flex-wrap gap-2" aria-label="Filter tahun">
            <Link
              href="/platform/holidays"
              aria-current={year === undefined ? 'page' : undefined}
              className={`rounded-input border px-3 py-1.5 text-sm font-medium transition-colors ${
                year === undefined
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-black/10 dark:border-white/10 text-muted hover:text-text'
              }`}
            >
              Semua
            </Link>
            {yearOptions.map((y) => (
              <Link
                key={y}
                href={`/platform/holidays?year=${y}`}
                aria-current={year === y ? 'page' : undefined}
                className={`rounded-input border px-3 py-1.5 text-sm font-medium transition-colors ${
                  year === y ? 'border-primary bg-primary/10 text-primary' : 'border-black/10 dark:border-white/10 text-muted hover:text-text'
                }`}
              >
                {y}
              </Link>
            ))}
          </nav>

          {holidays.length === 0 ? (
            <EmptyState icon={CalendarDays} message="Belum ada hari libur nasional untuk filter ini." />
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.HeadCell>Tanggal</Table.HeadCell>
                  <Table.HeadCell>Nama</Table.HeadCell>
                  <Table.HeadCell>Cuti Bersama</Table.HeadCell>
                  <Table.HeadCell className="text-right">Aksi</Table.HeadCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {holidays.map((holiday) => (
                  <Table.Row key={holiday.id}>
                    <Table.Cell className="text-text">{DATE_FORMATTER.format(new Date(holiday.holidayDate))}</Table.Cell>
                    <Table.Cell className="font-medium text-text">{holiday.name}</Table.Cell>
                    <Table.Cell className="text-muted">{holiday.isCollectiveLeave ? 'Ya' : 'Tidak'}</Table.Cell>
                    <Table.Cell className="text-right">
                      <DeleteHolidayButton holidayId={holiday.id} holidayName={holiday.name} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </section>

        <aside>
          <HolidayForm />
        </aside>
      </div>
    </div>
  );
}
