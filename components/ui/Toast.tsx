'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  /** True while the exit animation plays (140ms); the item is removed right after. */
  leaving?: boolean;
}

export interface ToastProviderProps {
  children: ReactNode;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// An error or warning says something the person has to act on, so it stays longer than a
// confirmation (WCAG 2.2.1 asks for enough time to read; the X is there for impatient people).
const AUTO_DISMISS_MS: Record<ToastVariant, number> = { success: 5000, info: 5000, warning: 8000, error: 8000 };

// Matches the toast-out animation in app/globals.css.
const TOAST_EXIT_MS = 140;

// Every variant is the same neutral card (bg-surface + border + normal text): the product owner
// wants no tinted panels, so the variant is carried by the icon color alone. The fill is
// opaque in both themes because a toast floats over arbitrary content; a see-through one let
// the top bar's logo or a dialog title show through the message text.
const VARIANT_ICON_CLASSES: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-info',
  warning: 'text-warning',
};

const VARIANT_ICONS: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: TriangleAlert,
};

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * There is no toast library in the fixed dependency list (TRD.md §3), so this
 * is the simplest workable pattern: a context + useState<Toast[]> provider and
 * a useToast() hook.
 *
 * Mount <ToastProvider> once in a client boundary near the root of each
 * authenticated layout — app/m/layout.tsx, app/app/layout.tsx and
 * app/platform/layout.tsx — once those layouts exist, so every page under
 * them can call useToast().
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // The toast list is a manual popover so it lives in the browser's top layer. A modal
  // <dialog> (components/ui/Dialog.tsx) and its backdrop also live there, and a plain
  // `fixed z-50` element can never paint above them: a validation error toast fired from
  // inside a form dialog showed up dimmed *under* the backdrop. Elements enter the top
  // layer in the order they were shown, so hiding and re-showing the list on every change
  // keeps it above whatever is open. Browsers without the Popover API fall back to the
  // plain fixed positioning below.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof el.showPopover !== 'function') return;
    if (el.matches(':popover-open')) el.hidePopover();
    if (toasts.length > 0) el.showPopover();
  }, [toasts]);

  // Two steps so a toast animates out instead of vanishing: flag it (the card plays toast-out),
  // then drop it once the 140ms animation is done. With reduced motion there is no animation to
  // wait for, so it goes at once. Calling it twice (the timer and the X) is harmless.
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id && !t.leaving ? { ...t, leaving: true } : t)));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), reduce ? 0 : TOAST_EXIT_MS);
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = createToastId();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS[variant]);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div
        ref={listRef}
        popover="manual"
        className="pointer-events-none fixed inset-x-0 bottom-auto top-4 z-50 m-0 h-auto w-full max-w-none overflow-visible border-0 bg-transparent p-0"
      >
        <div className="flex flex-col items-center gap-2 px-4">
          {toasts.map((toast) => {
            const Icon = VARIANT_ICONS[toast.variant];
            return (
              <div
                key={toast.id}
                role={toast.variant === 'error' ? 'alert' : 'status'}
                className={`${toast.leaving ? 'toast-out pointer-events-none' : 'toast-in pointer-events-auto'} flex w-full max-w-sm items-start gap-2.5 rounded-input border border-input bg-surface px-3 py-2.5 text-sm text-text shadow-lg`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${VARIANT_ICON_CLASSES[toast.variant]}`} aria-hidden="true" />
                <p className="min-w-0 flex-1 break-words">{toast.message}</p>
                {/* 28px box pulled back by -m-1 so the row height is unchanged: the bare
                    16px icon was below the 24px minimum target (WCAG 2.5.8). Not an
                    IconButton on purpose: no hover chrome, just the muted X. */}
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Tutup notifikasi"
                  className="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-input text-muted transition-[color,transform] hover:text-text focus-visible:text-text active:scale-90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
