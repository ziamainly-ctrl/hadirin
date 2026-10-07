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
      className={`inline-flex shrink-0 items-center justify-center rounded-input transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
