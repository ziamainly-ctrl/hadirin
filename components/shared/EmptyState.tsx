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
 */
export default function EmptyState({ icon: Icon, message, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-12 text-center ${className ?? ''}`}>
      <Icon className="h-10 w-10 text-muted" aria-hidden="true" />
      <p className="text-sm text-muted">{message}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
