/**
 * Wraps PNG images in a .ico container (ICONDIR + one ICONDIRENTRY per image + the PNG
 * bytes themselves). PNG-in-ICO is supported by every browser still worth targeting, and
 * saves shipping a second, hand-rasterized bitmap format. Used by app/favicon.ico/route.ts
 * so /favicon.ico — which crawlers, link unfurlers and older Safari request by path
 * regardless of any <link> tag — returns a real icon instead of a 404.
 */
export interface IcoImage {
  /** Edge length in pixels (icons are square). 256 is stored as 0 per the ICO spec. */
  size: number;
  png: Uint8Array;
}

export function pngsToIco(images: IcoImage[]): Uint8Array<ArrayBuffer> {
  const headerSize = 6 + 16 * images.length;
  const total = headerSize + images.reduce((sum, img) => sum + img.png.byteLength, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: 1 = icon
  view.setUint16(4, images.length, true);

  let offset = headerSize;
  images.forEach((img, i) => {
    const entry = 6 + 16 * i;
    const dim = img.size >= 256 ? 0 : img.size;
    view.setUint8(entry, dim); // width
    view.setUint8(entry + 1, dim); // height
    view.setUint8(entry + 2, 0); // palette colors (none)
    view.setUint8(entry + 3, 0); // reserved
    view.setUint16(entry + 4, 1, true); // color planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, img.png.byteLength, true);
    view.setUint32(entry + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.byteLength;
  });

  return out;
}
