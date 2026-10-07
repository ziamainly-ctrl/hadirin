import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

// primary/secondary are the two filled brand roles from the palette in app/globals.css;
// outline is the bordered, transparent one (what `secondary` used to be before the palette
// gave secondary a color of its own); ghost has no chrome until hovered.
//
// The filled roles paint a gradient (a background-image), and an image sits on top of any
// hover:bg-* color, so their hover state is a second gradient token, not a bg color. outline
// is a bg-surface: the global rule in app/globals.css drops that gradient on hover so
// hover:bg-accent shows. Active (pressed) is a 1px nudge down, which reads on every variant.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg shadow-xs hover:bg-[image:var(--gradient-primary-hover)]',
  secondary: 'bg-secondary text-secondary-fg shadow-xs hover:bg-[image:var(--gradient-secondary-hover)]',
  outline: 'border border-input bg-surface text-text shadow-xs hover:bg-accent',
  ghost: 'bg-transparent text-text hover:bg-accent',
  // Neutral surface with red text and a red-tinted border (never a red fill: the product owner
  // wants no colored panels, color only as a small text/icon accent). It reads as destructive
  // from the red label alone and stays AA in both themes because text-destructive is the
  // theme's own text-safe red.
  danger: 'border border-destructive/50 bg-surface text-destructive shadow-xs hover:bg-accent',
  // A quiet destructive action in a table row ("Hapus"): ghost chrome, red text. Its own
  // variant because `variant="ghost" className="text-destructive"` cannot work — both
  // color utilities have the same specificity, so the stylesheet order (not the class
  // order) decides, and the ghost's text-text won: every row "Hapus" rendered black.
  'danger-ghost': 'bg-transparent text-destructive hover:bg-accent',
};

// sm is 32px for a mouse and 40px on a touch screen (pointer-coarse): a 32px "Edit" in every
// table row was the smallest target on the platform pages on a phone (Apple HIG 44pt,
// Material 48dp, WCAG 2.5.8 AA 24px; 40px is the compromise that keeps dense rows readable).
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 pointer-coarse:h-10',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

/**
 * The class string behind every button-looking control. Exported so a link that has to
 * look like a button (ui/ButtonLink) shares it instead of nesting a <button> inside an
 * <a>, which is invalid HTML and gives keyboard users two tab stops for one action.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return `inline-flex items-center justify-center whitespace-nowrap rounded-input font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className ?? ''}`;
}

/**
 * Generic button primitive. Stays a Server Component: it has no hooks or
 * state of its own, so any onClick handler is supplied — and owned — by
 * whatever client component renders it. The 'use client' boundary belongs
 * there, not here.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...rest}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
