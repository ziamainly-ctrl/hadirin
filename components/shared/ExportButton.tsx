'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { ButtonVariant } from '@/components/ui/Button';

export interface ExportButtonProps {
  href: string;
  children?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

const LOADING_DISPLAY_MS = 1000;

/**
 * Export routes stream a file with Content-Disposition (TRD.md §13), so a
 * same-tab navigation is all that is needed — no fetch+blob dance, and the
 * page never actually unloads. That also means there is no real "finished"
 * signal for the download, so the spinner is a best-effort ~1s timer, not a
 * true loading state.
 */
export default function ExportButton({
  href,
  children = 'Unduh',
  variant = 'secondary',
  className,
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  function handleClick() {
    setIsLoading(true);
    window.location.href = href;
    setTimeout(() => setIsLoading(false), LOADING_DISPLAY_MS);
  }

  return (
    <Button type="button" variant={variant} isLoading={isLoading} onClick={handleClick} className={className}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {children}
    </Button>
  );
}
