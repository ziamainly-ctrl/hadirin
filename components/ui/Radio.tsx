import type { InputHTMLAttributes } from 'react';

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Styled native radio: a thick primary ring around a surface-colored center when checked
 * (the filled dot without needing a pseudo-element). Bare control — put it inside your own
 * <label> so the whole row is clickable.
 */
export default function Radio({ className, ...rest }: RadioProps) {
  return (
    <input
      type="radio"
      className={`h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-field bg-transparent shadow-xs transition-[border-width,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:scale-90 checked:border-[5px] checked:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed dark:bg-input/30 dark:checked:bg-surface ${className ?? ''}`}
      {...rest}
    />
  );
}
