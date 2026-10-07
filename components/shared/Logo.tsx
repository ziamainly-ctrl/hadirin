import { CheckCircle2 } from 'lucide-react';

export interface LogoProps {
  className?: string;
  /** Icon mark only, no wordmark — the /app and /platform sidebar's collapsed rail has
   * no room for "Hadirin" next to it, the same reason nav items drop their own label
   * there (Sidebar.tsx's renderNavItems(showLabels)). */
  iconOnly?: boolean;
  /** "Platform" for app/platform/(authenticated)/layout.tsx's header — kept as a prop
   * rather than a second component so every surface shares one icon mark. */
  suffix?: string;
}

/**
 * Brand lockup (icon mark + "Hadirin" wordmark), reused everywhere the brand appears:
 * the marketing header, the auth card, and both the /app and /platform sidebars. Before
 * this there was no icon anywhere, just the wordmark in four slightly different ad hoc
 * styles. The mark itself is a check — "hadir" (present) is the product's one verb, and
 * it's the exact same glyph already used for a PRESENT attendance status elsewhere
 * (components/shared/StatusBadge.tsx, CheckInPreview.tsx), not a new symbol to learn.
 */
export default function Logo({ className, iconOnly = false, suffix }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      </span>
      {!iconOnly ? (
        <span className="font-bold text-primary">
          Hadirin
          {suffix ? <span className="ml-1 font-semibold text-muted">{suffix}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
