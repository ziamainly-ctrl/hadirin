'use client';

import { useState } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';

export interface TemporaryPasswordNoticeProps {
  password: string;
  /** Whose password this is, so the admin passes it to the right person. */
  employeeName?: string;
}

/**
 * The one-time temporary-password reveal shared by the "Tambah Karyawan" dialog and the
 * "Reset Kata Sandi" flow (TRD.md §6: both endpoints return it exactly once). A copy
 * button, because retyping a random string from a phone screen is where typos happen.
 */
export default function TemporaryPasswordNotice({ password, employeeName }: TemporaryPasswordNoticeProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin, in-app browser): the password stays
      // select-all, so long-press / triple-click still works.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {employeeName ? (
          <>
            Berikan kata sandi sementara ini kepada <span className="font-medium text-text">{employeeName}</span>.
          </>
        ) : (
          'Berikan kata sandi sementara ini kepada karyawan.'
        )}{' '}
        Karyawan akan diminta membuat kata sandi baru saat pertama kali masuk.
      </p>
      <div className="flex items-center gap-2 rounded-input border border-border bg-accent/50 p-2 pl-3">
        <code className="min-w-0 flex-1 select-all break-all font-mono text-base text-text">{password}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          aria-live="polite"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? 'Tersalin' : 'Salin'}
        </Button>
      </div>
      {/* Neutral panel, no amber fill (the product owner wants no tinted backgrounds): the
          icon and the bold lead carry the warning. */}
      <p className="flex items-start gap-2 rounded-input border border-border bg-accent/50 p-3 text-sm text-text">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium">Catat atau salin sekarang.</span> Kata sandi ini tidak akan ditampilkan lagi
          setelah dialog ditutup.
        </span>
      </p>
    </div>
  );
}
