import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Generic empty-list placeholder: icon + message + optional action, for
 * every empty list in the app (attendance, requests, employees, branches...).
 *
 * It usually stands where a bordered Table would be, so it draws the same card frame
 * (dashed, the shadcn "Empty" pattern) instead of floating bare on the page background.
 * Inside something that already is a card (Card, Table, Dialog — all `rounded-card`) the
 * frame drops away via `in-[.rounded-card]`, so callers never get a box in a box.
 */
export default function EmptyState({ icon: Icon, message, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center in-[.rounded-card]:border-0 in-[.rounded-card]:bg-transparent ${className ?? ''}`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
        <Icon className="h-6 w-6 text-muted" aria-hidden="true" />
      </span>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
