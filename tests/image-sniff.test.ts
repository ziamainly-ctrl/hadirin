import { describe, it, expect } from 'vitest';
import { sniffImageType } from '../lib/image-sniff';

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => Uint8Array.from(Array.from(text).map((c) => c.charCodeAt(0)));

describe('sniffImageType', () => {
  it('recognises JPEG, PNG and WEBP by their signatures', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16))).toBe('image/jpeg');
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('image/png');
    expect(sniffImageType(Uint8Array.from([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBPVP8 ')]))).toBe('image/webp');
  });

  it('refuses a file that only claims to be an image', () => {
    expect(sniffImageType(ascii('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffImageType(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(ascii('GIF89a'))).toBeNull();
  });

  it('refuses a RIFF container that is not WEBP (a WAV, an AVI)', () => {
    expect(sniffImageType(Uint8Array.from([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVEfmt ')]))).toBeNull();
  });

  it('refuses empty and truncated input', () => {
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});
