import type { HTMLAttributes } from 'react';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Pulsing placeholder block. Size it per use with className (e.g. "h-4 w-32"
 * for a text line, "h-10 w-10 rounded-full" for an avatar) inside a
 * <Suspense fallback={...}> (TRD.md §14).
 */
export default function Skeleton({ className, ...rest }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded-input bg-muted/20 ${className ?? ''}`} {...rest} />;
}
