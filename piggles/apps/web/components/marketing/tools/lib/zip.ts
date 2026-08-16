/**
 * A ZIP writer, storing files uncompressed.
 *
 * ── WHY NO COMPRESSION ──────────────────────────────────────────────────────
 *
 * Everything that goes in one of these archives is a PNG or an ICO, both of
 * which are already compressed — deflating them again saves a percent or two and
 * costs either a large dependency or several hundred lines of Huffman coding.
 * The format explicitly supports "stored" entries for exactly this case, and
 * every unzipping tool in existence handles them.
 *
 * The manifest and the HTML snippet are plain text and would genuinely compress,
 * and they are also about two kilobytes. Not worth a deflate implementation.
 *
 * ── WHAT IS EASY TO GET WRONG ───────────────────────────────────────────────
 *
 * The central directory at the end is not a nicety; an archive without it is
 * unreadable, and each of its records has to carry the exact byte offset of the
 * local header it describes. Everything is little-endian, and the date is stored
 * in the MS-DOS format from 1980 — six bits of it are the year counted from
 * 1980, and the seconds field has a resolution of two seconds because there were
 * not enough bits left.
 */

const textEncoder = new TextEncoder();

interface ZipFile {
  name: string;
  data: Uint8Array;
}

/** CRC-32, table-driven. Every entry carries one and unzipping tools check it,
 *  so a wrong CRC produces an archive that opens and then reports every file as
 *  corrupt — which looks like a broken download rather than a broken writer. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** The MS-DOS date and time fields. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export class ZipBuilder {
  private files: ZipFile[] = [];

  add(name: string, data: Uint8Array | ArrayBuffer | string): this {
    const bytes =
      typeof data === 'string'
        ? textEncoder.encode(data)
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : data;
    this.files.push({ name, data: bytes });
    return this;
  }

  build(): Blob {
    const now = new Date();
    const { time, date } = dosDateTime(now);

    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = textEncoder.encode(file.name);
      const crc = crc32(file.data);
      const size = file.data.length;

      // Local file header: 30 bytes plus the name.
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); // signature
      lv.setUint16(4, 20, true); // version needed: 2.0
      lv.setUint16(6, 0, true); // flags
      lv.setUint16(8, 0, true); // method 0 = stored
      lv.setUint16(10, time, true);
      lv.setUint16(12, date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true); // compressed size — same, since stored
      lv.setUint32(22, size, true); // uncompressed size
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true); // extra field length
      local.set(nameBytes, 30);

      localParts.push(local, file.data);

      // Central directory record: 46 bytes plus the name.
      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); // version made by
      cv.setUint16(6, 20, true); // version needed
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, time, true);
      cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true); // extra
      cv.setUint16(32, 0, true); // comment
      cv.setUint16(34, 0, true); // disk number
      cv.setUint16(36, 0, true); // internal attributes
      cv.setUint32(38, 0, true); // external attributes
      cv.setUint32(42, offset, true); // where the local header is
      central.set(nameBytes, 46);
      centralParts.push(central);

      offset += local.length + size;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);

    // End of central directory.
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true); // this disk
    ev.setUint16(6, 0, true); // disk with the central directory
    ev.setUint16(8, this.files.length, true);
    ev.setUint16(10, this.files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true); // where the central directory starts
    ev.setUint16(20, 0, true); // comment length

    return new Blob([...localParts, ...centralParts, end] as BlobPart[], {
      type: 'application/zip',
    });
  }
}
