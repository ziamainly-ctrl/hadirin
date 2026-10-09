import type { HTMLAttributes } from 'react';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Shimmering placeholder block. Size it per use with className (e.g. "h-4 w-32"
 * for a text line, "h-10 w-10 rounded-full" for an avatar) inside a
 * <Suspense fallback={...}> or a loading.tsx (TRD.md §14).
 *
 * `skeleton` (app/globals.css) is a soft highlight that sweeps left to right with transform only
 * (no layout, no repaint of the neighbours); under reduced motion it is a still gray block.
 * It is aria-hidden: the page that shows skeletons says "Memuat…" itself (a role="status" line, or
 * the global NavigationProgress pill), so a screen reader hears one message, not forty blocks.
 */
export default function Skeleton({ className, ...rest }: SkeletonProps) {
  return <div aria-hidden="true" className={`skeleton rounded-input bg-muted/15 ${className ?? ''}`} {...rest} />;
}
