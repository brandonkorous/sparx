import { BLOCK_COUNT, EC_PER_BLOCK, type EcLevel } from './tables';

/** Where the alignment patterns go, per version. Row/column centres; the three
 *  combinations that would land on a finder pattern are skipped when placing. */
export function alignmentCentres(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  // The standard's step: even, and derived so the last gap is the smallest.
  const step = version === 32 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const result = [6];
  for (let i = count - 1; i >= 1; i--) result.push(size - 7 - (count - 1 - i) * step);
  return result.sort((a, b) => a - b);
}

/** Total codewords from geometry: count every module, take away everything that
 *  is not data. The whole table is checked against this, so it is written to be
 *  obviously right rather than compact. */
export function totalCodewords(version: number): number {
  const size = version * 4 + 17;
  let modules = size * size;

  modules -= 3 * 8 * 8; // three finder patterns with their separators
  modules -= 2 * 15 + 1; // two copies of the format information, plus the dark module
  modules -= (size - 16) * 2; // the two timing lines, less the parts inside finders

  const centres = alignmentCentres(version);
  if (centres.length > 0) {
    const n = centres.length;
    modules -= (n * n - 3) * 25; // 5×5 alignment patterns, less the three on finders
    // ADD BACK, do not subtract: alignment patterns on row/column 6 overlap timing
    // modules already taken off above. Subtracting (the easy slip, and once the real
    // one) leaves v7+ three to thirteen codewords short; the capacity check catches it.
    modules += (n - 2) * 2 * 5;
  }
  if (version >= 7) modules -= 2 * 18; // two copies of the version information

  return Math.floor(modules / 8);
}

export interface BlockPlan {
  totalCodewords: number;
  dataCodewords: number;
  ecPerBlock: number;
  /** [dataCodewordsInBlock] for each block, in order. */
  blocks: number[];
}

export function planFor(version: number, ec: EcLevel): BlockPlan {
  const total = totalCodewords(version);
  const ecPerBlock = EC_PER_BLOCK[ec][version - 1]!;
  const blockCount = BLOCK_COUNT[ec][version - 1]!;
  const data = total - blockCount * ecPerBlock;

  // The standard splits data into at most two group sizes, and the larger group
  // is always exactly one codeword longer. That is a division with a remainder.
  const base = Math.floor(data / blockCount);
  const longBlocks = data % blockCount;

  const blocks: number[] = [];
  for (let i = 0; i < blockCount; i++) blocks.push(i < blockCount - longBlocks ? base : base + 1);

  return { totalCodewords: total, dataCodewords: data, ecPerBlock, blocks };
}
