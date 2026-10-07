export const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Runs of five or more of the same color, in each direction. */
function runPenalty(grid: boolean[][]): number {
  const size = grid.length;
  let score = 0;
  for (const transposed of [false, true]) {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        const prev = transposed ? grid[b - 1]![a]! : grid[a]![b - 1]!;
        const cur = transposed ? grid[b]![a]! : grid[a]![b]!;
        if (cur === prev) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else run = 1;
      }
    }
  }
  return score;
}

/** Solid 2×2 blocks. */
function blockPenalty(grid: boolean[][]): number {
  const size = grid.length;
  let score = 0;
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r]![c]!;
      if (v === grid[r]![c + 1] && v === grid[r + 1]![c] && v === grid[r + 1]![c + 1]) score += 3;
    }
  }
  return score;
}

/** Anything resembling the finder pattern's 1:1:3:1:1 signature. */
function finderLikePenalty(grid: boolean[][]): number {
  const size = grid.length;
  let score = 0;
  const pattern = [true, false, true, true, true, false, true];
  const matches = (cells: boolean[]): boolean => pattern.every((p, i) => cells[i] === p);
  for (const transposed of [false, true]) {
    for (let a = 0; a < size; a++) {
      for (let b = 0; b <= size - 7; b++) {
        const cells = Array.from({ length: 7 }, (_, i) =>
          transposed ? grid[b + i]![a]! : grid[a]![b + i]!
        );
        if (!matches(cells)) continue;
        const before = Array.from({ length: 4 }, (_, i) => b - 1 - i).every(
          (i) => i < 0 || !(transposed ? grid[i]![a] : grid[a]![i])
        );
        const after = Array.from({ length: 4 }, (_, i) => b + 7 + i).every(
          (i) => i >= size || !(transposed ? grid[i]![a] : grid[a]![i])
        );
        if (before || after) score += 40;
      }
    }
  }
  return score;
}

/** A symbol that is mostly dark, or mostly light, scans poorly. */
function balancePenalty(grid: boolean[][]): number {
  const size = grid.length;
  const dark = grid.flat().filter(Boolean).length;
  const ratio = (dark * 100) / (size * size);
  return Math.floor(Math.abs(ratio - 50) / 5) * 10;
}

/** How bad a masked symbol looks to a scanner: blank areas and accidental finder
 *  look-alikes both confuse one. All eight masks are scored and the lowest wins. */
export function penalty(grid: boolean[][]): number {
  return runPenalty(grid) + blockPenalty(grid) + finderLikePenalty(grid) + balancePenalty(grid);
}
