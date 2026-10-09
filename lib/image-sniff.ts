// What an uploaded image really is, judged by its first bytes instead of the browser-declared
// `file.type`. /api/uploads used to store whatever the client called "image/jpeg", so an HTML or SVG file
// with that label was kept in the private store and later served to an admin's browser through
// /api/files. Pure and unit-tested (tests/image-sniff.test.ts).

export type SniffedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, PNG)) return 'image/png';
  // WEBP: "RIFF" <4-byte size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}
