/**
 * Build a Windows `.ico` from PNG-encoded images.
 *
 * Every "favicon generator" online still ships a single 16×16 BMP-encoded .ico;
 * modern browsers and Windows (Vista+) read PNG-encoded icons inside the .ico
 * container, so we embed real 16/32/48 PNGs at full 32-bit color. The format is
 * a 6-byte header, one 16-byte directory entry per image, then the PNG blobs
 * concatenated — small enough to hand-roll, with no dependency.
 */

export interface IcoImage {
  /** Edge length in px (16, 32, 48…). 256 is encoded as 0 per the spec. */
  size: number;
  /** PNG bytes for this size. */
  png: Uint8Array;
}

/** Encode a multi-resolution `.ico` Blob from the given PNG images. */
export function createIco(images: IcoImage[]): Blob {
  const count = images.length;
  const headerSize = 6 + count * 16;
  const header = new Uint8Array(headerSize);
  const dv = new DataView(header.buffer);

  dv.setUint16(0, 0, true); // reserved
  dv.setUint16(2, 1, true); // type: 1 = icon
  dv.setUint16(4, count, true); // image count

  let offset = headerSize;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    const dim = img.size >= 256 ? 0 : img.size;
    header[e] = dim; // width
    header[e + 1] = dim; // height
    header[e + 2] = 0; // palette size (0 = no palette)
    header[e + 3] = 0; // reserved
    dv.setUint16(e + 4, 1, true); // color planes
    dv.setUint16(e + 6, 32, true); // bits per pixel
    dv.setUint32(e + 8, img.png.length, true); // image data size
    dv.setUint32(e + 12, offset, true); // image data offset
    offset += img.png.length;
  });

  return new Blob([header, ...images.map((i) => i.png)] as BlobPart[], { type: 'image/x-icon' });
}
