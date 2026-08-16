/**
 * Writing a Windows .ico file.
 *
 * An ICO is a tiny directory followed by its entries: a six-byte header, then a
 * sixteen-byte record per image, then the images themselves. Each record has to
 * carry the byte offset of its image, which is why the whole file is laid out
 * before anything is written — you cannot know the second image's offset until
 * the first one's length is known.
 *
 * ── PNG INSIDE, NOT BMP ─────────────────────────────────────────────────────
 *
 * The original format expects a headerless BMP with a separate one-bit
 * transparency mask, which is a genuinely unpleasant thing to write: the rows
 * run bottom to top, the channels are in the reverse order, every row is padded
 * to four bytes, and the mask is a second bitmap underneath the first.
 *
 * Since Windows Vista an entry may simply BE a PNG, which every browser and
 * every operating system in current use reads. So the sizes are encoded as PNG
 * by the canvas and dropped in whole. That is not a shortcut around the format —
 * it is the part of the format designed for exactly this, and it produces a file
 * a fraction of the size with proper alpha instead of a one-bit mask.
 */

export interface IcoEntry {
  size: number;
  png: ArrayBuffer;
}

export function buildIco(entries: IcoEntry[]): Blob {
  if (entries.length === 0) throw new Error('An .ico needs at least one image in it.');

  const HEADER = 6;
  const RECORD = 16;
  const directorySize = HEADER + RECORD * entries.length;

  const total = directorySize + entries.reduce((sum, e) => sum + e.png.byteLength, 0);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Header: reserved, type 1 (icon), how many images.
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, entries.length, true);

  let offset = directorySize;
  entries.forEach((entry, i) => {
    const at = HEADER + i * RECORD;

    // Width and height are single bytes, and 256 does not fit in one — the
    // format's answer is that ZERO MEANS 256. Writing 256 here truncates to 0
    // by accident and happens to work, which is the sort of thing that stops
    // working the day somebody adds a bounds check.
    view.setUint8(at, entry.size >= 256 ? 0 : entry.size);
    view.setUint8(at + 1, entry.size >= 256 ? 0 : entry.size);
    view.setUint8(at + 2, 0); // palette colours — 0 for anything truecolour
    view.setUint8(at + 3, 0); // reserved
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, entry.png.byteLength, true);
    view.setUint32(at + 12, offset, true);

    bytes.set(new Uint8Array(entry.png), offset);
    offset += entry.png.byteLength;
  });

  return new Blob([buffer], { type: 'image/x-icon' });
}
