// The format strips tell a phone which mask and correction level to read with.
// They shipped transposed, so EVERY code the tool made failed to scan while its
// data was perfect. These tests read the strips back the way a scanner does.

import { describe, expect, it } from 'vitest';

import { encodeQr, type EcLevel } from './qr';

const EC_BITS: Record<EcLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

/** The 15-bit format word for a level and mask: BCH(15,5), then the fixed mask. */
function formatWord(ec: EcLevel, mask: number): number {
  const data = (EC_BITS[ec] << 3) | mask;
  let rem = data << 10;
  for (let bit = 14; bit >= 10; bit--) if ((rem >> bit) & 1) rem ^= 0x537 << (bit - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

type Matrix = boolean[][];
const bit = (m: Matrix, row: number, col: number): number => (m[row]![col] ? 1 : 0);

/** Copy one, at the positions ISO/IEC 18004 gives (row, col), bit 0 first. */
function readCopyOne(m: Matrix): number {
  const cells: [number, number][] = [
    [0, 8],
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [7, 8],
    [8, 8],
    [8, 7],
  ];
  for (let col = 5; col >= 0; col--) cells.push([8, col]);
  return cells.reduce((word, [r, c], i) => word | (bit(m, r, c) << i), 0);
}

/** Copy two: along row 8 from the right edge, then down column 8 to the bottom. */
function readCopyTwo(m: Matrix): number {
  const size = m.length;
  let word = 0;
  for (let i = 0; i < 8; i++) word |= bit(m, 8, size - 1 - i) << i;
  for (let i = 8; i < 15; i++) word |= bit(m, size - 15 + i, 8) << i;
  return word;
}

const VALID = new Map<number, { ec: EcLevel; mask: number }>();
for (const ec of ['L', 'M', 'Q', 'H'] as EcLevel[]) {
  for (let mask = 0; mask < 8; mask++) VALID.set(formatWord(ec, mask), { ec, mask });
}

const INPUTS = [
  'https://meetpiggles.com/frontrow?utm_source=shirt&utm_medium=qr&utm_campaign=frontrow-2026-10',
  'WIFI:T:WPA;S:Shop;P:secret;;',
  'hello',
  'x'.repeat(300),
  'https://example.com/' + 'a'.repeat(900),
];

/** The whole symbol as the `qrcode` library draws it (version 3, M, mask 5): it pins
 *  the error-correction bytes, data placement and masking, not only the strips. */
const REFERENCE_FRONTROW = [
  '#######..#..#..##.#...#######',
  '#.....#.##...##.#...#.#.....#',
  '#.###.#.##.#.#.#...##.#.###.#',
  '#.###.#.#..##...#####.#.###.#',
  '#.###.#..##....######.#.###.#',
  '#.....#..##....#.#..#.#.....#',
  '#######.#.#.#.#.#.#.#.#######',
  '........###.#.###..#.........',
  '#.....#.#.###...##...##..###.',
  '....#....#..##..#.##.#.##.##.',
  '####..#...#.######...#..#....',
  '..###....##..#....###..###...',
  '#.#...###..###.##...#.#.....#',
  '###.....##..#...#..#..###..##',
  '##.####..####....##.#######..',
  '.......#.#.##..#..#######.#.#',
  '..#.####.#.......#..#....##..',
  '###.....##.#.##..####.###.###',
  '###..##.#.##...#...#..#.##..#',
  '#..##..##.#.##.##...#####....',
  '#.#.#.##..#...####..#####.###',
  '........##.#..##.##.#...##...',
  '#######..##.#..###.##.#.###..',
  '#.....#...##..###.###...#....',
  '#.###.#..##.###.#..#######.##',
  '#.###.#..####.###....#...##.#',
  '#.###.#..##.#..#...#########.',
  '#.....#..#...#.##.#..######.#',
  '#######.##...#####.#..##..#..',
];

describe('QR encoder', () => {
  it('matches an independent encoder for the front row address, square for square', () => {
    const m = encodeQr('https://meetpiggles.com/frontrow', 'M').matrix;
    expect(m.map((row) => row.map((on) => (on ? '#' : '.')).join(''))).toEqual(REFERENCE_FRONTROW);
  });

  for (const text of INPUTS) {
    for (const ec of ['L', 'M', 'Q', 'H'] as EcLevel[]) {
      it(`reads back as a valid ${ec} word, twice, for ${text.slice(0, 24)}…`, () => {
        const m = encodeQr(text, ec).matrix;
        const one = readCopyOne(m);
        expect(readCopyTwo(m)).toBe(one);
        expect(VALID.get(one)?.ec).toBe(ec);
        expect(m[m.length - 8]![8]).toBe(true); // the dark module the standard requires
      });
    }
  }
});
