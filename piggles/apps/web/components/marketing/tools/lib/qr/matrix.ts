import { alignmentCentres } from './plan';
import type { EcLevel } from './tables';

export type Grid = (boolean | null)[][];

function placeFinder(grid: Grid, row: number, col: number): void {
  const size = grid.length;
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const onRing =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      grid[rr]![cc] = onRing || inCore;
    }
  }
}

function placeTiming(grid: Grid): void {
  const size = grid.length;
  for (let i = 8; i < size - 8; i++) {
    const on = i % 2 === 0;
    grid[6]![i] = on;
    grid[i]![6] = on;
  }
}

/** Alignment patterns, skipping the three positions that sit on a finder. */
function placeAlignment(grid: Grid, version: number): void {
  const size = grid.length;
  const centres = alignmentCentres(version);
  for (const r of centres) {
    for (const c of centres) {
      const onFinder =
        (r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6);
      if (onFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          grid[r + dr]![c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        }
      }
    }
  }
}

/** Reserve the format areas so data placement skips them. */
function reserveFormatAreas(grid: Grid): void {
  const size = grid.length;
  for (let i = 0; i < 9; i++) {
    if (grid[8]![i] === null) grid[8]![i] = false;
    if (grid[i]![8] === null) grid[i]![8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (grid[8]![size - 1 - i] === null) grid[8]![size - 1 - i] = false;
    if (grid[size - 1 - i]![8] === null) grid[size - 1 - i]![8] = false;
  }
}

function placeVersion(grid: Grid, version: number): void {
  const size = grid.length;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const on = ((bits >> i) & 1) === 1;
    grid[Math.floor(i / 3)]![size - 11 + (i % 3)] = on;
    grid[size - 11 + (i % 3)]![Math.floor(i / 3)] = on;
  }
}

export function placeFunctionPatterns(grid: Grid, version: number): void {
  const size = grid.length;
  placeFinder(grid, 0, 0);
  placeFinder(grid, 0, size - 7);
  placeFinder(grid, size - 7, 0);
  placeTiming(grid);
  placeAlignment(grid, version);
  // The dark module: always on, always here. It carries no information and the
  // specification simply requires it.
  grid[size - 8]![8] = true;
  reserveFormatAreas(grid);
  if (version >= 7) placeVersion(grid, version);
}

export function versionBits(version: number): number {
  let d = version << 12;
  for (let i = 0; i < 6; i++) {
    if ((d >>> (17 - i)) & 1) d ^= 0x1f25 << (5 - i);
  }
  return (version << 12) | d;
}

export function formatBits(ec: EcLevel, mask: number): number {
  const ecBits: Record<EcLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
  const data = (ecBits[ec] << 3) | mask;
  let d = data << 10;
  for (let i = 0; i < 5; i++) {
    if ((d >>> (14 - i)) & 1) d ^= 0x537 << (4 - i);
  }
  return ((data << 10) | d) ^ 0x5412;
}

export function placeFormat(grid: Grid, ec: EcLevel, mask: number): void {
  const size = grid.length;
  const bits = formatBits(ec, mask);
  for (let i = 0; i < 15; i++) {
    const on = ((bits >> i) & 1) === 1;
    // First copy (grid[row][col]): bits 0-7 DOWN column 8, skipping the timing
    // row; bits 8-14 LEFT along row 8, skipping the timing column. Written
    // transposed, it read as another mask and level, and phones refused it.
    if (i < 6) grid[i]![8] = on;
    else if (i < 8) grid[i + 1]![8] = on;
    else if (i === 8) grid[8]![7] = on;
    else grid[8]![14 - i] = on;

    // Second copy: bits 0-7 along row 8 from the right edge, 8-14 down column 8
    // to the bottom edge. The dark module above them stays set.
    if (i < 8) grid[8]![size - 1 - i] = on;
    else grid[size - 15 + i]![8] = on;
  }
}

export function placeData(grid: Grid, codewords: number[]): void {
  const size = grid.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern and is skipped entirely.
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (grid[row]![col] !== null) continue;
        const byte = codewords[bitIndex >> 3];
        // Past the end of the data, the remaining modules stay light. Some
        // versions have a few spare bits by construction.
        grid[row]![col] = byte !== undefined && ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}
