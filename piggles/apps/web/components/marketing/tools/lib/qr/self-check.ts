import { formatBits, versionBits } from './matrix';
import { planFor, totalCodewords, type BlockPlan } from './plan';
import type { EcLevel } from './tables';

const LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H'];

// ISO/IEC 18004 Table 1: total codewords per version, independent of level, so it
// pins the module accounting on its own. It is the authority for totalCodewords
// and caught a sign error that left every symbol from version 7 up short.
const PUBLISHED_TOTALS = [
  26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034,
  3196, 3362, 3532, 3706,
];

// Only versions real inputs land on (a URL is v2-6, a vCard v5-12) plus v40. Not
// extended from memory: recalled figures were BYTE capacities (3 lower from v10 up),
// and a check that fails on correct code teaches you to ignore it.
const KNOWN_DATA: Record<number, Record<EcLevel, number>> = {
  1: { L: 19, M: 16, Q: 13, H: 9 },
  2: { L: 34, M: 28, Q: 22, H: 16 },
  3: { L: 55, M: 44, Q: 34, H: 26 },
  4: { L: 80, M: 64, Q: 48, H: 36 },
  5: { L: 108, M: 86, Q: 62, H: 46 },
  6: { L: 136, M: 108, Q: 76, H: 60 },
  7: { L: 156, M: 124, Q: 88, H: 66 },
  10: { L: 274, M: 216, Q: 154, H: 122 },
  40: { L: 2956, M: 2334, Q: 1666, H: 1276 },
};

function checkGeometry(problems: string[]): void {
  for (let v = 1; v <= 40; v++) {
    const got = totalCodewords(v);
    if (got !== PUBLISHED_TOTALS[v - 1]) {
      problems.push(
        `v${v}: geometry gives ${got} codewords, standard says ${PUBLISHED_TOTALS[v - 1]}`
      );
    }
  }
}

function checkKnownData(problems: string[]): void {
  for (const [v, levels] of Object.entries(KNOWN_DATA)) {
    const version = Number(v);
    for (const ec of LEVELS) {
      const plan = planFor(version, ec);
      if (plan.dataCodewords !== levels[ec]) {
        problems.push(
          `v${version}-${ec}: computed ${plan.dataCodewords} data codewords, standard says ${levels[ec]}`
        );
      }
    }
  }
}

/** Invariants one plan must hold on its own; they need no recalled figures. */
function checkPlanShape(version: number, ec: EcLevel, plan: BlockPlan, problems: string[]): void {
  const blocks = plan.blocks;
  if (plan.dataCodewords < 1) {
    problems.push(`v${version}-${ec}: no room for any data`);
  }
  // At most two group sizes, one codeword apart; otherwise a table entry is wrong.
  const min = Math.min(...blocks);
  const max = Math.max(...blocks);
  if (min < 1) problems.push(`v${version}-${ec}: a block holds no data`);
  if (max - min > 1) problems.push(`v${version}-${ec}: block sizes differ by ${max - min}`);
  // A block's EC count has to be under 256, and the standard never exceeds 30.
  if (plan.ecPerBlock < 7 || plan.ecPerBlock > 30) {
    problems.push(`v${version}-${ec}: ${plan.ecPerBlock} EC codewords per block is out of range`);
  }
}

/** All 160 combinations; stronger correction always costs capacity (L > M > Q > H). */
function checkInvariants(problems: string[]): void {
  for (let version = 1; version <= 40; version++) {
    let previousData = -1;
    for (const ec of LEVELS) {
      const plan = planFor(version, ec);
      checkPlanShape(version, ec, plan, problems);
      if (previousData >= 0 && plan.dataCodewords >= previousData) {
        problems.push(`v${version}-${ec}: holds as much as the weaker level above it`);
      }
      previousData = plan.dataCodewords;
    }
  }
}

/** Capacity rises with version at every level; a transposed pair almost always breaks it. */
function checkRisingCapacity(problems: string[]): void {
  for (const ec of LEVELS) {
    for (let version = 2; version <= 40; version++) {
      const here = planFor(version, ec).dataCodewords;
      const before = planFor(version - 1, ec).dataCodewords;
      if (here <= before) {
        problems.push(`v${version}-${ec}: holds ${here}, no more than v${version - 1}'s ${before}`);
      }
    }
  }
}

/** Prove the two hand-entered tables against published capacities. Safe at runtime;
 *  a wrong entry yields a code that renders perfectly and cannot be read. */
export function verifyCapacityTable(): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  checkGeometry(problems);
  checkKnownData(problems);
  checkInvariants(problems);
  checkRisingCapacity(problems);
  return { ok: problems.length === 0, problems };
}

// Format and version words are published as literal tables, so the check script
// verifies them exactly. Awkward names on purpose: nothing in the app should call
// these. The block plan lets the script de-interleave a symbol it read back.
export const __formatBitsForTest = formatBits;
export const __versionBitsForTest = versionBits;
export const __planForTest = planFor;
