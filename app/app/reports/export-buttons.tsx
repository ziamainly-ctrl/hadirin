'use client';

import Link from 'next/link';
import ExportButton from '@/components/shared/ExportButton';

export interface ExportButtonsProps {
  month: string;
  branchId?: string;
  /** getOrganizationPlanContext's features.export_pdf, resolved server-side (TRD.md §6:
   * "PDF requires features.export_pdf") — this component only ever reads it, never guesses. */
  canExportPdf: boolean;
}

/**
 * The two export links for app/app/reports/page.tsx, shown top-right of the page header
 * (the page's primary action, same spot as "Tambah …" on the other list pages). They
 * export exactly what the page shows: the same month and branch. `format=xlsx` is the
 * universal baseline, so its ExportButton always renders; `format=pdf` is a paid-plan
 * feature, so the page decides whether to render that button at all (via `canExportPdf`)
 * and otherwise points to the billing page. Both /api/reports/monthly/export links stream
 * a file with Content-Disposition (TRD.md §13), so ExportButton's same-tab navigation is
 * enough — no fetch+blob dance. The month/branch pickers live in ./filters.tsx.
 */
export default function ExportButtons({ month, branchId, canExportPdf }: ExportButtonsProps) {
  const query = new URLSearchParams({ month });
  if (branchId) query.set('branchId', branchId);

  const xlsxHref = `/api/reports/monthly/export?${query.toString()}&format=xlsx`;
  const pdfHref = `/api/reports/monthly/export?${query.toString()}&format=pdf`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ExportButton href={xlsxHref} variant="outline">
        Unduh Excel
      </ExportButton>
      {canExportPdf ? (
        <ExportButton href={pdfHref} variant="outline">
          Unduh PDF
        </ExportButton>
      ) : (
        <p className="text-sm text-muted">
          Ekspor PDF tersedia di paket berbayar.{' '}
          <Link
            href="/app/settings/billing"
            className="whitespace-nowrap rounded-input font-medium text-text underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Lihat paket
          </Link>
        </p>
      )}
    </div>
  );
}
