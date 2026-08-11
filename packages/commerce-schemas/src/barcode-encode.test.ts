// Barcode encoding (docs/146 Phase 3.2–3.3).
//
// A wrong bar pattern is discovered by somebody in a warehouse holding a printed
// sheet that will not scan, so the tables get verified rather than trusted.
// Three independent kinds of check, because none alone is sufficient:
//
//   1. STRUCTURAL INVARIANTS the published standards guarantee — every Code 128
//      symbol is eleven modules; the EAN right-hand table is the bitwise
//      complement of the left; the even-parity table is the right-hand table
//      reversed. A typo in any of the three tables breaks at least one of these.
//   2. ARITHMETIC against hand-computed examples, for the checksums.
//   3. A ROUND TRIP — an independent decoder in this file reads the bars back
//      and recovers the digits, including the leading digit that EAN-13 carries
//      only in the parity of the left half. That catches misplaced guards and a
//      wrong parity row, which the invariants cannot see.

import { describe, expect, it } from 'vitest';
import { barcodeSvg, encodeBarcode } from './barcode-encode';

// ─── 1. Structural invariants ──────────────────────────────────────────────────

// Re-derived here from the encoder's own output rather than imported, so the
// test is checking the tables the encoder actually uses.
function symbolWidths(value: string): number[] {
  const { bars } = encodeBarcode(value, 'code_128');
  const widths: number[] = [];
  for (let i = 0; i < bars.length; i += 6) {
    widths.push(bars.slice(i, i + 6).reduce((a, b) => a + b, 0));
  }
  return widths;
}

describe('Code 128 structure', () => {
  it('is eleven modules per symbol, with a thirteen-module stop', () => {
    // "AB" → start-B, A, B, checksum, stop = four 11s and one 13.
    const { bars, width } = encodeBarcode('AB', 'code_128');
    expect(width).toBe(11 * 4 + 13);
    expect(bars.length).toBe(6 * 4 + 7);
  });

  it('holds the eleven-module rule across a long mixed payload', () => {
    // Every group of six widths except the stop must sum to 11.
    const widths = symbolWidths('SPX-4471-A');
    for (const w of widths.slice(0, -1)) expect(w).toBe(11);
  });

  it('starts on a bar and ends on a bar', () => {
    // Runs alternate from index 0 = bar, so an odd length means it ends on one.
    // A pattern that ends on a space has lost its final bar and will not scan.
    const { bars } = encodeBarcode('SPX-1', 'code_128');
    expect(bars.length % 2).toBe(1);
  });
});

describe('EAN table invariants', () => {
  // The published relationships between the three digit tables. Checked through
  // the encoder by comparing the same digit encoded on the left and the right of
  // a symbol, which is the only way to observe them from outside.
  const bits = (value: string, symbology: 'ean_13' | 'ean_8'): string => {
    const { bars } = encodeBarcode(value, symbology);
    let out = '';
    for (let i = 0; i < bars.length; i += 1) out += (i % 2 === 0 ? '1' : '0').repeat(bars[i]!);
    return out;
  };

  it('encodes 95 modules for EAN-13 and 67 for EAN-8', () => {
    // 3 + 42 + 5 + 42 + 3 and 3 + 28 + 5 + 28 + 3. A count that is off means a
    // guard or a digit block is the wrong size.
    expect(bits('4006381333931', 'ean_13')).toHaveLength(95);
    expect(bits('96385074', 'ean_8')).toHaveLength(67);
  });

  it('places the guards exactly where the standard says', () => {
    const b = bits('4006381333931', 'ean_13');
    expect(b.slice(0, 3)).toBe('101');
    expect(b.slice(45, 50)).toBe('01010');
    expect(b.slice(92)).toBe('101');
  });

  it('makes the right-hand encoding the complement of the odd-parity left', () => {
    // Digit 0 in position 1 of an all-A code (first digit 0) is A[0]; the same
    // digit on the right is C[0], and C = NOT A throughout the standard.
    const b = bits('0000000000000', 'ean_13');
    const left = b.slice(3, 10);
    const right = b.slice(50, 57);
    expect(right).toBe([...left].map((c) => (c === '0' ? '1' : '0')).join(''));
  });

  it('gives every odd-parity left digit an odd number of bars', () => {
    // The defining property of the A table, and what makes parity decodable.
    const b = bits('0123456789012', 'ean_13');
    // First digit 0 ⇒ parity AAAAAA ⇒ all six left digits use the A table.
    for (let i = 0; i < 6; i += 1) {
      const chunk = b.slice(3 + i * 7, 10 + i * 7);
      const ones = [...chunk].filter((c) => c === '1').length;
      expect(ones % 2).toBe(1);
    }
  });
});

// ─── 2. Checksum arithmetic ────────────────────────────────────────────────────

describe('Code 128 checksum', () => {
  // Hand-computed. "AB" in set B: start 104, 'A' = 33, 'B' = 34.
  //   (104 + 33·1 + 34·2) mod 103 = 205 mod 103 = 102
  it('weights each symbol by its position', () => {
    const { bars } = encodeBarcode('AB', 'code_128');
    // The checksum symbol is the fourth of five; pattern 102 is '411131'.
    expect(bars.slice(18, 24)).toEqual([4, 1, 1, 1, 3, 1]);
  });

  // Digits at both ends switch to set C: start 105, then the pair 12.
  //   (105 + 12·1) mod 103 = 117 mod 103 = 14
  it('switches to the double-density set for a digit pair', () => {
    const { bars, width } = encodeBarcode('12', 'code_128');
    expect(width).toBe(11 * 3 + 13); // start-C, "12", checksum, stop
    expect(bars.slice(12, 18)).toEqual([1, 2, 2, 2, 3, 1]); // pattern 14
  });

  it('halves a long digit run by using set C', () => {
    // Twelve digits as six C symbols plus start and checksum, versus twelve B
    // symbols. If this regresses, every printed label silently gets wider.
    const packed = encodeBarcode('036000291452', 'code_128').width;
    expect(packed).toBe(11 * 8 + 13);
  });
});

// ─── 3. Round trip ─────────────────────────────────────────────────────────────

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
const PARITY = [
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

/**
 * An independent decoder — deliberately written the other way round from the
 * encoder, reading parity to recover the first digit rather than using it to
 * choose a table. If the parity row or the guard offsets are wrong, this fails.
 */
function decodeEan13(bits: string): string {
  expect(bits.slice(0, 3)).toBe('101');
  expect(bits.slice(45, 50)).toBe('01010');
  expect(bits.slice(92)).toBe('101');

  let parity = '';
  let left = '';
  for (let i = 0; i < 6; i += 1) {
    const chunk = bits.slice(3 + i * 7, 10 + i * 7);
    const a = EAN_A.indexOf(chunk);
    const b = EAN_B.indexOf(chunk);
    if (a >= 0) {
      parity += 'A';
      left += String(a);
    } else if (b >= 0) {
      parity += 'B';
      left += String(b);
    } else {
      throw new Error(`left chunk ${chunk} is in neither table`);
    }
  }
  let right = '';
  for (let i = 0; i < 6; i += 1) {
    const chunk = bits.slice(50 + i * 7, 57 + i * 7);
    const c = EAN_C.indexOf(chunk);
    if (c < 0) throw new Error(`right chunk ${chunk} is not in the C table`);
    right += String(c);
  }
  const first = PARITY.indexOf(parity);
  if (first < 0) throw new Error(`parity ${parity} matches no first digit`);
  return `${first}${left}${right}`;
}

function toBits(value: string, symbology: 'ean_13' | 'upc_a'): string {
  const { bars } = encodeBarcode(value, symbology);
  let out = '';
  for (let i = 0; i < bars.length; i += 1) out += (i % 2 === 0 ? '1' : '0').repeat(bars[i]!);
  return out;
}

describe('round trip', () => {
  it.each(['4006381333931', '5901234123457', '9780306406157', '0000000000000'])(
    'decodes EAN-13 %s back to itself',
    (value) => {
      expect(decodeEan13(toBits(value, 'ean_13'))).toBe(value);
    }
  );

  it('encodes a UPC-A as the EAN-13 it is, with the implicit leading zero', () => {
    // The one place the two symbologies genuinely differ is the printed text;
    // the bars are identical, which is why a UPC scans on an EAN reader.
    expect(decodeEan13(toBits('036000291452', 'upc_a'))).toBe('0036000291452');
  });

  it('encodes a UPC-E through its full UPC-A, so it agrees with the registry', () => {
    // A scanner reports the short form; the bars must carry what we stored.
    const bits = toBits('01234565', 'upc_e' as 'upc_a');
    expect(decodeEan13(bits)).toBe('0012345000065');
  });
});

// ─── Refusals ──────────────────────────────────────────────────────────────────

describe('refusing to print something that will not scan', () => {
  it('refuses a GTIN whose check digit is wrong', () => {
    // A label that prints but does not scan is worse than one that refuses:
    // the first is found in the warehouse, the second at the desk.
    expect(() => encodeBarcode('036000291453', 'upc_a')).toThrow(/should end in 2/);
  });

  it('refuses the wrong number of digits', () => {
    expect(() => encodeBarcode('03600029145', 'upc_a')).toThrow(/12 digits/);
  });

  it('refuses to print Code 39 rather than encouraging it', () => {
    expect(() => encodeBarcode('ABC-123', 'code_39')).toThrow(/Code 128/);
  });

  it('sends QR to the renderer that can actually draw it', () => {
    expect(() => encodeBarcode('anything', 'qr')).toThrow(/two-dimensional/);
  });

  it('refuses a character Code 128 set B cannot carry', () => {
    expect(() => encodeBarcode('WIDGETé', 'code_128')).toThrow(/cannot encode/);
  });
});

describe('ITF-14', () => {
  it('encodes fourteen digits as seven interleaved pairs', () => {
    // start (4) + 7 pairs × 10 elements + stop (3).
    const { bars } = encodeBarcode('10036000291459', 'itf_14');
    expect(bars.length).toBe(4 + 70 + 3);
  });

  it('checks the digit before printing on a carton', () => {
    expect(() => encodeBarcode('10036000291458', 'itf_14')).toThrow(/should end in 9/);
  });
});

// ─── SVG ───────────────────────────────────────────────────────────────────────

describe('barcodeSvg', () => {
  it('draws a rect per bar and leaves the spaces empty', () => {
    const encoded = encodeBarcode('12', 'code_128');
    const svg = barcodeSvg(encoded, { showText: false });
    const bars = encoded.bars.filter((_, i) => i % 2 === 0).length;
    expect(svg.match(/<rect/g)?.length).toBe(bars + 1); // + the white background
  });

  it('keeps the quiet zone, without which scanners miss the first bar', () => {
    const encoded = encodeBarcode('12', 'code_128');
    const svg = barcodeSvg(encoded, { moduleWidth: 1, quietZone: 10 });
    expect(svg).toContain(`viewBox="0 0 ${(encoded.width + 20).toFixed(2)}`);
  });

  it('splits a UPC-A caption into the four groups a printed UPC has', () => {
    const svg = barcodeSvg(encodeBarcode('036000291452', 'upc_a'));
    expect(svg.match(/<text/g)).toHaveLength(4);
    expect(svg).toContain('>0<');
    expect(svg).toContain('>36000<');
    expect(svg).toContain('>29145<');
    expect(svg).toContain('>2<');
  });

  it('defaults to black — a themed bar would print grey and not scan', () => {
    expect(barcodeSvg(encodeBarcode('12', 'code_128'))).toContain('fill="#000000"');
  });
});
