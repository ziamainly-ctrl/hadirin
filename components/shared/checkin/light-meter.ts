// A cheap "is this a usable selfie frame?" check for the live preview: the camera is drawn into a
// tiny 24x32 canvas a couple of times a second and its luminance is summarised. No face detection,
// no library: it only answers "too dark / too bright / backlit / camera covered / shaky", which are
// the reasons a clock-in selfie is unreadable for the admin who reviews it. Pure functions on a
// pixel array so they are unit tested (tests/checkin-light-meter.test.ts); the sampling loop lives
// in useLightHint.ts.

/** The sample canvas is 3:4 portrait, the same crop the viewfinder shows and the saved photo uses. */
export const SAMPLE_W = 24;
export const SAMPLE_H = 32;

/** The face oval, as fractions of the frame (matches the SVG guide in FaceGuide.tsx). */
export const OVAL = { cx: 0.5, cy: 0.43, rx: 0.34, ry: 0.32 } as const;

export interface FrameStats {
  /** Mean luminance of the whole frame, 0-255. */
  mean: number;
  /** Mean luminance inside the face oval. */
  center: number;
  /** Mean luminance outside the oval. */
  edge: number;
  /** Standard deviation of the luminance: ~0 for a covered lens or a flat wall. */
  spread: number;
}

/** Y = 0.299R + 0.587G + 0.114B for every RGBA pixel, as a flat array. */
export function toLuma(data: ArrayLike<number>, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    const o = i * 4;
    out[i] = 0.299 * (data[o] ?? 0) + 0.587 * (data[o + 1] ?? 0) + 0.114 * (data[o + 2] ?? 0);
  }
  return out;
}

export function analyzeLuma(luma: ArrayLike<number>, width: number, height: number): FrameStats {
  let sum = 0;
  let sumSq = 0;
  let centerSum = 0;
  let centerN = 0;
  let edgeSum = 0;
  let edgeN = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = luma[y * width + x] ?? 0;
      sum += v;
      sumSq += v * v;
      const dx = ((x + 0.5) / width - OVAL.cx) / OVAL.rx;
      const dy = ((y + 0.5) / height - OVAL.cy) / OVAL.ry;
      if (dx * dx + dy * dy <= 1) {
        centerSum += v;
        centerN += 1;
      } else {
        edgeSum += v;
        edgeN += 1;
      }
    }
  }
  const n = width * height || 1;
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return {
    mean,
    center: centerN ? centerSum / centerN : mean,
    edge: edgeN ? edgeSum / edgeN : mean,
    spread: Math.sqrt(variance),
  };
}

/** Mean absolute luminance difference between two frames of the same size (0 = identical). */
export function frameMotion(prev: ArrayLike<number> | null, next: ArrayLike<number>): number {
  if (!prev || prev.length !== next.length || next.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < next.length; i += 1) sum += Math.abs((next[i] ?? 0) - (prev[i] ?? 0));
  return sum / next.length;
}

export type LightingHint = 'ok' | 'too-dark' | 'too-bright' | 'backlit' | 'covered' | 'shaky';

// Thresholds are on a 0-255 scale. A properly lit face reads roughly 90-200 in the oval; the
// numbers leave a wide "ok" band because a false warning is worse than a missed one (it never
// blocks the shot, it only advises).
export const THRESHOLDS = {
  coveredMean: 12,
  coveredSpread: 6,
  tooDark: 55,
  tooBright: 225,
  backlitGap: 55,
  backlitCenterMax: 120,
  shakyMotion: 14,
} as const;

export function classifyLighting(stats: FrameStats, motion = 0): LightingHint {
  if (stats.mean < THRESHOLDS.coveredMean && stats.spread < THRESHOLDS.coveredSpread) return 'covered';
  if (stats.center < THRESHOLDS.tooDark) return 'too-dark';
  if (stats.center > THRESHOLDS.tooBright) return 'too-bright';
  if (stats.edge - stats.center > THRESHOLDS.backlitGap && stats.center < THRESHOLDS.backlitCenterMax) return 'backlit';
  if (motion > THRESHOLDS.shakyMotion) return 'shaky';
  return 'ok';
}

export interface HintCopy {
  /** Short chip text over the viewfinder. */
  text: string;
  /** True for "all good": the chip is neutral with a check instead of a warning mark. */
  good: boolean;
}

export const HINT_COPY: Record<LightingHint, HintCopy> = {
  ok: { text: 'Wajah di tengah, cahaya baik', good: true },
  'too-dark': { text: 'Terlalu gelap, cari cahaya', good: false },
  'too-bright': { text: 'Terlalu terang, hindari sinar langsung', good: false },
  backlit: { text: 'Cahaya dari belakang, hadapkan wajah ke cahaya', good: false },
  covered: { text: 'Kamera tampak tertutup', good: false },
  shaky: { text: 'Tahan ponsel agar tidak goyang', good: false },
};

export interface HintState {
  /** What the chip shows. */
  shown: LightingHint;
  /** The newest observation that differs from `shown`, and how many samples in a row agreed on it. */
  candidate: LightingHint | null;
  streak: number;
}

export const INITIAL_HINT_STATE: HintState = { shown: 'ok', candidate: null, streak: 0 };

/**
 * Debounce for the chip: a new hint has to be observed twice in a row (about a second) before it
 * replaces the one on screen, so one dark frame while the camera adjusts its exposure, or one
 * shaky sample, does not make the chip flicker. Going back to "ok" is immediate: good news is
 * never delayed.
 */
export function nextHintState(state: HintState, observed: LightingHint, required = 2): HintState {
  if (observed === state.shown) return { shown: state.shown, candidate: null, streak: 0 };
  if (observed === 'ok') return { shown: 'ok', candidate: null, streak: 0 };
  const streak = state.candidate === observed ? state.streak + 1 : 1;
  if (streak >= required) return { shown: observed, candidate: null, streak: 0 };
  return { shown: state.shown, candidate: observed, streak };
}
