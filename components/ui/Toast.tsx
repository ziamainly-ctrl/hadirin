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
}

export interface ToastProviderProps {
  children: ReactNode;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
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

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = createToastId();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
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
                className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-input border px-3 py-2 text-sm shadow-sm ${VARIANT_CLASSES[toast.variant]}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="flex-1">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Tutup notifikasi"
                  className="shrink-0 opacity-70 hover:opacity-100"
                >
                  <X className="h-4 w-4" />
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
