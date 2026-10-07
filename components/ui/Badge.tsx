import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Neutral gray chip with a small colored dot: the product owner wants every panel gray and
   * color only as a tiny accent, so a status never gets a tinted fill. Omit `tone` for a bare
   * pill whose colors the caller passes in `className` (a count, a channel, a role).
   */
  tone?: BadgeTone;
  /** Show the dot when `tone` is set. False gives a plain neutral chip (a channel label). */
  dot?: boolean;
}

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-muted',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
};

/**
 * Small rounded pill. With `tone` it is a neutral chip (bg-accent, border, normal text) plus a
 * colored dot — contrast comes from the text, color is only the dot. Without `tone` it has no
 * baked-in color and callers pass background and text color utilities via className. See
 * components/shared/StatusBadge.tsx for the one place that maps attendance status to color;
 * that logic does not belong here.
 */
export default function Badge({ tone, dot = true, className, children, ...rest }: BadgeProps) {
  const toneClasses = tone ? 'border border-border bg-accent text-text' : '';
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses} ${className ?? ''}`}
      {...rest}
    >
      {tone && dot ? <span aria-hidden="true" className={`mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[tone]}`} /> : null}
      {children}
    </span>
  );
}
