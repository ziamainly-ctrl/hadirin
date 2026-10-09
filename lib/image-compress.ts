// Client-side selfie sizing + JPEG encoding (TRD.md §7 step 2, §14 "Selfie compression happens on
// the client before upload"). Split in two halves on purpose:
//
//   1. Pure maths (centerCropRect, fitWithin, planOutput, nextQuality, formatBytes): no DOM, unit
//      tested in tests/image-compress.test.ts.
//   2. Browser glue (compressToJpeg, decodeImageFile): canvas + createImageBitmap, only ever called
//      from an event handler in a client component, so importing this file from a Server Component
//      is harmless (nothing runs at import time).
//
// Contract with the server (app/api/uploads): JPEG/PNG/WEBP, <= 2 MB, content type sniffed from the
// bytes. This module never returns more than HARD_MAX_BYTES and aims for TARGET_BYTES.

/** The saved photo is a portrait 3:4 crop, the same region the viewfinder shows (object-cover). */
export const PHOTO_ASPECT = { w: 3, h: 4 } as const;
/** Long edge of the saved photo. 1024 keeps a face sharp in the admin's selfie gallery (~80-200 KB). */
export const MAX_EDGE_PX = 1024;
/** Quality ladder tried in order until the blob is small enough. */
export const JPEG_QUALITIES = [0.8, 0.7, 0.6, 0.5] as const;
/** What we aim for: a mobile connection uploads this in well under a second. */
export const TARGET_BYTES = 450 * 1024;
/** Never exceed this (the API refuses > 2 MB; leave headroom for multipart overhead). */
export const HARD_MAX_BYTES = 1_800_000;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The largest centered rectangle of aspect `aspectW:aspectH` inside a `srcW x srcH` frame (integers). */
export function centerCropRect(srcW: number, srcH: number, aspectW: number = PHOTO_ASPECT.w, aspectH: number = PHOTO_ASPECT.h): Rect {
  if (!(srcW > 0) || !(srcH > 0)) return { x: 0, y: 0, w: 0, h: 0 };
  const target = aspectW / aspectH;
  const source = srcW / srcH;
  let w = srcW;
  let h = srcH;
  if (source > target) {
    // Wider than the target (a landscape webcam frame): trim the sides.
    w = Math.round(srcH * target);
  } else if (source < target) {
    // Taller than the target (a 9:16 phone frame): trim top and bottom.
    h = Math.round(srcW / target);
  }
  w = Math.min(w, srcW);
  h = Math.min(h, srcH);
  return { x: Math.floor((srcW - w) / 2), y: Math.floor((srcH - h) / 2), w, h };
}

/** Scales `w x h` so its long edge is at most `maxEdge`. Never upscales; result is at least 1x1. */
export function fitWithin(w: number, h: number, maxEdge: number = MAX_EDGE_PX): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 1, height: 1 };
  const longEdge = Math.max(w, h);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export interface OutputPlan {
  /** The source rectangle to copy (the 3:4 crop). */
  crop: Rect;
  /** Pixel size of the output canvas. */
  width: number;
  height: number;
  /** output / crop, <= 1. */
  scale: number;
}

/** Everything the canvas needs: what to crop out of the frame and how big to draw it. */
export function planOutput(
  srcW: number,
  srcH: number,
  options: { maxEdge?: number; aspectW?: number; aspectH?: number } = {},
): OutputPlan {
  const crop = centerCropRect(srcW, srcH, options.aspectW, options.aspectH);
  const { width, height } = fitWithin(crop.w, crop.h, options.maxEdge ?? MAX_EDGE_PX);
  return { crop, width, height, scale: crop.w > 0 ? width / crop.w : 1 };
}

/** The JPEG quality for attempt `attempt` (0-based), or null once the ladder is used up. */
export function nextQuality(attempt: number): number | null {
  return JPEG_QUALITIES[attempt] ?? null;
}

/** "96 KB", "1,2 MB" (Indonesian decimal comma). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

// ---------------------------------------------------------------------------------------------
// Browser half.

export interface CompressedPhoto {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  quality: number;
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode JPEG'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Crops `source` to a centered 3:4 portrait, scales it so the long edge is <= 1024 px and encodes
 * a JPEG, lowering the quality (then the size) until it is <= TARGET_BYTES, never above
 * HARD_MAX_BYTES. The frame is drawn exactly as the sensor delivers it: NOT mirrored, even though
 * the live preview is (a mirrored preview feels natural, a mirrored saved photo would show an admin
 * a reversed face and reversed badge text).
 */
export async function compressToJpeg(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  options: { maxEdge?: number } = {},
): Promise<CompressedPhoto> {
  let maxEdge = options.maxEdge ?? MAX_EDGE_PX;
  let best: CompressedPhoto | null = null;

  for (let shrink = 0; shrink < 3; shrink += 1) {
    const plan = planOutput(srcW, srcH, { maxEdge });
    if (plan.crop.w === 0 || plan.crop.h === 0) throw new Error('Empty frame');
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, plan.crop.x, plan.crop.y, plan.crop.w, plan.crop.h, 0, 0, plan.width, plan.height);

    for (let attempt = 0; ; attempt += 1) {
      const quality = nextQuality(attempt);
      if (quality === null) break;
      const blob = await toJpegBlob(canvas, quality);
      best = { blob, width: plan.width, height: plan.height, bytes: blob.size, quality };
      if (blob.size <= TARGET_BYTES) return best;
    }
    // Even the lowest quality is over the target: if it is also over the hard cap, shrink and retry.
    if (best && best.bytes <= HARD_MAX_BYTES) return best;
    maxEdge = Math.round(maxEdge * 0.75);
  }
  if (!best) throw new Error('Failed to encode JPEG');
  return best;
}

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

/**
 * Decodes a photo picked from the device (the no-camera fallback), honouring its EXIF rotation: a
 * portrait phone photo is stored sideways with an orientation tag, and drawing the raw pixels would
 * save it rotated. createImageBitmap applies the tag (`from-image` is its default); an <img> element
 * applies it too in every current browser, so that is the fallback.
 */
export async function decodeImageFile(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch {
      // Fall through to <img>: some browsers reject the options bag or a format they can still draw.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
