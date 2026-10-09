'use client';

import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { FIELD_CLASSES, fieldBorderClass } from './field';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Classes for the outer wrapper (label + control + message). */
  wrapperClassName?: string;
  /** Convenience prop: when given, renders these as <option> instead of children. */
  options?: SelectOption[];
}

/**
 * Native <select> wrapper — not a custom dropdown, this is a hackathon build.
 * 'use client': uses useId() and forwardRef, both client-only concerns.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, wrapperClassName, options, id, className, children, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const describedById = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName ?? ''}`}>
      {label ? (
        <label htmlFor={selectId} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
        className={`h-10 ${FIELD_CLASSES} ${fieldBorderClass(error)} ${className ?? ''}`}
        {...rest}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="animate-rise-sm text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Select;
