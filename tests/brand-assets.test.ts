import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { faviconSvg } from '../lib/brand/assets';
import { pngsToIco } from '../lib/brand/ico';
import { mascotInner, mascotSvg } from '../lib/brand/mascot';

describe('brand assets', () => {
  // app/icon.svg and public/icon.svg are generated (npm run brand:generate) from
  // lib/brand/mascot.ts; a hand-edit or a forgotten regenerate would silently ship a stale icon.
  it.each(['app/icon.svg', 'public/icon.svg'])('%s is in sync with lib/brand/mascot.ts', (file) => {
    expect(readFileSync(join(process.cwd(), file), 'utf8')).toBe(faviconSvg());
  });

  it('is a self-contained SVG with no external references or text', () => {
    const svg = mascotSvg();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('<image');
  });

  it('prefixes every id so two inline copies never share a gradient or clip path', () => {
    const a = mascotInner({ idPrefix: 'aa' });
    const b = mascotInner({ idPrefix: 'bb' });
    const ids = (markup: string) => [...markup.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids(a).length).toBeGreaterThan(0);
    expect(ids(a).every((id) => id?.startsWith('aa-'))).toBe(true);
    expect(ids(b).every((id) => id?.startsWith('bb-'))).toBe(true);
    // every url(#...) reference points at an id defined in the same copy
    for (const ref of a.matchAll(/url\(#([^)]+)\)/g)) expect(ids(a)).toContain(ref[1]);
  });

  it('drops the lanyard when cropped tight, keeps it in the full framing', () => {
    expect(mascotInner({ framing: 'full' })).toContain('M116 218l8 44');
    expect(mascotInner({ framing: 'tight' })).not.toContain('M116 218l8 44');
  });
});

describe('pngsToIco', () => {
  const png = (n: number) => new Uint8Array(Array.from({ length: n }, (_, i) => i % 251));

  it('writes an ICONDIR header, one entry per image, and the PNG bytes at the recorded offsets', () => {
    const images = [
      { size: 48, png: png(40) },
      { size: 16, png: png(10) },
    ];
    const ico = pngsToIco(images);
    const view = new DataView(ico.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);
    expect(ico.byteLength).toBe(6 + 16 * 2 + 40 + 10);

    images.forEach((img, i) => {
      const entry = 6 + 16 * i;
      expect(view.getUint8(entry)).toBe(img.size);
      expect(view.getUint8(entry + 1)).toBe(img.size);
      expect(view.getUint32(entry + 8, true)).toBe(img.png.byteLength);
      const offset = view.getUint32(entry + 12, true);
      expect(Array.from(ico.slice(offset, offset + img.png.byteLength))).toEqual(Array.from(img.png));
    });
  });

  it('stores a 256px image as 0 (the ICO spec encoding)', () => {
    const ico = pngsToIco([{ size: 256, png: png(4) }]);
    expect(new DataView(ico.buffer).getUint8(6)).toBe(0);
  });
});
