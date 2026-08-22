// Barcode encoding — value in, bars out (docs/146 Phase 3.2–3.3).
//
// Pure module arithmetic: no DOM, no canvas, no dependency. It returns the bar
// pattern and leaves drawing to whoever is drawing — the workbench renders it as
// inline SVG, and the same function can render a label server-side when PDFs
// move off the client.
//
// ── Why this is written rather than installed ────────────────────────────────
//
// A barcode symbology is a published table and a checksum. The encoding is
// forty lines around a lookup; the rest of a rendering library is drawing, which
// we already do with SVG. Owning it means label output has no runtime
// dependency, works identically on the server, and cannot break because a
// package changed its default module width. It sits beside the check-digit maths
// in `./barcodes` for the same reason that does: one implementation, so a label
// printed in the browser and a label validated on the server agree.
//
// ── What is supported, and what deliberately is not ──────────────────────────
//
// Code 128 (auto A/B/C), UPC-A, UPC-E, EAN-13, EAN-8 and ITF-14 — every
// symbology the registry can store as a linear code. QR is 2D and belongs to a
// different renderer entirely (the workbench already uses `qrcode` for shelf
// labels). Code 39 is not encoded here: it is a legacy format we ACCEPT from
// tenants who already have it, and printing new ones would be encouraging a
// symbology with no check digit and a third of the density of Code 128.

import { detectSymbology, expandUpcE, gs1CheckDigit, normalizeBarcode } from './barcodes';
import type { BarcodeSymbology } from './barcodes';

/**
 * A rendered barcode as alternating module runs.
 *
 * `bars[0]` is a BAR, `bars[1]` a space, and so on. Widths are in modules — the
 * narrowest unit — so the caller picks a physical size by choosing what a module
 * is worth in millimetres. Total width is the sum.
 */
export interface EncodedBarcode {
  symbology: BarcodeSymbology;
  /** Alternating bar/space widths in modules, starting with a bar. */
  bars: number[];
  /** Sum of `bars` — the full width in modules. */
  width: number;
  /** The value as encoded, which may differ from the input (a UPC-E expands). */
  value: string;
  /**
   * How the human-readable line is grouped under the bars. UPC-A prints its
   * first and last digit outside the guard bars; EAN-13 prints its first digit
   * to the left. Anything else is one group.
   */
  textGroups: { text: string; startModule: number; endModule: number }[];
}

// ─── Code 128 ──────────────────────────────────────────────────────────────────
//
// 107 symbols, each 11 modules described as six alternating widths, plus a
// 13-module stop. The published table, verbatim.

const CODE128_PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];

const CODE128_START_B = 104;
const CODE128_START_C = 105;
const CODE128_STOP = 106;
/** Switch from B to C, and back. */
const CODE128_CODE_C = 99;
const CODE128_CODE_B = 100;

const DIGITS = /^[0-9]+$/;

/**
 * How many digits start at `from`.
 *
 * Set C packs two digits into one symbol, so a long digit run halves. The
 * thresholds below are the standard ones: it pays off at four digits mid-string
 * and at two when the string starts or ends there, because the switch itself
 * costs a symbol.
 */
function digitRunLength(value: string, from: number): number {
  let n = 0;
  while (from + n < value.length && value[from + n]! >= '0' && value[from + n]! <= '9') n += 1;
  return n;
}

/**
 * Encode to Code 128 symbol values, switching between set B and set C wherever
 * C is shorter. Auto mode: nobody printing a shelf label wants to choose a
 * character set, and choosing wrong costs width rather than correctness.
 */
function code128Values(value: string): number[] {
  const out: number[] = [];
  let mode: 'B' | 'C' | null = null;
  let i = 0;

  while (i < value.length) {
    const run = digitRunLength(value, i);
    // C is worth entering for an even run of 4+, or 2+ when it reaches the end
    // or starts the string — the switch symbol has to pay for itself.
    const wantC =
      run >= 4 || (run >= 2 && (i === 0 || i + run === value.length)) ? run >= 2 : false;

    if (wantC && run >= 2) {
      const pairs = Math.floor(run / 2);
      if (mode !== 'C') {
        out.push(mode === null ? CODE128_START_C : CODE128_CODE_C);
        mode = 'C';
      }
      for (let p = 0; p < pairs; p += 1) {
        out.push(Number(value.slice(i, i + 2)));
        i += 2;
      }
      continue;
    }

    if (mode !== 'B') {
      out.push(mode === null ? CODE128_START_B : CODE128_CODE_B);
      mode = 'B';
    }
    const code = value.charCodeAt(i);
    if (code < 32 || code > 126) {
      throw new Error(`Code 128 (set B) cannot encode character ${JSON.stringify(value[i])}`);
    }
    out.push(code - 32);
    i += 1;
  }

  if (out.length === 0) throw new Error('Cannot encode an empty barcode');
  return out;
}

function code128(value: string): EncodedBarcode {
  const values = code128Values(value);
  // Checksum: start value plus each data symbol weighted by its 1-based
  // position, modulo 103. The start symbol is position zero and is not weighted.
  let sum = values[0]!;
  for (let i = 1; i < values.length; i += 1) sum += values[i]! * i;
  values.push(sum % 103);
  values.push(CODE128_STOP);

  const bars: number[] = [];
  for (const v of values) {
    for (const ch of CODE128_PATTERNS[v]!) bars.push(Number(ch));
  }
  const width = bars.reduce((a, b) => a + b, 0);
  return {
    symbology: 'code_128',
    bars,
    width,
    value,
    textGroups: [{ text: value, startModule: 0, endModule: width }],
  };
}

// ─── The EAN/UPC family ────────────────────────────────────────────────────────
//
// Seven modules per digit, three encodings. `A` is odd-parity left, `B` is
// even-parity left, `C` is the right side. Which of A/B a left digit uses is
// what encodes the 13th digit of an EAN-13, and it is the only place in the
// symbology where information is carried by parity rather than by bars.

const EAN_A = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const EAN_B = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const EAN_C = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];

/** Which of A/B each of the six left digits uses, indexed by the first digit. */
const EAN13_PARITY = [
  'AAAAAA',
  'AABABB',
  'AABBAB',
  'AABBBA',
  'ABAABB',
  'ABBAAB',
  'ABBBAA',
  'ABABAB',
  'ABABBA',
  'ABBABA',
];

/** Left/right guard, and the centre. */
const GUARD = '101';
const CENTRE = '01010';

/** Turn a module bitstring into alternating run lengths, starting with a bar. */
function runsFromBits(bits: string): number[] {
  const runs: number[] = [];
  // The pattern always starts with a bar (guard is 101), so run parity is fixed
  // and a leading space would silently invert the whole symbol.
  let current = '1';
  let count = 0;
  for (const bit of bits) {
    if (bit === current) {
      count += 1;
    } else {
      runs.push(count);
      current = bit;
      count = 1;
    }
  }
  runs.push(count);
  return runs;
}

function ean13(digits: string, symbology: BarcodeSymbology): EncodedBarcode {
  const parity = EAN13_PARITY[Number(digits[0])]!;
  let bits = GUARD;
  for (let i = 0; i < 6; i += 1) {
    const d = Number(digits[i + 1]);
    bits += parity[i] === 'A' ? EAN_A[d]! : EAN_B[d]!;
  }
  bits += CENTRE;
  for (let i = 7; i < 13; i += 1) bits += EAN_C[Number(digits[i])]!;
  bits += GUARD;

  const bars = runsFromBits(bits);
  const width = bits.length;

  // UPC-A is an EAN-13 with a leading zero, and prints as one: the leading zero
  // is not shown, the first and last digits sit outside the guard bars, and the
  // two blocks of five sit under the bars. Getting this wrong is how a printed
  // label looks subtly like a fake.
  const textGroups =
    symbology === 'upc_a'
      ? [
          { text: digits[1]!, startModule: 0, endModule: 3 },
          { text: digits.slice(2, 7), startModule: 3, endModule: 45 },
          { text: digits.slice(7, 12), startModule: 50, endModule: 92 },
          { text: digits[12]!, startModule: 92, endModule: width },
        ]
      : [
          { text: digits[0]!, startModule: 0, endModule: 3 },
          { text: digits.slice(1, 7), startModule: 3, endModule: 45 },
          { text: digits.slice(7), startModule: 50, endModule: 92 },
        ];

  return {
    symbology,
    bars,
    width,
    value: symbology === 'upc_a' ? digits.slice(1) : digits,
    textGroups,
  };
}

function ean8(digits: string): EncodedBarcode {
  let bits = GUARD;
  for (let i = 0; i < 4; i += 1) bits += EAN_A[Number(digits[i])]!;
  bits += CENTRE;
  for (let i = 4; i < 8; i += 1) bits += EAN_C[Number(digits[i])]!;
  bits += GUARD;
  const width = bits.length;
  return {
    symbology: 'ean_8',
    bars: runsFromBits(bits),
    width,
    value: digits,
    textGroups: [
      { text: digits.slice(0, 4), startModule: 3, endModule: 31 },
      { text: digits.slice(4), startModule: 36, endModule: 64 },
    ],
  };
}

// ─── ITF-14 ────────────────────────────────────────────────────────────────────
//
// Interleaved 2 of 5: digits in pairs, the first drawn as bars and the second as
// the spaces between them. Wide bars are three modules, narrow one. It exists
// because it survives being printed directly onto corrugated cardboard, which
// is the only reason anyone still uses it.

const ITF_PATTERNS = [
  'nnwwn',
  'wnnnw',
  'nwnnw',
  'wwnnn',
  'nnwnw',
  'wnwnn',
  'nwwnn',
  'nnnww',
  'wnnwn',
  'nwnwn',
];

function itf14(digits: string): EncodedBarcode {
  const bars: number[] = [1, 1, 1, 1]; // start: narrow bar, narrow space, ×2
  for (let i = 0; i < digits.length; i += 2) {
    const barPattern = ITF_PATTERNS[Number(digits[i])]!;
    const spacePattern = ITF_PATTERNS[Number(digits[i + 1])]!;
    for (let k = 0; k < 5; k += 1) {
      bars.push(barPattern[k] === 'w' ? 3 : 1);
      bars.push(spacePattern[k] === 'w' ? 3 : 1);
    }
  }
  bars.push(3, 1, 1); // stop: wide bar, narrow space, narrow bar
  const width = bars.reduce((a, b) => a + b, 0);
  return {
    symbology: 'itf_14',
    bars,
    width,
    value: digits,
    textGroups: [{ text: digits, startModule: 0, endModule: width }],
  };
}

// ─── The one entry point ───────────────────────────────────────────────────────

/**
 * Encode a value for printing.
 *
 * Throws with a plain-language message rather than returning a broken pattern:
 * a label that prints but does not scan is worse than one that refuses to print,
 * because the first is found in the warehouse and the second at the desk.
 */
export function encodeBarcode(raw: string, declared?: BarcodeSymbology): EncodedBarcode {
  const symbology = declared ?? detectSymbology(raw);
  const value = normalizeBarcode(raw, symbology);

  switch (symbology) {
    case 'upc_a': {
      requireDigits(value, 12, 'UPC-A');
      requireCheckDigit(value, 'UPC-A');
      // Encoded as the EAN-13 it is, with the implicit leading zero.
      return ean13(`0${value}`, 'upc_a');
    }
    case 'upc_e': {
      const expanded = expandUpcE(value);
      if (!expanded) throw new Error('That is not a valid UPC-E code.');
      // Printed short, but the bars carry the full UPC-A so any scanner agrees
      // with what the registry holds.
      return ean13(`0${expanded}`, 'upc_a');
    }
    case 'ean_13':
      requireDigits(value, 13, 'EAN-13');
      requireCheckDigit(value, 'EAN-13');
      return ean13(value, 'ean_13');
    case 'ean_8':
      requireDigits(value, 8, 'EAN-8');
      requireCheckDigit(value, 'EAN-8');
      return ean8(value);
    case 'gtin_14':
    case 'itf_14':
      requireDigits(value, 14, 'GTIN-14');
      requireCheckDigit(value, 'GTIN-14');
      return itf14(value);
    case 'qr':
      throw new Error('QR codes are two-dimensional and are drawn by a different renderer.');
    case 'code_39':
      throw new Error(
        'Code 39 can be stored and scanned but is not printed here — use Code 128, which is denser and carries a check digit.'
      );
    default:
      return code128(value);
  }
}

function requireDigits(value: string, length: number, label: string): void {
  if (!DIGITS.test(value) || value.length !== length) {
    throw new Error(`${label} is ${length} digits — this one is ${JSON.stringify(value)}.`);
  }
}

function requireCheckDigit(value: string, label: string): void {
  const want = gs1CheckDigit(value.slice(0, -1));
  if (Number(value.slice(-1)) !== want) {
    throw new Error(`This ${label} should end in ${want} — it will not scan as printed.`);
  }
}

// ─── SVG ───────────────────────────────────────────────────────────────────────

export interface BarcodeSvgOptions {
  /** Module width in user units. 1 gives a viewBox measured in modules. */
  moduleWidth?: number;
  /** Bar height in the same units. */
  height?: number;
  /** Quiet zone each side, in modules. The spec minimum is 10; below that scanners miss. */
  quietZone?: number;
  /** Print the digits under the bars. */
  showText?: boolean;
  fontSize?: number;
  /** Bar color. Anything but near-black loses scans under a red laser. */
  color?: string;
}

/**
 * Render to standalone SVG markup.
 *
 * Deliberately color-parameterised rather than token-driven: this is INK ON
 * PAPER, not a screen surface. A theme-aware bar would print light grey in dark
 * mode and not scan, so the default is a hard black and the caller may override
 * only when they know what they are printing on.
 */
export function barcodeSvg(encoded: EncodedBarcode, options: BarcodeSvgOptions = {}): string {
  const mw = options.moduleWidth ?? 2;
  const height = options.height ?? 60;
  const quiet = options.quietZone ?? 10;
  const showText = options.showText ?? true;
  const fontSize = options.fontSize ?? 12;
  const color = options.color ?? '#000000';

  const textHeight = showText ? fontSize + 4 : 0;
  const totalWidth = (encoded.width + quiet * 2) * mw;
  const totalHeight = height + textHeight;

  const rects: string[] = [];
  let x = quiet;
  for (let i = 0; i < encoded.bars.length; i += 1) {
    const run = encoded.bars[i]!;
    if (i % 2 === 0) {
      rects.push(
        `<rect x="${(x * mw).toFixed(2)}" y="0" width="${(run * mw).toFixed(2)}" height="${height}" fill="${color}"/>`
      );
    }
    x += run;
  }

  const texts = showText
    ? encoded.textGroups.map((g) => {
        const centre = (quiet + (g.startModule + g.endModule) / 2) * mw;
        return `<text x="${centre.toFixed(2)}" y="${totalHeight - 2}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="${color}">${escapeXml(g.text)}</text>`;
      })
    : [];

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight}" width="${totalWidth.toFixed(2)}" height="${totalHeight}" role="img" aria-label="Barcode ${escapeXml(encoded.value)}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    ...rects,
    ...texts,
    `</svg>`,
  ].join('');
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;'
  );
}
