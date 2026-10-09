import { Loader2 } from 'lucide-react';

export interface LoadingPillProps {
  /** Default "Memuat…". */
  label?: string;
  className?: string;
}

/**
 * The small "Memuat…" capsule with a spinner. Purely visual and non-blocking (no pointer events,
 * aria-hidden: the live-region sentence is NavigationProgress's own). NavigationProgress mounts it
 * after a navigation has waited about half a second, so the person always knows the app has heard
 * the click; pages can use it for their own long waits, anywhere inside a positioned box.
 * Mounting it plays the pop-in (fade + scale); under reduced motion it simply appears, and the
 * spinner keeps turning (the one animation reduced motion leaves on, because a still spinner
 * reads as a hang).
 */
export default function LoadingPill({ label = 'Memuat…', className }: LoadingPillProps) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-flex animate-pop-in items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text shadow-lg ${className ?? ''}`}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </span>
  );
}
