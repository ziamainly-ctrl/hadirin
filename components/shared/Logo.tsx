import Mascot from './Mascot';

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
 * Brand lockup (mascot + "Hadirin" wordmark), reused everywhere the brand appears: the
 * marketing header, the auth card, the /m top bar and both the /app and /platform
 * sidebars. The mark is sized in em, so `className="text-lg"` etc. scales the mascot
 * together with the wordmark instead of needing a second size prop.
 */
export default function Logo({ className, iconOnly = false, suffix }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <Mascot className="h-[2em] w-[2em] shrink-0" />
      {!iconOnly ? (
        <span className="flex flex-col leading-none">
          <span className="font-bold tracking-tight text-text">Hadirin</span>
          {/* Stacked under the wordmark rather than beside it: beside it, "Hadirin Platform"
              plus the theme toggle and collapse button overflow the 240px sidebar header.
              Floor of 10px: at 0.55em it rendered 7.7px in the 14px mobile top bar and 9px in
              the sidebar, too small to read even as an all-caps label. */}
          {suffix ? (
            <span className="mt-1 text-[max(0.62em,10px)] font-semibold uppercase tracking-[0.14em] text-muted">
              {suffix}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
