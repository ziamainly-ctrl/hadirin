import { CameraOff, ImagePlus, Lock, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { describeCameraError, type CameraErrorKind } from './camera-errors';
import './checkin.css';

/**
 * The camera could not open. Says why in plain words, lists what to try (numbered, short) and offers
 * both ways out: try again, or pick a selfie from the device, so a person is never stuck in front
 * of a camera that will not start. The caller decides where it sits (in place of the viewfinder).
 */
export default function CameraErrorPanel({
  kind,
  onRetry,
  onPickFile,
  picking = false,
  disabled = false,
  className,
}: {
  kind: CameraErrorKind;
  onRetry: () => void;
  onPickFile: () => void;
  picking?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const copy = describeCameraError(kind);
  const Icon = kind === 'denied' ? Lock : CameraOff;
  return (
    <div role="alert" className={`ci-enter flex w-full flex-col gap-2 rounded-input border border-border bg-accent p-3 text-left ${className ?? ''}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">{copy.title}</p>
          <p className="text-xs text-text/80">{copy.message}</p>
        </div>
      </div>
      {copy.steps.length ? (
        <ol className="list-decimal space-y-0.5 pl-9 pr-1 text-xs text-text/80">
          {copy.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-0.5">
        {copy.retryable ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={disabled}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Coba Lagi
          </Button>
        ) : null}
        <Button type="button" variant="primary" size="sm" onClick={onPickFile} isLoading={picking} disabled={disabled}>
          {picking ? null : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          Pilih Foto dari Perangkat
        </Button>
      </div>
    </div>
  );
}
