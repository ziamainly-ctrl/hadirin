import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

// primary/secondary are the two filled brand roles from the palette in app/globals.css;
// outline is the bordered, transparent one (what `secondary` used to be before the palette
// gave secondary a color of its own); ghost has no chrome until hovered.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-fg hover:bg-secondary/80',
  outline: 'border border-input bg-surface text-text shadow-xs hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50',
  ghost: 'bg-transparent text-text hover:bg-accent',
  // The dark token is a light red meant for text on a dark surface, so as a fill it is
  // dimmed (same treatment as shadcn's destructive button) to keep white text readable.
  danger: 'bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
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
  return `inline-flex items-center justify-center whitespace-nowrap rounded-input font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className ?? ''}`;
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
