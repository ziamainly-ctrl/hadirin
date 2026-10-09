import { Check, X } from 'lucide-react';
import type { StepState, StepView } from './steps';
import './checkin.css';

const STATE_WORDS: Record<StepState, string> = {
  done: 'selesai',
  active: 'sedang berjalan',
  pending: 'belum',
  error: 'perlu diperbaiki',
};

function Marker({ state, index }: { state: StepState; index: number }) {
  const base = 'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-200';
  if (state === 'done') {
    return (
      <span className={`${base} bg-primary text-primary-fg`}>
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className={`${base} border border-destructive text-destructive`}>
        <X className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className={`${base} border-2 border-text text-text`}>
        <span aria-hidden="true" className="ci-ping absolute inset-0 rounded-full border border-text" />
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-text" />
      </span>
    );
  }
  return <span className={`${base} border border-field text-muted`}>{index + 1}</span>;
}

/**
 * Lokasi -> Selfie -> Kirim. Neutral by design (the product owner's rule: colour only as a small
 * accent): a finished step is a filled dark disc with a tick, the current one a ringed dot that
 * pings, a failed one a destructive outline with a cross. The connector between two steps fills in
 * once the step before it is done.
 */
export default function StepIndicator({ steps, className }: { steps: readonly StepView[]; className?: string }) {
  return (
    <ol aria-label="Langkah absen" className={`flex w-full items-center gap-2 ${className ?? ''}`}>
      {steps.map((step, i) => (
        <li
          key={step.key}
          aria-current={step.state === 'active' ? 'step' : undefined}
          className={`flex items-center gap-2 ${i < steps.length - 1 ? 'flex-1' : ''}`}
        >
          <Marker state={step.state} index={i} />
          <span
            className={`text-xs font-medium transition-colors duration-200 ${
              step.state === 'pending' ? 'text-muted' : step.state === 'error' ? 'text-destructive' : 'text-text'
            }`}
          >
            {step.label}
            <span className="sr-only">, {STATE_WORDS[step.state]}</span>
          </span>
          {i < steps.length - 1 ? (
            <span aria-hidden="true" className="relative h-px min-w-3 flex-1 overflow-hidden rounded-full bg-border">
              <span
                className={`absolute inset-0 origin-left bg-text transition-transform duration-300 ${
                  step.state === 'done' ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
