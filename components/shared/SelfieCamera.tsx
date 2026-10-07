'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Camera, CameraOff, Loader2, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';

export interface SelfieCameraProps {
  onCapture: (blob: Blob) => void;
  onError?: (message: string) => void;
  /** A shorter viewfinder, for when the caller shows a notice above it (the weak-GPS
   * warning) — keeps "Ambil Foto" above the fold on a 360×740 phone. Ignored in the wide
   * layout, where that notice sits beside the viewfinder instead of above it. */
  compact?: boolean;
  /** Content that belongs with the camera (the clock, the "take a selfie" hint, a notice).
   * Stacked above the viewfinder in a narrow container; in a wide one (>= 36rem, e.g. the
   * check-in page in the marketing shell) the viewfinder moves to the left and the intro,
   * then the capture button, stack in a column beside it, so a short desktop window shows a
   * large preview instead of squeezing it. The nearest ancestor `@container` decides. */
  intro?: ReactNode;
  /** While set, the capture is being sent: the preview freezes on the last frame under a dimmed
   * overlay carrying this text and the capture button is disabled. The caller keeps rendering
   * the camera (instead of swapping in a status block), so the card does not shrink and jump
   * and a failed send resumes the live preview without re-asking for the camera. */
  busyLabel?: string;
  className?: string;
}

// Viewfinder height follows the screen: 100dvh minus the page chrome around it. The chrome
// is a CSS variable the host sets (app/m/layout.tsx knows its header, tab bar and padding;
// 32rem = header + title + shift card + clock + hints + button + tab bar on a phone), so a
// host with different chrome never has to touch this component. --vf-min is the floor: a
// phone scrolls, so it keeps a usable preview; the desktop shell, which must not scroll,
// lowers it. 3:4 portrait ratio gives the width. Wide layout: the preview owns the whole
// left column, so only the page header/footer and the card header are subtracted.
const VIEWFINDER_HEIGHT =
  'h-[clamp(var(--vf-min,12rem),calc(100dvh_-_var(--today-chrome,32rem)),22rem)] @xl:h-[clamp(12rem,calc(100dvh_-_var(--today-chrome-wide,22rem)),28rem)]';
const VIEWFINDER_HEIGHT_COMPACT =
  'h-[clamp(var(--vf-min,9rem),calc(100dvh_-_var(--today-chrome,32rem)_-_5rem),22rem)] @xl:h-[clamp(12rem,calc(100dvh_-_var(--today-chrome-wide,22rem)),28rem)]';

const TARGET_WIDTH = 640;
const JPEG_QUALITY = 0.7;

function drawToCanvas(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): HTMLCanvasElement {
  const scale = TARGET_WIDTH / sourceWidth;
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_WIDTH;
  canvas.height = Math.round(sourceHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode JPEG'));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/**
 * Front-camera selfie capture for check-in/out (PRD.md US-01). Compresses
 * every frame — live capture or the <input capture> fallback — through the
 * same canvas path to ~640px wide JPEG at quality 0.7 (~60-150 KB; PRD target
 * is <= 200 KB).
 */
export default function SelfieCamera({ onCapture, onError, compact = false, intro, busyLabel, className }: SelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  // Why the live camera isn't available, shown inline above the upload button. Not sent
  // through onError: the fallback explains itself in place, and a toast on top of it said
  // the same thing twice (and covered the page header).
  const [fallbackReason, setFallbackReason] = useState('');
  // True from the tap until the caller has the blob (canvas + JPEG encode are async), so a second
  // tap in that window cannot start a second capture.
  const [processing, setProcessing] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFallbackReason('Kamera tidak didukung di browser ini.');
        setStatus('fallback');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('ready');
      } catch {
        if (cancelled) return;
        setFallbackReason('Kamera tidak bisa dibuka. Pastikan izin kamera untuk situs ini aktif.');
        setStatus('fallback');
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Freeze the preview on the captured frame while the caller sends it, and let it run again if
  // the send fails and the caller comes back to this screen.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (busyLabel) {
      video.pause();
      pausedRef.current = true;
    } else if (pausedRef.current) {
      pausedRef.current = false;
      video.play().catch(() => {});
    }
  }, [busyLabel]);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || processing) return;
    setProcessing(true);
    try {
      const canvas = drawToCanvas(video, video.videoWidth, video.videoHeight);
      const blob = await canvasToJpegBlob(canvas);
      onCapture(blob);
    } catch {
      onError?.('Gagal memproses foto. Coba lagi.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = objectUrl;
      });
      const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight);
      const blob = await canvasToJpegBlob(canvas);
      onCapture(blob);
    } catch {
      onError?.('Foto tidak valid. Coba lagi dengan foto lain.');
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setProcessing(false);
    }
  }

  const hasViewfinder = status !== 'fallback';

  return (
    <div
      className={`flex w-full flex-col items-center gap-3 ${
        hasViewfinder
          ? '@xl:grid @xl:grid-cols-[auto_minmax(0,1fr)] @xl:grid-rows-[1fr_auto_auto_1fr] @xl:items-center @xl:justify-items-start @xl:gap-x-8'
          : ''
      } ${className ?? ''}`}
    >
      {intro ? (
        <div
          className={`flex w-full flex-col items-center gap-3 ${
            hasViewfinder ? '@xl:col-start-2 @xl:row-start-2 @xl:items-start' : ''
          }`}
        >
          {intro}
        </div>
      ) : null}

      {hasViewfinder ? (
        // bg-black / text-white on purpose: it is a camera viewfinder in both themes.
        <div
          className={`relative aspect-[3/4] max-w-full overflow-hidden rounded-card border border-border bg-black @xl:col-start-1 @xl:row-span-4 @xl:row-start-1 ${
            compact ? VIEWFINDER_HEIGHT_COMPACT : VIEWFINDER_HEIGHT
          }`}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Pratinjau kamera depan"
            className="h-full w-full -scale-x-100 object-cover"
          />
          {status === 'loading' ? (
            <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              Membuka kamera...
            </div>
          ) : null}
          {busyLabel ? (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 px-3 text-center text-sm text-white"
            >
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              {busyLabel}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasViewfinder ? (
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleCapture}
          disabled={status !== 'ready' || processing || Boolean(busyLabel)}
          className="w-full max-w-xs @xl:col-start-2 @xl:row-start-3"
        >
          <Camera className="h-5 w-5" aria-hidden="true" />
          Ambil Foto
        </Button>
      ) : (
        <>
          {/* Its own block (not a second centered grey line under the caller's "Ambil
              selfie…" hint), so it reads as "why the camera is missing + what to do". */}
          <div role="status" className="flex w-full max-w-xs gap-2 rounded-input border border-border bg-accent p-3 text-left">
            <CameraOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-sm text-text/80">
              {fallbackReason} Ambil atau pilih foto selfie dari perangkat Anda.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            isLoading={processing || Boolean(busyLabel)}
            className="w-full max-w-xs"
          >
            {processing || busyLabel ? null : <Upload className="h-5 w-5" aria-hidden="true" />}
            {busyLabel ?? 'Unggah Foto'}
          </Button>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
