import { buildCodewords, smallestVersion } from './codewords';
import { MASKS, penalty } from './mask';
import { placeData, placeFormat, placeFunctionPatterns, type Grid } from './matrix';
import type { EcLevel } from './tables';

export interface QrResult {
  /** Row-major, true = dark. Does not include the quiet zone. */
  matrix: boolean[][];
  size: number;
  version: number;
  ec: EcLevel;
}

/** Try all eight masks (never over function patterns) and keep the least penalized. */
function bestMasked(base: Grid, reserved: boolean[][], ec: EcLevel): boolean[][] {
  let best: boolean[][] | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row, r) =>
      row.map((cell, c) => {
        const value = cell ?? false;
        return reserved[r]![c] ? value : value !== MASKS[mask]!(r, c);
      })
    );
    const withFormat = candidate.map((row) => [...row]) as Grid;
    placeFormat(withFormat, ec, mask);
    const solid = withFormat.map((row) => row.map((cell) => cell === true));

    const score = penalty(solid);
    if (score < bestScore) {
      bestScore = score;
      best = solid;
    }
  }
  return best!;
}

/** Encode a string. `minVersion` keeps a live preview at a steady size instead of
 *  jumping between 25 and 29 modules on every keystroke. */
export function encodeQr(text: string, ec: EcLevel = 'M', minVersion = 1): QrResult {
  if (text.length === 0) throw new Error('Nothing to encode yet.');

  const version = Math.max(minVersion, smallestVersion(new TextEncoder().encode(text).length, ec));
  const codewords = buildCodewords(text, version, ec);
  const size = version * 4 + 17;

  // `Array.from` twice, not `new Array(size).fill(null)`: that is typed `any[]`,
  // which quietly turns the grid into `any[][]` and drops every later index check.
  const base: Grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, (): boolean | null => null)
  );
  placeFunctionPatterns(base, version);

  // Record the function patterns BEFORE the data goes in: the mask skips them.
  const reserved = base.map((row) => row.map((cell) => cell !== null));
  placeData(base, codewords);

  return { matrix: bestMasked(base, reserved, ec), size, version, ec };
}
