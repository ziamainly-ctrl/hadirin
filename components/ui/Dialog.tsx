'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Modal built on the native <dialog> element — no modal library needed.
 * showModal()/close() are driven imperatively from the `open` prop.
 */
export default function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Native 'close' fires for Escape, a form[method=dialog] submit, and our
    // own close() call above — forwarding it keeps the parent's `open` state
    // in sync regardless of what triggered the close.
    const handleClose = () => onClose();
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={`w-full max-w-md rounded-card bg-surface p-0 text-text backdrop:bg-black/50 dark:backdrop:bg-white/50 ${className ?? ''}`}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/10 dark:border-white/10 px-4 py-3">
        {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="rounded-full p-1 text-muted hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
