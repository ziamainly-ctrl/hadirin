'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Camera, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';

export interface SelfieCameraProps {
  onCapture: (blob: Blob) => void;
  onError?: (message: string) => void;
  className?: string;
}

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
export default function SelfieCamera({ onCapture, onError, className }: SelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  // Keep the latest onError without making the mount-only effect below
  // restart the camera whenever a caller passes a fresh inline function.
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('fallback');
        onErrorRef.current?.('Kamera tidak didukung di perangkat ini. Unggah foto secara manual.');
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
        setStatus('fallback');
        onErrorRef.current?.('Tidak bisa mengakses kamera. Unggah foto secara manual.');
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    try {
      const canvas = drawToCanvas(video, video.videoWidth, video.videoHeight);
      const blob = await canvasToJpegBlob(canvas);
      onCapture(blob);
    } catch {
      onError?.('Gagal memproses foto. Coba lagi.');
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    }
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ''}`}>
      {status !== 'fallback' ? (
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-card bg-black/80">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        </div>
      ) : null}

      {status === 'ready' ? (
        <Button type="button" variant="primary" onClick={handleCapture} className="gap-2">
          <Camera className="h-4 w-4" aria-hidden="true" />
          Ambil Foto
        </Button>
      ) : null}

      {status === 'fallback' ? (
        <>
          <p className="text-center text-sm text-muted">Kamera tidak tersedia. Unggah foto selfie dari perangkatmu.</p>
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Unggah Foto
          </Button>
        </>
      ) : null}

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
