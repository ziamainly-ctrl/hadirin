'use client';

import type { ReactNode } from 'react';
import Button from './Button';
import Dialog from './Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' (default) for destructive actions; 'primary' for a plain "are you sure". */
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app replacement for window.confirm(): same wording and the same "nothing happens until
 * you say yes" contract, but styled like the rest of the product, themed for dark mode, and
 * not blocked by in-app browsers that suppress native alerts.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} size="sm">
      <Dialog.Body>
        <p className="text-sm text-muted">{description}</p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={variant} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
