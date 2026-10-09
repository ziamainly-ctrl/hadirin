// The heatmap's single-hue ramp: the primary token at five strengths (darker = more people showed
// up). One neutral hue, so the heatmap stays grayscale-readable and obeys "colour only on small
// marks". Shared by the client Heatmap and the server-rendered legend, so it lives in a plain module.

export type HeatLevel = 1 | 2 | 3 | 4 | 5;

const STRENGTH: Record<HeatLevel, number> = { 1: 10, 2: 22, 3: 38, 4: 62, 5: 88 };

/** A CSS colour for a heat level, resolved through the theme tokens (so dark mode needs nothing). */
export function heatColor(level: HeatLevel): string {
  return `color-mix(in oklab, var(--color-primary) ${STRENGTH[level]}%, transparent)`;
}

/** Text colour that stays readable on that fill. */
export function heatTextColor(level: HeatLevel): string {
  return level >= 4 ? 'var(--color-primary-fg)' : 'var(--color-text)';
}
