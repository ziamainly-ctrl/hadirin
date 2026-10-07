import type { HTMLAttributes } from 'react';

export type BadgeProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Small rounded pill with no baked-in color — callers pass background and
 * text color utility classes via className. See
 * components/shared/StatusBadge.tsx for the one place that
 * maps attendance status to color; that logic does not belong here.
 */
export default function Badge({ className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${className ?? ''}`}
      {...rest}
    >
      {children}
    </span>
  );
}
