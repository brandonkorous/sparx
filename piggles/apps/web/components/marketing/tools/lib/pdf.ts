/**
 * A small PDF writer — enough for an invoice or a quote, and no more.
 *
 * ── WHY NOT A LIBRARY ───────────────────────────────────────────────────────
 *
 * The usual PDF libraries are 300KB to 1.5MB of JavaScript, shipped to somebody
 * who wanted one invoice. They are worth it if you need font embedding, vector
 * graphics, forms or tagged output. An invoice needs text, lines, boxes and a
 * logo, and that is about two hundred lines of the format.
 *
 * ── THE FOURTEEN FONTS YOU DO NOT HAVE TO EMBED ─────────────────────────────
 *
 * Every PDF reader is required to provide Helvetica, Times, Courier and Symbol
 * without them being included in the file. Using Helvetica means no font data,
 * no subsetting, no licensing question, and a document measured in kilobytes.
 * The cost is that only the WinAnsi character set is available — fine for Latin
 * text and currency symbols, not fine for Greek or Cyrillic, which is stated
 * plainly to anybody who types some.
 *
 * ── THE PART THAT LOOKS WRONG BUT IS NOT ────────────────────────────────────
 *
 * PDF measures from the BOTTOM-left corner, with y increasing upwards, which is
 * the opposite of every screen coordinate system. Rather than fight it, this
 * exposes a top-down API and flips once on the way out. Every y a caller passes
 * is measured from the top of the page, like everything else in the codebase.
 */

/** Helvetica and Helvetica-Bold advance widths, in 1/1000 em, for the printable
 *  ASCII range. Needed to right-align money columns and to know when a line of
 *  text will not fit — a PDF has no layout engine and nothing measures anything
 *  for you. */
const WIDTHS_REGULAR: Record<string, number> = {};
const WIDTHS_BOLD: Record<string, number> = {};
{
  const regular =
    '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584';
  const bold =
    '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584';
  regular.split(' ').forEach((w, i) => (WIDTHS_REGULAR[String.fromCharCode(32 + i)] = Number(w)));
  bold.split(' ').forEach((w, i) => (WIDTHS_BOLD[String.fromCharCode(32 + i)] = Number(w)));
}

export type PdfFont = 'regular' | 'bold';

export function textWidth(text: string, size: number, font: PdfFont = 'regular'): number {
  const table = font === 'bold' ? WIDTHS_BOLD : WIDTHS_REGULAR;
  let total = 0;
  for (const char of text) total += table[char] ?? 556;
  return (total * size) / 1000;
}

/** Break text into lines that fit a width. Words longer than the line are broken
 *  rather than allowed to run off the page — a long web address in an invoice
 *  note is the case that finds this. */
export function wrapText(
  text: string,
  width: number,
  size: number,
  font: PdfFont = 'regular'
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (word === '') continue;
      const candidate = line === '' ? word : `${line} ${word}`;
      if (textWidth(candidate, size, font) <= width) {
        line = candidate;
        continue;
      }
      if (line !== '') lines.push(line);
      if (textWidth(word, size, font) <= width) {
        line = word;
        continue;
      }
      // A single unbreakable run. Cut it where it stops fitting.
      let chunk = '';
      for (const char of word) {
        if (textWidth(chunk + char, size, font) > width) {
          lines.push(chunk);
          chunk = char;
        } else chunk += char;
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

/** Escape a string for a PDF literal, and drop anything WinAnsi cannot carry. */
function pdfString(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (code >= 32 && code <= 126) out += char;
    else if (code === 0x2019 || code === 0x2018) out += "'";
    else if (code === 0x201c || code === 0x201d) out += '"';
    else if (code === 0x2014 || code === 0x2013) out += '-';
    else if (code === 0xa3 || code === 0xa5 || code === 0xa9 || code === 0xae) {
      out += `\\${code.toString(8).padStart(3, '0')}`;
    } else if (code === 0x20ac)
      out += '\\200'; // euro, in WinAnsi's 0x80 slot
    else if (code > 126 && code < 256) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += '?';
  }
  return out;
}

export interface PdfImage {
  /** JPEG bytes. JPEG rather than PNG because a PDF can carry JPEG data
   *  UNTOUCHED — the format has a decoder for it built in — whereas a PNG has to
   *  be decompressed and re-deflated, which means shipping a deflate. */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

/** A4 in points, which is what PDF measures in. 72 points to the inch. */
export const A4 = { width: 595.28, height: 841.89 };

export class PdfDocument {
  private ops: string[] = [];
  private image: PdfImage | null = null;

  constructor(
    readonly width = A4.width,
    readonly height = A4.height
  ) {}

  /** Flip a top-down y into PDF's bottom-up space. */
  private y(top: number): number {
    return this.height - top;
  }

  text(
    content: string,
    x: number,
    top: number,
    opts: {
      size?: number;
      font?: PdfFont;
      color?: [number, number, number];
      align?: 'left' | 'right' | 'centre';
      width?: number;
    } = {}
  ): this {
    const size = opts.size ?? 10;
    const font = opts.font ?? 'regular';
    const [r, g, b] = opts.color ?? [0, 0, 0];

    let drawX = x;
    if (opts.align === 'right') drawX = x - textWidth(content, size, font);
    else if (opts.align === 'centre') drawX = x - textWidth(content, size, font) / 2;

    this.ops.push(
      'BT',
      `${r} ${g} ${b} rg`,
      `/${font === 'bold' ? 'FB' : 'FR'} ${size} Tf`,
      `1 0 0 1 ${drawX.toFixed(2)} ${(this.y(top) - size).toFixed(2)} Tm`,
      `(${pdfString(content)}) Tj`,
      'ET'
    );
    return this;
  }

  /** Text that wraps. Returns the height used, so a caller can lay out the next
   *  block without guessing. */
  paragraph(
    content: string,
    x: number,
    top: number,
    width: number,
    opts: {
      size?: number;
      font?: PdfFont;
      color?: [number, number, number];
      leading?: number;
    } = {}
  ): number {
    const size = opts.size ?? 10;
    const leading = opts.leading ?? size * 1.45;
    const lines = wrapText(content, width, size, opts.font);
    lines.forEach((line, i) => this.text(line, x, top + i * leading, { ...opts, size }));
    return lines.length * leading;
  }

  rect(
    x: number,
    top: number,
    width: number,
    height: number,
    color: [number, number, number]
  ): this {
    const [r, g, b] = color;
    this.ops.push(
      `${r} ${g} ${b} rg`,
      `${x.toFixed(2)} ${(this.y(top) - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`
    );
    return this;
  }

  line(
    x1: number,
    top1: number,
    x2: number,
    top2: number,
    color: [number, number, number],
    thickness = 0.6
  ): this {
    const [r, g, b] = color;
    this.ops.push(
      `${r} ${g} ${b} RG`,
      `${thickness} w`,
      `${x1.toFixed(2)} ${this.y(top1).toFixed(2)} m ${x2.toFixed(2)} ${this.y(top2).toFixed(2)} l S`
    );
    return this;
  }

  /** One image per document, which is all an invoice needs (a logo). */
  drawImage(image: PdfImage, x: number, top: number, width: number, height: number): this {
    this.image = image;
    this.ops.push(
      'q',
      `${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${(this.y(top) - height).toFixed(2)} cm`,
      '/Im0 Do',
      'Q'
    );
    return this;
  }

  /**
   * Assemble the file.
   *
   * The cross-reference table at the end lists the byte offset of every object,
   * which is why the whole document is built as bytes and measured as it goes: a
   * reader seeks by those offsets, and one that is wrong by a byte produces a
   * file that opens in some readers and not others.
   */
  build(): Blob {
    const content = this.ops.join('\n');
    const encoder = new TextEncoder();

    const objects: Uint8Array[] = [];
    const push = (body: string | Uint8Array) => {
      objects.push(typeof body === 'string' ? encoder.encode(body) : body);
      return objects.length; // object numbers are 1-based
    };

    const catalogNumber = 1;
    const pagesNumber = 2;
    const pageNumber = 3;
    const contentNumber = 4;
    const fontRegularNumber = 5;
    const fontBoldNumber = 6;
    const imageNumber = 7;

    const resources = [
      `/Font << /FR ${fontRegularNumber} 0 R /FB ${fontBoldNumber} 0 R >>`,
      this.image ? `/XObject << /Im0 ${imageNumber} 0 R >>` : '',
    ]
      .filter(Boolean)
      .join(' ');

    push(`${catalogNumber} 0 obj\n<< /Type /Catalog /Pages ${pagesNumber} 0 R >>\nendobj\n`);
    push(`${pagesNumber} 0 obj\n<< /Type /Pages /Kids [${pageNumber} 0 R] /Count 1 >>\nendobj\n`);
    push(
      `${pageNumber} 0 obj\n<< /Type /Page /Parent ${pagesNumber} 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] /Resources << ${resources} >> /Contents ${contentNumber} 0 R >>\nendobj\n`
    );
    push(
      `${contentNumber} 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream\nendobj\n`
    );
    push(
      `${fontRegularNumber} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`
    );
    push(
      `${fontBoldNumber} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
    );

    if (this.image) {
      const header = encoder.encode(
        `${imageNumber} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${this.image.width} /Height ${this.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${this.image.jpeg.length} >>\nstream\n`
      );
      const footer = encoder.encode('\nendstream\nendobj\n');
      const merged = new Uint8Array(header.length + this.image.jpeg.length + footer.length);
      merged.set(header, 0);
      merged.set(this.image.jpeg, header.length);
      merged.set(footer, header.length + this.image.jpeg.length);
      push(merged);
    }

    const head = encoder.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const offsets: number[] = [];
    let position = head.length;
    for (const object of objects) {
      offsets.push(position);
      position += object.length;
    }

    const xrefStart = position;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNumber} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    return new Blob([head, ...objects, encoder.encode(xref)] as BlobPart[], {
      type: 'application/pdf',
    });
  }
}

/** A canvas as JPEG bytes, ready to embed. Drawn onto white first because JPEG
 *  has no transparency and an unfilled logo would come out on black. */
export async function canvasToPdfImage(canvas: HTMLCanvasElement): Promise<PdfImage> {
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d');
  if (!ctx) throw new Error('This browser would not give us a canvas to draw on.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    flat.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
  );
  if (!blob) throw new Error('The logo could not be prepared for the PDF.');

  return {
    jpeg: new Uint8Array(await blob.arrayBuffer()),
    width: flat.width,
    height: flat.height,
  };
}
