import { describe, it, expect } from 'vitest';
import {
  INITIAL_HINT_STATE,
  OVAL,
  SAMPLE_H,
  SAMPLE_W,
  analyzeLuma,
  classifyLighting,
  frameMotion,
  nextHintState,
  toLuma,
  type HintState,
} from '../components/shared/checkin/light-meter';

/** A SAMPLE_W x SAMPLE_H luma frame: `inside` luminance in the face oval, `outside` elsewhere. */
function frame(inside: number, outside: number): Float32Array {
  const luma = new Float32Array(SAMPLE_W * SAMPLE_H);
  for (let y = 0; y < SAMPLE_H; y += 1) {
    for (let x = 0; x < SAMPLE_W; x += 1) {
      const dx = ((x + 0.5) / SAMPLE_W - OVAL.cx) / OVAL.rx;
      const dy = ((y + 0.5) / SAMPLE_H - OVAL.cy) / OVAL.ry;
      luma[y * SAMPLE_W + x] = dx * dx + dy * dy <= 1 ? inside : outside;
    }
  }
  return luma;
}

describe('toLuma / analyzeLuma', () => {
  it('weights green most (Rec. 601) and ignores alpha', () => {
    const luma = toLuma([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 0], 3, 1);
    expect(luma[0]).toBeCloseTo(76.245, 2);
    expect(luma[1]).toBeCloseTo(149.685, 2);
    expect(luma[2]).toBeCloseTo(29.07, 2);
  });

  it('separates the oval from its surroundings', () => {
    const stats = analyzeLuma(frame(140, 60), SAMPLE_W, SAMPLE_H);
    expect(stats.center).toBeCloseTo(140, 5);
    expect(stats.edge).toBeCloseTo(60, 5);
    expect(stats.mean).toBeGreaterThan(60);
    expect(stats.mean).toBeLessThan(140);
    expect(stats.spread).toBeGreaterThan(20);
  });

  it('a flat frame has no spread', () => {
    expect(analyzeLuma(frame(100, 100), SAMPLE_W, SAMPLE_H).spread).toBeCloseTo(0, 5);
  });
});

describe('classifyLighting', () => {
  const at = (inside: number, outside: number, motion = 0) => classifyLighting(analyzeLuma(frame(inside, outside), SAMPLE_W, SAMPLE_H), motion);

  it('a well lit face is ok', () => {
    expect(at(140, 120)).toBe('ok');
    expect(at(95, 90)).toBe('ok');
    expect(at(200, 180)).toBe('ok');
  });

  it('a dark face is too-dark, a washed out one too-bright', () => {
    expect(at(30, 30)).toBe('too-dark');
    expect(at(240, 250)).toBe('too-bright');
  });

  it('a covered lens (black, flat) is told apart from a merely dark room', () => {
    expect(at(2, 2)).toBe('covered');
    expect(at(30, 90)).toBe('too-dark');
  });

  it('a dim face against a bright window is backlit', () => {
    expect(at(90, 200)).toBe('backlit');
    // A bright face in front of a brighter wall is fine.
    expect(at(170, 230)).toBe('ok');
  });

  it('shaky only matters when the light is fine', () => {
    expect(at(140, 120, 20)).toBe('shaky');
    expect(at(30, 30, 20)).toBe('too-dark');
  });
});

describe('frameMotion', () => {
  it('is 0 without a previous frame or for identical frames, and the mean absolute difference otherwise', () => {
    const a = frame(100, 100);
    expect(frameMotion(null, a)).toBe(0);
    expect(frameMotion(a, a)).toBe(0);
    expect(frameMotion(frame(100, 100), frame(120, 80))).toBeGreaterThan(10);
    expect(frameMotion(new Float32Array(3), new Float32Array(4))).toBe(0);
  });
});

describe('nextHintState (debounced chip)', () => {
  const run = (observations: Parameters<typeof nextHintState>[1][], start: HintState = INITIAL_HINT_STATE) =>
    observations.reduce((state, observed) => nextHintState(state, observed), start);

  it('one odd sample does not change the chip', () => {
    expect(run(['too-dark']).shown).toBe('ok');
    expect(run(['too-dark', 'ok']).shown).toBe('ok');
  });

  it('two in a row do', () => {
    expect(run(['too-dark', 'too-dark']).shown).toBe('too-dark');
  });

  it('alternating warnings never settle', () => {
    expect(run(['too-dark', 'backlit', 'too-dark', 'backlit']).shown).toBe('ok');
  });

  it('good news is immediate', () => {
    const dark = run(['too-dark', 'too-dark']);
    expect(nextHintState(dark, 'ok').shown).toBe('ok');
  });

  it('switching directly between two warnings needs the streak too', () => {
    const dark = run(['too-dark', 'too-dark']);
    expect(nextHintState(dark, 'backlit').shown).toBe('too-dark');
    expect(run(['backlit', 'backlit'], dark).shown).toBe('backlit');
  });
});
