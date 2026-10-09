import { describe, it, expect } from 'vitest';
import {
  HARD_MAX_BYTES,
  JPEG_QUALITIES,
  MAX_EDGE_PX,
  TARGET_BYTES,
  centerCropRect,
  fitWithin,
  formatBytes,
  nextQuality,
  planOutput,
} from '../lib/image-compress';

describe('centerCropRect (3:4 portrait, the region the viewfinder shows)', () => {
  it('trims the sides of a landscape webcam frame (640x480 -> 360x480, centered)', () => {
    expect(centerCropRect(640, 480)).toEqual({ x: 140, y: 0, w: 360, h: 480 });
  });

  it('trims top and bottom of a tall 9:16 phone frame (720x1280 -> 720x960)', () => {
    expect(centerCropRect(720, 1280)).toEqual({ x: 0, y: 160, w: 720, h: 960 });
  });

  it('keeps an exact 3:4 frame whole', () => {
    expect(centerCropRect(960, 1280)).toEqual({ x: 0, y: 0, w: 960, h: 1280 });
  });

  it('never exceeds the source and always has the 3:4 ratio (within one pixel of rounding)', () => {
    for (const [w, h] of [[1920, 1080], [1280, 720], [4032, 3024], [3024, 4032], [100, 100], [1, 1]] as const) {
      const r = centerCropRect(w, h);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(w);
      expect(r.y + r.h).toBeLessThanOrEqual(h);
      if (r.w > 8) expect(Math.abs(r.w / r.h - 3 / 4)).toBeLessThan(0.01);
    }
  });

  it('degenerate frames give an empty rect instead of NaN', () => {
    expect(centerCropRect(0, 480)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(centerCropRect(640, -1)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('fitWithin (long edge <= 1024, never upscale)', () => {
  it('scales a big portrait photo down so its long edge is 1024', () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: 1024 });
  });

  it('leaves a smaller frame alone', () => {
    expect(fitWithin(360, 480)).toEqual({ width: 360, height: 480 });
  });

  it('honours a custom limit and keeps at least one pixel', () => {
    expect(fitWithin(800, 600, 400)).toEqual({ width: 400, height: 300 });
    expect(fitWithin(10_000, 1, 100)).toEqual({ width: 100, height: 1 });
    expect(fitWithin(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe('planOutput', () => {
  it('a 1280x960 webcam frame becomes a 720x960 portrait (crop first, then fit)', () => {
    const plan = planOutput(1280, 960);
    expect(plan.crop).toEqual({ x: 280, y: 0, w: 720, h: 960 });
    expect([plan.width, plan.height]).toEqual([720, 960]);
    expect(plan.scale).toBe(1);
  });

  it('a 12 MP phone photo is cropped to 3:4 and scaled to 768x1024', () => {
    const plan = planOutput(4032, 3024);
    expect(plan.crop.h).toBe(3024);
    expect(plan.crop.w).toBe(2268);
    expect([plan.width, plan.height]).toEqual([768, 1024]);
    expect(plan.scale).toBeCloseTo(1024 / 3024, 4);
  });

  it('never upscales a small camera and the long edge never exceeds the limit', () => {
    for (const [w, h] of [[640, 480], [320, 240], [1920, 1080], [5000, 5000]] as const) {
      const plan = planOutput(w, h);
      expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(MAX_EDGE_PX);
      expect(plan.scale).toBeLessThanOrEqual(1);
    }
  });

  it('exposes the limits the upload API relies on', () => {
    expect(MAX_EDGE_PX).toBe(1024);
    expect(TARGET_BYTES).toBeLessThan(HARD_MAX_BYTES);
    expect(HARD_MAX_BYTES).toBeLessThan(2 * 1024 * 1024);
  });
});

describe('nextQuality', () => {
  it('walks 0.8 -> 0.5 and then runs out', () => {
    expect([0, 1, 2, 3].map(nextQuality)).toEqual([...JPEG_QUALITIES]);
    expect(nextQuality(0)).toBe(0.8);
    expect(nextQuality(4)).toBeNull();
    expect(nextQuality(-1)).toBeNull();
  });
});

describe('formatBytes (Indonesian decimals)', () => {
  it('rounds to KB below a megabyte and uses a comma above', () => {
    expect(formatBytes(98_304)).toBe('96 KB');
    expect(formatBytes(100)).toBe('1 KB');
    expect(formatBytes(1_258_291)).toBe('1,2 MB');
    expect(formatBytes(-5)).toBe('0 KB');
    expect(formatBytes(Number.NaN)).toBe('0 KB');
  });
});
