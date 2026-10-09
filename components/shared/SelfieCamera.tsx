'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  Camera,
  Check,
  CameraOff,
  Info,
  Loader2,
  RotateCcw,
  Send,
  Smartphone,
  Sun,
  SunDim,
  SwitchCamera,
  Timer,
  TimerOff,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { compressToJpeg, decodeImageFile, formatBytes, type CompressedPhoto } from '@/lib/image-compress';
import CameraErrorPanel from '@/components/shared/checkin/CameraErrorPanel';
import CameraSheet from '@/components/shared/checkin/CameraSheet';
import FaceGuide from '@/components/shared/checkin/FaceGuide';
import { HINT_COPY, type LightingHint } from '@/components/shared/checkin/light-meter';
import { useCamera } from '@/components/shared/checkin/useCamera';
import { useLightHint } from '@/components/shared/checkin/useLightHint';
import { useMediaQuery } from '@/components/shared/checkin/useMediaQuery';
import '@/components/shared/checkin/checkin.css';

export interface SelfieIntroContext {
  /** True when the screen is the full-screen phone sheet (no @container ancestor, everything stacked). */
  sheet: boolean;
}

export interface SelfieCameraProps {
  /** The photo to send: a 3:4 portrait JPEG, long edge <= 1024 px, NOT mirrored. In review mode this
   * runs only when the person confirms. */
  onCapture: (blob: Blob) => void;
  onError?: (message: string) => void;
  /** A shorter viewfinder, for when the caller shows a notice above it (the weak-GPS warning) in the
   * inline narrow layout. The phone sheet and the wide layout size themselves. */
  compact?: boolean;
  /** Content that belongs with the camera (step indicator, clock, notices, location). Stacked above the
   * viewfinder in a narrow container; in a wide one (>= 36rem, e.g. the check-in page in the marketing
   * shell) the viewfinder moves to the left and the intro, then the buttons, stack in a column beside
   * it. The nearest ancestor `@container` decides. A function receives the layout, so the sheet can
   * drop what a full screen does not need. */
  intro?: ReactNode | ((context: SelfieIntroContext) => ReactNode);
  /** While set, the capture is being sent: the preview freezes under a dimmed overlay carrying this text
   * and the buttons are disabled. The caller keeps rendering the camera (instead of swapping in a status
   * block), so the card does not shrink and jump and a failed send resumes the review without asking
   * for the camera again or re-taking the photo. */
  busyLabel?: string;
  /** 0..1 while the photo's bytes are going up; null/undefined shows an indeterminate bar. */
  progress?: number | null;
  /** Review before sending: a capture shows as a still preview with "Ulangi" and a confirm button,
   * and `onCapture` runs only when the person confirms. Off keeps the old tap-to-send behavior. */
  review?: boolean;
  /** Label of the confirm button in review mode. */
  confirmLabel?: string;
  /** Disables taking a photo (e.g. the punch would be refused for the current position). Also disables
   * the confirm button unless `confirmDisabled` says otherwise. */
  captureDisabled?: boolean;
  /** Why the shutter is disabled, shown under the buttons. */
  disabledReason?: string | null;
  /** Disables only the confirm button of the review (offline: the photo can be taken, not sent). */
  confirmDisabled?: boolean;
  /** Why the confirm button is disabled. */
  confirmDisabledReason?: string | null;
  /** Leave the camera. Shown as an X on the viewfinder (and as "Batal" when there is no viewfinder). */
  onCancel?: () => void;
  /** A photo is waiting for confirmation (true) or was discarded (false): drives the step indicator. */
  onPhotoChange?: (hasPhoto: boolean) => void;
  /** Rendered under the buttons: stays in the same column in the wide layout. */
  footer?: ReactNode;
  className?: string;
}

// Viewfinder height in the INLINE layouts follows the screen: 100dvh minus the page chrome around it.
// The chrome is a CSS variable the host sets (app/m/today-view.tsx knows its header, tab bar and
// padding), so a host with different chrome never has to touch this component. --vf-min is the floor:
// a phone scrolls, so it keeps a usable preview; the desktop shell, which must not scroll, lowers it.
// 3:4 portrait gives the width. Wide layout: the preview owns the whole left column, so only the page
// header/footer and the card header are subtracted. (Below lg the screen is the full-screen sheet and
// these variables are not used at all.)
const VIEWFINDER_HEIGHT =
  'h-[clamp(var(--vf-min,12rem),calc(100dvh_-_var(--today-chrome,32rem)),22rem)] @xl:h-[clamp(12rem,calc(100dvh_-_var(--today-chrome-wide,22rem)),28rem)]';
const VIEWFINDER_HEIGHT_COMPACT =
  'h-[clamp(var(--vf-min,9rem),calc(100dvh_-_var(--today-chrome,32rem)_-_5rem),22rem)] @xl:h-[clamp(12rem,calc(100dvh_-_var(--today-chrome-wide,22rem)),28rem)]';

const TIMER_KEY = 'hadirin-selfie-timer';
const COUNTDOWN_FROM = 3;

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (iOS Safari, desktops): the flash and the sound-less UI are enough.
  }
}

function readTimerPref(): boolean {
  try {
    return localStorage.getItem(TIMER_KEY) === '1';
  } catch {
    return false;
  }
}

function writeTimerPref(on: boolean) {
  try {
    localStorage.setItem(TIMER_KEY, on ? '1' : '0');
  } catch {
    // Private mode / blocked storage: the choice just does not persist.
  }
}

const HINT_ICONS: Record<LightingHint, typeof Check> = {
  ok: Check,
  'too-dark': SunDim,
  'too-bright': Sun,
  backlit: SunDim,
  covered: CameraOff,
  shaky: Smartphone,
};

interface Shot extends CompressedPhoto {
  url: string;
}

/** A round icon button over the viewfinder. A viewfinder is black in both themes, so these are too. */
function OverlayButton({
  label,
  onClick,
  children,
  pressed,
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full bg-black/55 px-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:min-w-11 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

/** The upload ring: bytes sent so far, or a spinner when there is no progress to show. */
function ProgressRing({ progress }: { progress: number | null | undefined }) {
  if (progress === null || progress === undefined) {
    return <Loader2 className="h-9 w-9 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  }
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <span className="relative inline-flex h-14 w-14 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="16" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - pct}
          style={{ transition: 'stroke-dashoffset 150ms linear' }}
        />
      </svg>
      <span className="text-xs font-semibold tabular-nums">{pct}%</span>
    </span>
  );
}

/**
 * Front-camera selfie capture for check-in/out (PRD.md US-01).
 *
 * Camera: front camera first, graceful fallbacks, a switch when the device has several, a torch when
 * the camera has one, recovery steps for every way it can fail (denied, missing, in use, lost) and a
 * pick-a-photo fallback. The preview is mirrored (it feels natural); the saved photo never is.
 * Guidance: an oval face guide, a live hint chip from a cheap brightness sample (too dark, too bright,
 * backlit, covered lens, shaky), an optional 3-2-1 timer, a shutter flash and a haptic tick.
 * Review: the still, its size, "Ulangi" and the confirm button. The photo is always a 3:4 portrait
 * (exactly the part the viewfinder shows), long edge <= 1024 px, JPEG ~0.8, <= ~450 KB (lib/image-compress).
 *
 * On a phone (< lg) the screen is a full-screen sheet; on a desktop it stays in the card.
 */
export default function SelfieCamera({
  onCapture,
  onError,
  compact = false,
  intro,
  busyLabel,
  progress,
  review = false,
  confirmLabel = 'Kirim',
  captureDisabled = false,
  disabledReason,
  confirmDisabled,
  confirmDisabledReason,
  onCancel,
  onPhotoChange,
  footer,
  className,
}: SelfieCameraProps) {
  const camera = useCamera();
  const { videoRef, setVideoEl, status, errorKind, streamGen, slowPermission, mirrored } = camera;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSheet = useMediaQuery('(max-width: 1023.98px)');

  // True from the tap until the photo is encoded (canvas + JPEG encode are async), so a second tap in
  // that window cannot start a second capture.
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  // The still the person is reviewing (review mode).
  const [shot, setShot] = useState<Shot | null>(null);
  const [useTimer, setUseTimer] = useState(readTimerPref);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [frameGen, setFrameGen] = useState(0);
  const pausedRef = useRef(false);

  const busy = Boolean(busyLabel);
  const reviewing = review && shot !== null;
  const frameReady = status === 'ready' && frameGen === streamGen;
  const live = status === 'ready' && !reviewing;
  const hint = useLightHint(videoRef, live && frameReady && !busy && !processing);

  // Latest props for callbacks that outlive a render (the countdown's timer).
  const latest = useRef({ onCapture, onError, onPhotoChange });
  useEffect(() => {
    latest.current = { onCapture, onError, onPhotoChange };
  });

  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  useEffect(() => {
    latest.current.onPhotoChange?.(shot !== null);
  }, [shot]);

  // Freeze the preview on the captured frame while the caller sends it, and let it run again if the
  // send fails and the caller comes back to this screen.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (busy) {
      video.pause();
      pausedRef.current = true;
    } else if (pausedRef.current && !shot) {
      pausedRef.current = false;
      video.play().catch(() => {});
    }
  }, [busy, shot, videoRef]);

  function deliver(photo: CompressedPhoto) {
    if (review) {
      setShot({ ...photo, url: URL.createObjectURL(photo.blob) });
    } else {
      latest.current.onCapture(photo.blob);
    }
  }

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setFlashKey((k) => k + 1);
    buzz(30);
    try {
      // Pause first: the frame the person sees freeze is the frame that is saved.
      video.pause();
      const photo = await compressToJpeg(video, video.videoWidth, video.videoHeight);
      deliver(photo);
    } catch {
      video.play().catch(() => {});
      latest.current.onError?.('Gagal memproses foto. Coba lagi.');
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
    // deliver() only reads `review` and latest refs through its closure; re-creating capture per
    // render would restart nothing (the countdown reads it through a ref), so it is safe to list review only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, videoRef]);

  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  });

  // The 3-2-1: one timeout per digit, cleared on unmount or cancel. It reads capture through a ref,
  // so the parent re-rendering (it does, on every GPS update) never resets the clock.
  useEffect(() => {
    if (countdown === null) return;
    const digit = countdown;
    const id = window.setTimeout(() => {
      if (digit <= 1) {
        setCountdown(null);
        void captureRef.current();
      } else {
        setCountdown(digit - 1);
        buzz(10);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  function handleShutter() {
    if (countdown !== null) {
      setCountdown(null);
      return;
    }
    if (useTimer) {
      buzz(15);
      setCountdown(COUNTDOWN_FROM);
    } else {
      void capture();
    }
  }

  function toggleTimer() {
    setUseTimer((prev) => {
      writeTimerPref(!prev);
      return !prev;
    });
  }

  function retake() {
    setShot(null);
    setCountdown(null);
    videoRef.current?.play().catch(() => {});
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setProcessing(true);
    let decoded: Awaited<ReturnType<typeof decodeImageFile>> | null = null;
    try {
      decoded = await decodeImageFile(file);
      const photo = await compressToJpeg(decoded.source, decoded.width, decoded.height);
      deliver(photo);
    } catch {
      latest.current.onError?.('Foto tidak valid. Coba lagi dengan foto lain.');
    } finally {
      decoded?.dispose();
      setProcessing(false);
    }
  }

  // ---- pieces ------------------------------------------------------------------------------

  const pickFile = () => fileInputRef.current?.click();
  const introNode = typeof intro === 'function' ? intro({ sheet: isSheet }) : intro;
  const showErrorFrame = status === 'error' && !reviewing;
  const hasFrame = !showErrorFrame;
  const timerLabel = useTimer ? `Timer ${COUNTDOWN_FROM} detik aktif. Ketuk untuk mematikan` : `Aktifkan timer ${COUNTDOWN_FROM} detik`;
  const HintIcon = HINT_ICONS[hint];
  const hintCopy = HINT_COPY[hint];

  // The viewfinder: the live preview or the still, with the guide, the hint chip, the controls, the
  // countdown, the shutter flash and the sending overlay. `sizing` is the only thing that differs
  // between the inline card and the phone sheet.
  const viewfinder = (sizing: string) => (
    // bg-black / text-white on purpose: it is a camera viewfinder in both themes.
    <div
      role="group"
      aria-label="Kamera selfie"
      className={`relative aspect-[3/4] max-w-full overflow-hidden rounded-card border border-border bg-black text-white ${sizing}`}
    >
      {status !== 'error' ? (
        <video
          ref={setVideoEl}
          autoPlay
          playsInline
          muted
          aria-label={mirrored ? 'Pratinjau kamera depan' : 'Pratinjau kamera'}
          onPlaying={() => setFrameGen(streamGen)}
          className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
        />
      ) : null}

      {reviewing ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL of the photo just taken; next/image cannot optimise it
        <img src={shot.url} alt="Pratinjau foto selfie Anda" className="ci-shot-in absolute inset-0 h-full w-full object-cover" />
      ) : null}

      {live && frameReady ? <FaceGuide ready={hint === 'ok' && countdown === null} /> : null}

      {status === 'starting' || (status === 'ready' && !frameReady && !reviewing) ? (
        <div role="status" className="ci-sweep absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden px-4 text-center text-sm text-white/85">
          <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {slowPermission ? (
            <>
              <span className="font-semibold">Menunggu izin kamera</span>
              <span className="text-xs text-white/70">Ketuk Izinkan pada jendela di atas layar.</span>
            </>
          ) : (
            'Membuka kamera...'
          )}
        </div>
      ) : null}

      {/* Controls: leave on the left; timer, camera switch and torch on the right. */}
      {!busy && !processing ? (
        <>
          {onCancel ? (
            <div className="absolute left-2 top-2 z-10">
              <OverlayButton label="Batal, kembali" onClick={onCancel}>
                <X className="h-4 w-4" aria-hidden="true" />
              </OverlayButton>
            </div>
          ) : null}
          {live && status === 'ready' ? (
            <div className="absolute right-2 top-2 z-10 flex flex-col gap-2">
              <OverlayButton label={timerLabel} pressed={useTimer} onClick={toggleTimer}>
                {useTimer ? <Timer className="h-4 w-4" aria-hidden="true" /> : <TimerOff className="h-4 w-4" aria-hidden="true" />}
                {useTimer ? <span aria-hidden="true">{COUNTDOWN_FROM}</span> : null}
              </OverlayButton>
              {camera.canSwitch ? (
                <OverlayButton label="Ganti kamera" onClick={camera.switchCamera}>
                  <SwitchCamera className="h-4 w-4" aria-hidden="true" />
                </OverlayButton>
              ) : null}
              {camera.torchSupported ? (
                <OverlayButton label={camera.torchOn ? 'Matikan lampu kilat' : 'Nyalakan lampu kilat'} pressed={camera.torchOn} onClick={camera.toggleTorch}>
                  {camera.torchOn ? <Zap className="h-4 w-4" aria-hidden="true" /> : <ZapOff className="h-4 w-4" aria-hidden="true" />}
                </OverlayButton>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {/* The hint chip: the light, as one line. A polite live region, so it is read when it changes. */}
      {live && frameReady && countdown === null && !busy ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center" role="status" aria-live="polite">
          <span
            key={hint}
            className="ci-chip inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
          >
            <HintIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{hintCopy.text}</span>
          </span>
        </div>
      ) : null}

      {reviewing && !busy ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
          <span className="ci-chip inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-medium tabular-nums text-white backdrop-blur-sm">
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Foto siap · {shot.width}×{shot.height} · {formatBytes(shot.bytes)}
          </span>
        </div>
      ) : null}

      {countdown !== null ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status" aria-live="assertive">
          <span key={countdown} className="ci-count text-8xl font-bold tabular-nums drop-shadow-lg">
            {countdown}
          </span>
        </div>
      ) : null}

      {flashKey > 0 ? <div key={flashKey} aria-hidden="true" className="ci-flash pointer-events-none absolute inset-0 bg-white opacity-0" /> : null}

      {busyLabel ? (
        <div role="status" className="ci-fade absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 px-3 text-center text-sm text-white">
          <ProgressRing progress={progress} />
          <span>{busyLabel}</span>
          {progress === null || progress === undefined ? (
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-white/20">
              <span className="ci-indeterminate block h-full w-2/5 bg-white" />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  // The empty frame shown in the wide layout while the camera is unavailable, so the card does not
  // change shape when the error appears and the right column keeps its place.
  const errorFrame = (
    <div className="hidden aspect-[3/4] max-w-full items-center justify-center rounded-card border border-dashed border-field bg-accent text-muted @xl:col-start-1 @xl:row-span-5 @xl:row-start-1 @xl:flex @xl:h-[clamp(12rem,calc(100dvh_-_var(--today-chrome-wide,22rem)),28rem)]">
      <div className="flex flex-col items-center gap-2 px-3 text-center">
        <CameraOff className="h-8 w-8" aria-hidden="true" />
        <span className="text-xs">Kamera belum aktif</span>
      </div>
    </div>
  );

  const shutter = (
    <Button
      type="button"
      variant="primary"
      size="lg"
      onClick={handleShutter}
      disabled={!frameReady || processing || busy || (captureDisabled && countdown === null)}
      className="w-full max-w-xs @xl:col-start-2 @xl:row-start-3 @xl:max-w-none"
    >
      {countdown !== null ? (
        <>
          <X className="h-5 w-5" aria-hidden="true" />
          Batalkan ({countdown})
        </>
      ) : (
        <>
          <Camera className="h-5 w-5" aria-hidden="true" />
          Ambil Foto
        </>
      )}
    </Button>
  );

  const reviewButtons = (
    // Retake sits first: the safe, reversible action is the one under the thumb's resting place.
    <div className="flex w-full max-w-sm gap-2 @xl:col-start-2 @xl:row-start-3 @xl:max-w-none">
      <Button type="button" variant="outline" size="lg" onClick={retake} disabled={busy} className="px-4">
        <RotateCcw className="h-5 w-5" aria-hidden="true" />
        Ulangi
      </Button>
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={() => shot && onCapture(shot.blob)}
        disabled={busy || (confirmDisabled ?? captureDisabled)}
        isLoading={busy}
        className="min-w-0 flex-1"
      >
        {busy ? null : <Send className="h-5 w-5" aria-hidden="true" />}
        <span className="truncate">{confirmLabel}</span>
      </Button>
    </div>
  );

  const errorPanel =
    showErrorFrame && errorKind ? (
      <div className="flex w-full max-w-md flex-col gap-2 @xl:col-start-2 @xl:row-start-3">
        <CameraErrorPanel kind={errorKind} onRetry={camera.retry} onPickFile={pickFile} picking={processing} disabled={busy} />
      </div>
    ) : null;

  const reasonText = reviewing
    ? (confirmDisabled ?? captureDisabled)
      ? (confirmDisabledReason ?? disabledReason)
      : null
    : captureDisabled
      ? disabledReason
      : null;
  const reasonLine =
    reasonText && !busy ? (
      <p role="status" className="ci-fade flex w-full max-w-sm items-start gap-1.5 text-left text-xs text-muted @xl:col-start-2 @xl:row-start-4">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {reasonText}
      </p>
    ) : null;

  const cancelRow =
    showErrorFrame && onCancel ? (
      <div className="flex w-full max-w-xs justify-center @xl:col-start-2 @xl:row-start-4 @xl:justify-start">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
      </div>
    ) : footer ? (
      <div className="flex w-full max-w-xs justify-center @xl:col-start-2 @xl:row-start-4 @xl:justify-start">{footer}</div>
    ) : null;

  const fileInput = (
    <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handleFileChange} className="hidden" />
  );

  const primary = reviewing ? reviewButtons : showErrorFrame ? errorPanel : shutter;

  // ---- phone: the full-screen sheet --------------------------------------------------------
  if (isSheet) {
    return (
      <CameraSheet label="Ambil selfie untuk absen" onCancel={busy ? undefined : onCancel}>
        <div className="ci-enter flex min-h-0 flex-1 flex-col items-center gap-3">
          {introNode ? <div className="flex w-full flex-col items-center gap-3">{introNode}</div> : null}

          {hasFrame ? (
            <div className="flex min-h-[12rem] w-full flex-1 items-center justify-center [container-type:size]">
              {viewfinder('w-[min(100cqw,75cqh)]')}
            </div>
          ) : null}

          <div className="flex w-full flex-col items-center gap-2">
            {primary}
            {reasonLine}
            {cancelRow}
          </div>
          {fileInput}
        </div>
      </CameraSheet>
    );
  }

  // ---- desktop / a wide card: inline --------------------------------------------------------
  return (
    <div
      className={`ci-enter flex w-full flex-col items-center gap-3 @xl:grid @xl:grid-cols-[auto_minmax(0,1fr)] @xl:grid-rows-[1fr_auto_auto_auto_1fr] @xl:items-center @xl:justify-items-start @xl:gap-x-8 ${className ?? ''}`}
    >
      {introNode ? (
        <div className="flex w-full flex-col items-center gap-3 @xl:col-start-2 @xl:row-start-2 @xl:items-start">{introNode}</div>
      ) : null}

      {hasFrame ? (
        <div className="@xl:col-start-1 @xl:row-span-5 @xl:row-start-1 max-w-full">
          {viewfinder(compact ? VIEWFINDER_HEIGHT_COMPACT : VIEWFINDER_HEIGHT)}
        </div>
      ) : (
        errorFrame
      )}

      {primary}
      {reasonLine}
      {cancelRow}
      {fileInput}
    </div>
  );
}
