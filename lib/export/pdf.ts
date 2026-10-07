// Monthly recap PDF export (TRD.md §13): landscape A4, org logo, period, the same recap
// table as the XLSX "Rekap" sheet.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MONTHLY_RECAP_HEADERS, monthlyRecapDisplayRow, type MonthlyRecapRow } from './xlsx';

export interface BuildMonthlyRecapPdfInput {
  recap: MonthlyRecapRow[];
  orgName: string;
  periodLabel: string;
  /**
   * Image data jsPDF's `addImage` can consume synchronously — e.g. a `data:` URI — not a
   * bare remote URL. This function makes no network calls (it must stay pure and
   * synchronous-friendly), so a route handler that wants the real logo has to fetch it and
   * hand over already-loaded image data; omit this to skip the logo entirely.
   */
  logoUrl?: string;
}

/** Builds the landscape-A4 monthly recap PDF (TRD.md §13). Pure: no network calls inside it. */
export function buildMonthlyRecapPdf({
  recap,
  orgName,
  periodLabel,
  logoUrl,
}: BuildMonthlyRecapPdfInput): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const marginLeft = 40;
  let textX = marginLeft;

  if (logoUrl) {
    try {
      doc.addImage(logoUrl, marginLeft, 16, 40, 40);
      textX = marginLeft + 52;
    } catch {
      // Malformed/unsupported logo data must never break the export — fall back to no logo.
    }
  }

  doc.setFontSize(16);
  doc.text(orgName, textX, 36);
  doc.setFontSize(10);
  doc.text(periodLabel, textX, 54);

  autoTable(doc, {
    startY: 72,
    head: [[...MONTHLY_RECAP_HEADERS]],
    body: recap.map(monthlyRecapDisplayRow),
  });

  return new Uint8Array(doc.output('arraybuffer'));
}
