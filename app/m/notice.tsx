import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// Neutral surface for every notice; semantic color lives on the icon only (a tinted panel is
// off-brand here). Destructive is a theme token (it already switches with .dark); there is no
// warning token for text, so the amber pair follows the warning accents used elsewhere.
const NOTICE_ICON_CLASSES = {
  danger: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-info',
} as const;

export type NoticeTone = keyof typeof NOTICE_ICON_CLASSES;

/** One look for every "something needs your attention" state of the check-in flow
 * (location denied / not found, weak GPS, a refused check-in): icon + bold title + plain
 * explanation, left-aligned so a multi-line explanation reads like a paragraph, and an
 * optional action underneath. */
export default function Notice({
  tone,
  icon: Icon,
  title,
  children,
  action,
  role = 'alert',
  className,
}: {
  tone: NoticeTone;
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
}) {
  return (
    <div role={role} className={`flex w-full gap-3 rounded-input border border-border bg-accent p-3 text-left ${className ?? ''}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${NOTICE_ICON_CLASSES[tone]}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-semibold text-text">{title}</p>
        {children ? <div className="text-sm text-text/80">{children}</div> : null}
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
