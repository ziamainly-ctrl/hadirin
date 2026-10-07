// Monthly recap XLSX export (TRD.md §13). Uses the SheetJS CDN build of `xlsx` (TRD.md §3 —
// never the npm registry copy), imported the same way as any other package.
import * as XLSX from 'xlsx';
import type { MonthlyRecapRow, DailyAttendanceDetailRow } from '../queries/reports';

// Re-exported so callers (and lib/export/pdf.ts) can get these from either this module or
// lib/queries/reports.ts, which remains the canonical source of the row shapes.
export type { MonthlyRecapRow, DailyAttendanceDetailRow };

/**
 * Column order + Indonesian labels for the "Rekap" sheet. Exported so `lib/export/pdf.ts`
 * can build the exact same header row (TRD.md §13: "the same recap table") without the two
 * ever drifting apart.
 */
export const MONTHLY_RECAP_HEADERS = [
  'Kode Karyawan',
  'Nama',
  'Cabang',
  'Hadir',
  'Terlambat',
  'Total Menit Terlambat',
  'Tidak Hadir',
  'Cuti',
  'Sakit',
  'Izin',
  'Libur',
  'Total Jam Kerja',
] as const;

const MONTHLY_DETAIL_HEADERS = [
  'Nama',
  'Tanggal',
  'Status',
  'Jam Masuk',
  'Jam Keluar',
  'Menit Terlambat',
  'Menit Kerja',
] as const;

/**
 * Ordered display values for one recap row, matching `MONTHLY_RECAP_HEADERS` 1:1. Exported
 * so `lib/export/pdf.ts` reuses it for the PDF table body instead of re-deriving it.
 */
export function monthlyRecapDisplayRow(r: MonthlyRecapRow): (string | number)[] {
  return [
    r.employeeCode ?? '',
    r.name,
    r.branchName ?? '',
    r.presentCount,
    r.lateCount,
    r.totalLateMinutes,
    r.absentCount,
    r.leaveCount,
    r.sickCount,
    r.permitCount,
    r.holidayCount,
    Number((r.totalWorkMinutes / 60).toFixed(1)),
  ];
}

/** HH:MM in the org's display timezone; empty string for a log with no timestamp yet. */
function formatTimeJakarta(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function monthlyDetailDisplayRow(d: DailyAttendanceDetailRow): (string | number)[] {
  return [
    d.name,
    d.workDate,
    d.status,
    formatTimeJakarta(d.checkInAt),
    formatTimeJakarta(d.checkOutAt),
    d.lateMinutes,
    d.workMinutes ?? '',
  ];
}

function toRowObject(headers: readonly string[], values: (string | number)[]): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  headers.forEach((header, i) => {
    row[header] = values[i] ?? '';
  });
  return row;
}

/**
 * Builds the two-sheet monthly recap workbook described in TRD.md §13: "Rekap" (one row per
 * employee) and "Detail" (one row per log). Pure and synchronous — the caller (a route
 * handler backed by `lib/queries/reports.ts`) decides whether to stream the bytes directly
 * or `put()` them to Blob first (TRD.md §13: files > 4 MB can't fit a Vercel function
 * response).
 */
export function buildMonthlyRecapWorkbook({
  recap,
  detail,
}: {
  recap: MonthlyRecapRow[];
  detail: DailyAttendanceDetailRow[];
}): Buffer {
  const rekapRows = recap.map((r) => toRowObject(MONTHLY_RECAP_HEADERS, monthlyRecapDisplayRow(r)));
  const detailRows = detail.map((d) => toRowObject(MONTHLY_DETAIL_HEADERS, monthlyDetailDisplayRow(d)));

  // Passing `header` explicitly (rather than letting json_to_sheet infer it from the first
  // row) keeps the header row present even when `recap`/`detail` is empty for the period.
  const wsRekap = XLSX.utils.json_to_sheet(rekapRows, { header: [...MONTHLY_RECAP_HEADERS] });
  const wsDetail = XLSX.utils.json_to_sheet(detailRows, { header: [...MONTHLY_DETAIL_HEADERS] });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
