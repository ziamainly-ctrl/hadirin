import { mascotSvg } from './mascot';

/** The tab icon / manifest SVG: rounded tile, tight crop on the face. Shared by
 * scripts/gen-brand-assets.ts (writes it to disk) and tests/brand-assets.test.ts (checks the
 * files on disk still match it). */
export function faviconSvg(): string {
  return mascotSvg({ framing: 'tight', rounded: true, idPrefix: 'hf' }) + '\n';
}
