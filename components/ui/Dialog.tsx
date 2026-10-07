'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { HTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** Max width: sm for confirmations, md (default) for most forms, lg for two-column forms. */
  size?: 'sm' | 'md' | 'lg';
  /** False for a one-time reveal (a generated password): Escape, a backdrop click and the
   * close button are all disabled, so only an explicit button inside can end it. */
  dismissible?: boolean;
}

/**
 * Modal built on the native <dialog> element — no modal library needed.
 * showModal()/close() are driven imperatively from the `open` prop.
 *
 * Layout contract: header (title + close), then `children`, in a flex column capped at the
 * viewport height. For a form, make the <form> `flex min-h-0 flex-1 flex-col` and split it
 * into <Dialog.Body> (scrolls when the screen is short) and <Dialog.Footer> (stays pinned
 * at the bottom, so the submit button never scrolls out of reach on a phone).
 */
const SIZE_CLASSES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' } as const;

// Nothing to subscribe to: "are we past hydration" only ever goes false -> true once.
const subscribeNever = () => () => {};

function Dialog({ open, onClose, title, children, className, size = 'md', dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // false on the server and during hydration, true afterwards (no setState-in-effect, no
  // hydration mismatch): the dialog is portalled into <body>, which only exists client-side.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, mounted]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Native 'close' fires for Escape, a form[method=dialog] submit, and our
    // own close() call above — forwarding it keeps the parent's `open` state
    // in sync regardless of what triggered the close.
    const handleClose = () => onClose();
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [onClose, mounted]);

  if (!mounted) return null;

  // Portalled into <body>: a dialog opened from a table row or a right-aligned cell would
  // otherwise inherit that ancestor's white-space, text-align and text color (inheritance
  // follows the DOM tree even though a modal paints in the top layer).
  //
  // Tailwind's preflight zeroes every element's margin, which removes the browser's
  // `margin: auto` that centers a modal <dialog> — without `m-auto` it sticks to the
  // top-left corner. `open:flex` (not bare `flex`) because a plain display utility would
  // also override the UA's display:none on a closed dialog.
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${SIZE_CLASSES[size]} flex-col overflow-hidden rounded-card border border-border bg-surface p-0 text-text shadow-xl open:flex backdrop:bg-black/60 ${className ?? ''}`}
      // Escape fires `cancel` first; preventing it keeps a non-dismissible dialog open
      // (without this the browser closes the element while our `open` state stays true).
      onCancel={dismissible ? undefined : (e) => e.preventDefault()}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        {title ? (
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
        ) : (
          <span />
        )}
        {dismissible ? (
          <IconButton label="Tutup" size="sm" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
      {children}
    </dialog>,
    document.body,
  );
}

function DialogBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}

function DialogFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end ${className ?? ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}

Dialog.Body = DialogBody;
Dialog.Footer = DialogFooter;

export default Dialog;
