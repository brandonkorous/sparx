/**
 * Linear barcodes: Code 128, Code 39, UPC-A, EAN-13 and EAN-8.
 *
 * Every symbology here comes out as a list of bar widths, in modules, starting
 * with a black bar and alternating. That single shape means the renderer draws
 * all five identically and nothing downstream has to know which is which — and
 * it means the guard bars in the EAN family, which are taller than the rest, are
 * expressed as positions rather than as a special case in the drawing code.
 *
 * ── THE CHECK DIGIT IS THE WHOLE POINT ──────────────────────────────────────
 *
 * The last digit of a UPC or EAN is arithmetic on the ones before it. A scanner
 * recalculates it on every read and rejects the scan if it disagrees, which is
 * why a smudged label beeps angrily instead of quietly ringing up the wrong
 * item. A generator that gets this wrong produces labels that fail at the till,
 * so the maths is checked against published examples in the scratchpad rather
 * than trusted.
 */

export type Symbology = 'code128' | 'code39' | 'upca' | 'ean13' | 'ean8';

export const SYMBOLOGIES: {
  value: Symbology;
  label: string;
  blurb: string;
  /** What a person is allowed to type. */
  hint: string;
}[] = [
  {
    value: 'code128',
    label: 'Code 128',
    blurb:
      'Letters and numbers, any length, no registration. The right answer for shelf labels, bins, internal codes and asset tags.',
    hint: 'Letters, numbers and punctuation. Any length.',
  },
  {
    value: 'ean13',
    label: 'EAN-13',
    blurb:
      'The thirteen-digit retail barcode used across most of the world. The numbers must be bought from GS1 to sell through shops.',
    hint: '12 digits — the 13th is the check digit and is worked out for you.',
  },
  {
    value: 'upca',
    label: 'UPC-A',
    blurb:
      'The twelve-digit North American retail barcode. Same system as EAN-13, one digit shorter.',
    hint: '11 digits — the 12th is the check digit and is worked out for you.',
  },
  {
    value: 'ean8',
    label: 'EAN-8',
    blurb:
      'The short retail barcode, for packaging too small to carry a full one — lip balm, spice jars.',
    hint: '7 digits — the 8th is the check digit and is worked out for you.',
  },
  {
    value: 'code39',
    label: 'Code 39',
    blurb:
      'The older letters-and-numbers standard. Bulkier than Code 128 and still required by some warehouse and defence systems.',
    hint: 'A–Z, 0–9, and - . $ / + % and space.',
  },
];

export interface BarcodeResult {
  /** Bar widths in modules, alternating black, white, black… starting black. */
  bars: number[];
  /** Total width in modules, so a renderer can scale without re-adding. */
  modules: number;
  /** What to print under the bars. Includes the computed check digit. */
  text: string;
  /** Module positions where a taller guard bar is drawn, for the EAN family. */
  guards: { start: number; end: number }[];
}

export class BarcodeError extends Error {}

// ── CHECK DIGITS ────────────────────────────────────────────────────────────

/**
 * The modulo-10 check digit shared by UPC and EAN.
 *
 * Digits are weighted 3 and 1 alternately, counting from the RIGHT of the body —
 * which is why the weighting differs between UPC-A (11 body digits, odd) and
 * EAN-13 (12 body digits, even), and why implementations that hardcode "start
 * with 3" work for one and fail for the other. Counting from the right removes
 * the special case entirely.
 */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  const digits = [...body].reverse();
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

// ── CODE 128 ────────────────────────────────────────────────────────────────

/** The 107 patterns, each six bar widths. Index is the code value. */
const CODE128 = [
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

/**
 * Encode as Code 128, choosing set B or set C.
 *
 * Set C packs two digits into one symbol, which nearly halves the width of a
 * numeric code — worth taking automatically whenever the whole input is digits
 * and there is an even number of them. Anything else uses set B, which covers
 * the printable ASCII range.
 *
 * Deliberately no mid-string switching between the sets. It saves a few modules
 * on mixed input like "SKU-00012345", costs a genuinely fiddly state machine,
 * and every extra branch here is a chance to emit a label that does not scan.
 */
export function encodeCode128(text: string): BarcodeResult {
  if (text.length === 0) throw new BarcodeError('Type something to put in the barcode.');

  if (/[^\x20-\x7e]/.test(text)) {
    throw new BarcodeError('Code 128 handles ordinary letters, numbers and punctuation only.');
  }

  const numericPairs = /^\d+$/.test(text) && text.length % 2 === 0 && text.length >= 4;
  const values: number[] = [];

  if (numericPairs) {
    values.push(CODE128_START_C);
    for (let i = 0; i < text.length; i += 2) values.push(Number(text.slice(i, i + 2)));
  } else {
    values.push(CODE128_START_B);
    for (const char of text) values.push(char.charCodeAt(0) - 32);
  }

  // The checksum is a weighted sum where the start symbol counts once and each
  // subsequent symbol counts by its position.
  let sum = values[0]!;
  for (let i = 1; i < values.length; i++) sum += values[i]! * i;
  values.push(sum % 103);
  values.push(CODE128_STOP);

  const bars: number[] = [];
  for (const value of values) {
    for (const width of CODE128[value]!) bars.push(Number(width));
  }

  return {
    bars,
    modules: bars.reduce((a, b) => a + b, 0),
    text,
    guards: [],
  };
}

// ── CODE 39 ─────────────────────────────────────────────────────────────────

const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

/** Wide bars are 2.5× the narrow ones in the standard; 3× is used here because
 *  it keeps every width a whole number of modules, which is what makes the
 *  result print crisply at any scale instead of landing on half a pixel. */
export function encodeCode39(text: string): BarcodeResult {
  const upper = text.toUpperCase();
  if (upper.length === 0) throw new BarcodeError('Type something to put in the barcode.');

  const bad = [...upper].find((c) => !(c in CODE39) || c === '*');
  if (bad) {
    throw new BarcodeError(
      `Code 39 cannot encode “${bad === ' ' ? 'space' : bad}”. It handles A–Z, 0–9 and - . $ / + % and space.`
    );
  }

  const bars: number[] = [];
  const chars = ['*', ...upper, '*'];
  chars.forEach((char, index) => {
    for (const w of CODE39[char]!) bars.push(w === 'w' ? 3 : 1);
    // One narrow gap between characters, but not trailing off the end.
    if (index < chars.length - 1) bars.push(1);
  });

  return { bars, modules: bars.reduce((a, b) => a + b, 0), text: upper, guards: [] };
}

// ── THE EAN / UPC FAMILY ────────────────────────────────────────────────────

const EAN_L = [
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
const EAN_G = [
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
const EAN_R = [
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

/** Which of L and G the first six digits use — the pattern itself encodes the
 *  thirteenth digit, which is why EAN-13 fits thirteen digits into twelve
 *  positions. It is a genuinely elegant piece of design and completely invisible
 *  to everybody who uses it. */
const EAN13_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

/** Turn a run of 0/1 modules into alternating bar widths starting with black.
 *  The patterns above are written as bits because that is how the standard
 *  prints them; the renderer wants widths. */
function bitsToBars(bits: string): number[] {
  const bars: number[] = [];
  let current = '1';
  let run = 0;
  // Always start on black: if the pattern opens with white, emit a zero-width
  // black bar so the alternation stays honest.
  for (const bit of bits) {
    if (bit === current) run++;
    else {
      bars.push(run);
      current = bit;
      run = 1;
    }
  }
  bars.push(run);
  return bars;
}

function eanBits(
  digits: string,
  kind: 'ean13' | 'upca' | 'ean8'
): { bits: string; guards: { start: number; end: number }[] } {
  const NORMAL = '101';
  const CENTRE = '01010';

  if (kind === 'ean8') {
    let bits = NORMAL;
    for (const d of digits.slice(0, 4)) bits += EAN_L[Number(d)]!;
    bits += CENTRE;
    for (const d of digits.slice(4)) bits += EAN_R[Number(d)]!;
    bits += NORMAL;
    return {
      bits,
      guards: [
        { start: 0, end: 3 },
        { start: 3 + 28, end: 3 + 28 + 5 },
        { start: bits.length - 3, end: bits.length },
      ],
    };
  }

  // UPC-A is EAN-13 with a leading zero. Treating it that way rather than as its
  // own symbology removes a whole duplicate encoder — the only real difference
  // is how the digits are laid out under the bars.
  const full = kind === 'upca' ? `0${digits}` : digits;
  const parity = EAN13_PARITY[Number(full[0])]!;

  let bits = NORMAL;
  for (let i = 0; i < 6; i++) {
    const d = Number(full[i + 1]);
    bits += parity[i] === 'L' ? EAN_L[d]! : EAN_G[d]!;
  }
  bits += CENTRE;
  for (let i = 7; i < 13; i++) bits += EAN_R[Number(full[i])]!;
  bits += NORMAL;

  return {
    bits,
    guards: [
      { start: 0, end: 3 },
      { start: 3 + 42, end: 3 + 42 + 5 },
      { start: bits.length - 3, end: bits.length },
    ],
  };
}

export function encodeEan(input: string, kind: 'ean13' | 'upca' | 'ean8'): BarcodeResult {
  const digits = input.replace(/\D/g, '');
  const bodyLength = kind === 'ean13' ? 12 : kind === 'upca' ? 11 : 7;
  const fullLength = bodyLength + 1;
  const name = kind === 'ean13' ? 'EAN-13' : kind === 'upca' ? 'UPC-A' : 'EAN-8';

  if (digits.length === 0) {
    throw new BarcodeError(`Type ${bodyLength} digits and the check digit gets added for you.`);
  }
  if (digits.length !== bodyLength && digits.length !== fullLength) {
    throw new BarcodeError(
      `${name} needs ${bodyLength} digits (or ${fullLength} if you are including the check digit). You have ${digits.length}.`
    );
  }

  const body = digits.slice(0, bodyLength);
  const check = gs1CheckDigit(body);

  // If they pasted a full code, verify rather than silently replacing the last
  // digit — a mismatch means the number they have is wrong, and that is worth
  // knowing before it goes on ten thousand labels.
  if (digits.length === fullLength && Number(digits[bodyLength]) !== check) {
    throw new BarcodeError(
      `That number's check digit does not add up — it ends ${digits[bodyLength]} but should end ${check}. Either the number has a typo, or drop the last digit and let it be calculated.`
    );
  }

  const full = `${body}${check}`;
  const { bits, guards } = eanBits(full, kind);

  return { bars: bitsToBars(bits), modules: bits.length, text: full, guards };
}

export function encodeBarcode(text: string, symbology: Symbology): BarcodeResult {
  switch (symbology) {
    case 'code128':
      return encodeCode128(text);
    case 'code39':
      return encodeCode39(text);
    default:
      return encodeEan(text, symbology);
  }
}

/**
 * Render to SVG.
 *
 * SVG rather than canvas as the primary output, because a barcode is nearly
 * always printed and a printed barcode is where scaling artefacts stop it
 * scanning. Vector output has no resolution to get wrong.
 *
 * The quiet zone is not optional and is not a margin for looks: a scanner needs
 * plain space either side to find where the code begins, and the single most
 * common reason a printed barcode fails is somebody cropping it off.
 */
export function barcodeSvg(
  result: BarcodeResult,
  opts: { moduleWidth: number; height: number; showText: boolean; quietZone?: number }
): string {
  const quiet = opts.quietZone ?? 10;
  const totalModules = result.modules + quiet * 2;
  const width = totalModules * opts.moduleWidth;
  const textHeight = opts.showText ? 22 : 0;
  const guardExtra = result.guards.length > 0 && opts.showText ? 10 : 0;
  const height = opts.height + textHeight;

  const isGuard = (start: number, end: number) =>
    result.guards.some((g) => start >= g.start && end <= g.end);

  let x = quiet;
  const rects: string[] = [];
  result.bars.forEach((barWidth, i) => {
    if (i % 2 === 0 && barWidth > 0) {
      const tall = isGuard(x - quiet, x - quiet + barWidth);
      rects.push(
        `<rect x="${(x * opts.moduleWidth).toFixed(2)}" y="0" width="${(barWidth * opts.moduleWidth).toFixed(2)}" height="${opts.height + (tall ? guardExtra : 0)}" fill="#000"/>`
      );
    }
    x += barWidth;
  });

  const label = opts.showText
    ? `<text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-family="monospace" font-size="16" letter-spacing="2" fill="#000">${result.text.replace(/[<&]/g, '')}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Barcode: ${result.text.replace(/[<&"]/g, '')}"><rect width="${width}" height="${height}" fill="#fff"/>${rects.join('')}${label}</svg>`;
}
