'use client';

import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import IconButton from './IconButton';
import { FIELD_CLASSES, fieldBorderClass } from './field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Classes for the outer wrapper (label + control + message), e.g. to make it flex-fill a column. */
  wrapperClassName?: string;
}

/**
 * Labeled text input. 'use client': uses useId() and forwardRef, both of
 * which need a client render tree — a ref has no meaning in a pure server
 * render, and this is the "forms" leaf category called out in TRD.md R1.
 *
 * type="password" always gets a show/hide toggle inside the field (web.dev "Sign-in form
 * best practices": usability suffers when people can't check what they typed, worst on a
 * phone keyboard). Built in here rather than as a prop so every password field — login,
 * register, change-password, platform login — gets it without each page opting in.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, wrapperClassName, id, className, type, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedById = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);

  const input = (
    <input
      ref={ref}
      id={inputId}
      type={isPassword && revealed ? 'text' : type}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedById}
      // pr-11 keeps typed text clear of the toggle button sitting over the right edge.
      className={`h-10 w-full ${FIELD_CLASSES} ${fieldBorderClass(error)} ${isPassword ? 'pr-11' : ''} ${className ?? ''}`}
      {...rest}
    />
  );

  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName ?? ''}`}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}
      {isPassword ? (
        <div className="relative">
          {input}
          {/* Positioned by a wrapper: IconButton is itself `relative` (its touch hit area),
              and an `absolute` class on it would tie with that on specificity. */}
          <span className="absolute inset-y-0 right-1 flex items-center">
            <IconButton
              label={revealed ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              size="sm"
              onClick={() => setRevealed((v) => !v)}
              aria-pressed={revealed}
              aria-controls={inputId}
              disabled={rest.disabled}
            >
              {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </IconButton>
          </span>
        </div>
      ) : (
        input
      )}
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
