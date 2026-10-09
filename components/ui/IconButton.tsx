import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'ghost' | 'outline';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: an icon-only button has no text, so this is its accessible name. */
  label: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  children: ReactNode;
}

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
};

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: 'text-muted hover:bg-accent hover:text-text',
  outline: 'border border-input bg-surface text-text shadow-xs hover:bg-accent',
};

// On a touch screen every size gets an invisible 44px hit area (Apple HIG 44pt; WCAG 2.5.5
// AAA is 44 CSS px, 2.5.8 AA is 24) via a centered ::before, so a 32px dialog close or drag
// handle stays visually compact on desktop yet is easy to hit with a thumb. Mouse users
// keep the drawn box as the target.
const TOUCH_TARGET =
  "relative before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] pointer-fine:before:hidden";

/**
 * Square icon-only button (theme toggle, sidebar collapse, dialog close, menu toggles).
 * One shape and one set of states, so the header, sidebar and dialogs can't each invent
 * their own round-or-square, padded-or-sized version.
 */
export default function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  type = 'button',
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`${TOUCH_TARGET} inline-flex shrink-0 items-center justify-center rounded-input transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-90 disabled:pointer-events-none disabled:opacity-50 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
