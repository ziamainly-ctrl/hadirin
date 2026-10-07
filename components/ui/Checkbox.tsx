import { Check } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Text next to the box. Omit it to render the bare control inside your own <label>. */
  label?: ReactNode;
  description?: ReactNode;
}

const BOX_CLASSES =
  'peer h-4 w-4 cursor-[inherit] appearance-none rounded-[5px] border border-input bg-transparent shadow-xs transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed dark:bg-input/30 dark:checked:bg-primary';

/**
 * Styled native checkbox (appearance-none + a Lucide check on top), so the box looks the
 * same in every browser and takes the palette instead of the OS accent. Still a real
 * <input type="checkbox">: keyboard, form state and screen readers are untouched.
 */
export default function Checkbox({ label, description, className, ...rest }: CheckboxProps) {
  const control = (
    <span className="relative mt-0.5 inline-flex h-4 w-4 shrink-0">
      <input type="checkbox" className={BOX_CLASSES} {...rest} />
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-fg opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  );

  if (label === undefined) return control;

  return (
    <label
      className={`flex items-start gap-2.5 text-sm text-text ${rest.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className ?? ''}`}
    >
      {control}
      <span>
        {label}
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
