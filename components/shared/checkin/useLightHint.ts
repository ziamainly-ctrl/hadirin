'use client';

import { useEffect, useRef, useState } from 'react';
import { centerCropRect } from '@/lib/image-compress';
import {
  INITIAL_HINT_STATE,
  SAMPLE_H,
  SAMPLE_W,
  analyzeLuma,
  classifyLighting,
  frameMotion,
  nextHintState,
  toLuma,
  type HintState,
  type LightingHint,
} from './light-meter';

const SAMPLE_EVERY_MS = 500;

/**
 * Samples the live preview a couple of times a second and returns the debounced hint for the chip
 * over the viewfinder. Cheap by construction: one 24x32 canvas, one drawImage, one getImageData
 * (3 KB). It stops while the tab is hidden, while a photo is being reviewed or sent, and on
 * unmount, so it costs nothing when it cannot help. Everything is advisory: no hint ever blocks
 * the shot.
 */
export function useLightHint(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean): LightingHint {
  const [state, setState] = useState<HintState>(INITIAL_HINT_STATE);
  const previousLuma = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    previousLuma.current = null;

    const sample = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || document.visibilityState !== 'visible') return;
      try {
        const crop = centerCropRect(video.videoWidth, video.videoHeight);
        ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, SAMPLE_W, SAMPLE_H);
        const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
        const luma = toLuma(data, SAMPLE_W, SAMPLE_H);
        const hint = classifyLighting(analyzeLuma(luma, SAMPLE_W, SAMPLE_H), frameMotion(previousLuma.current, luma));
        previousLuma.current = luma;
        setState((prev) => nextHintState(prev, hint));
      } catch {
        // A tainted or not-yet-decoded frame: skip this sample.
      }
    };

    const id = window.setInterval(sample, SAMPLE_EVERY_MS);
    return () => {
      window.clearInterval(id);
      // Back to "ok" when sampling stops, so the next session starts without a stale warning.
      setState(INITIAL_HINT_STATE);
    };
  }, [active, videoRef]);

  return state.shown;
}
