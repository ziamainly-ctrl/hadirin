'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Input from '@/components/ui/Input';
import ExportButton from '@/components/shared/ExportButton';

export interface ExportButtonsProps {
  month: string;
  branchId?: string;
  /** getOrganizationPlanContext's features.export_pdf, resolved server-side (TRD.md §6:
   * "PDF requires features.export_pdf") — this component only ever reads it, never guesses. */
  canExportPdf: boolean;
}

/**
 * Client controls for app/app/reports/page.tsx: the month picker (same
 * search-params-push pattern as app/app/attendance/filters.tsx) plus the two
 * export links. `format=xlsx` is the universal baseline, so its ExportButton
 * always renders; `format=pdf` is a paid-plan feature, so the page decides
 * whether to render that button at all (via `canExportPdf`) rather than
 * rendering it disabled. Both /api/reports/monthly/export links stream a file
 * with Content-Disposition (TRD.md §13), so ExportButton's same-tab
 * navigation is enough — no fetch+blob dance.
 */
export default function ExportButtons({ month, branchId, canExportPdf }: ExportButtonsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleMonthChange(value: string) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const query = new URLSearchParams({ month });
  if (branchId) query.set('branchId', branchId);

  const xlsxHref = `/api/reports/monthly/export?${query.toString()}&format=xlsx`;
  const pdfHref = `/api/reports/monthly/export?${query.toString()}&format=pdf`;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        type="month"
        label="Bulan"
        value={month}
        onChange={(e) => handleMonthChange(e.target.value)}
        className="w-auto"
      />
      <ExportButton href={xlsxHref}>Unduh XLSX</ExportButton>
      {canExportPdf ? (
        <ExportButton href={pdfHref}>Unduh PDF</ExportButton>
      ) : (
        <p className="text-sm text-muted">Export PDF memerlukan paket berbayar.</p>
      )}
    </div>
  );
}
