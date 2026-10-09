import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Text next to the box. Omit it to render the bare control inside your own <label>. */
  label?: ReactNode;
  description?: ReactNode;
}

const BOX_CLASSES =
  'peer h-4 w-4 cursor-[inherit] appearance-none rounded-[5px] border border-field bg-transparent shadow-xs transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-90 checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed dark:bg-input/30 dark:checked:bg-primary';

/**
 * Styled native checkbox (appearance-none + an SVG check on top that draws itself), so the box looks the
 * same in every browser and takes the palette instead of the OS accent. Still a real
 * <input type="checkbox">: keyboard, form state and screen readers are untouched.
 */
export default function Checkbox({ label, description, className, ...rest }: CheckboxProps) {
  const control = (
    <span className="relative mt-0.5 inline-flex h-4 w-4 shrink-0">
      <input type="checkbox" className={BOX_CLASSES} {...rest} />
      {/* A hand-drawn tick (not the Lucide icon) so it can draw itself: the path has pathLength="1"
          and app/globals.css (.check-mark) animates its dash offset when the input is checked. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="check-mark pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-fg"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
      </svg>
    </span>
  );

  if (label === undefined) return control;

  return (
    <label
      className={`flex items-start gap-2.5 text-sm text-text pointer-coarse:min-h-11 pointer-coarse:py-3 ${rest.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className ?? ''}`}
    >
      {control}
      <span>
        {label}
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
