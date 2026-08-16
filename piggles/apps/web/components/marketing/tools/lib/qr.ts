/**
 * A QR encoder, written from ISO/IEC 18004.
 *
 * Pure and dependency-free: in, a string; out, a square grid of booleans. It
 * knows nothing about canvases, colors or logos — those belong to whatever is
 * drawing it, and keeping them out is what lets the same encoder produce a PNG,
 * an SVG and a print-resolution bitmap without three copies of the hard part.
 *
 * ── THE CAPACITY TABLE IS DERIVED, NOT TRANSCRIBED ──────────────────────────
 *
 * The usual way to carry the block structure is a table of 160 rows — forty
 * versions by four correction levels — each listing how many blocks there are,
 * how many total codewords per block, and how many of those are data. That table
 * is transcribed from the standard by hand, and a single wrong digit in it
 * produces a code that looks perfectly normal and cannot be scanned. Nothing
 * catches it: it renders, it downloads, it prints, and it fails in somebody's
 * shop.
 *
 * So only the two genuinely irreducible numbers are tabulated per version and
 * level — how many error-correction codewords each block carries, and how many
 * blocks there are. Everything else is computed:
 *
 *   • The total codeword count comes from the SHAPE of the symbol: count the
 *     modules, subtract the finders, timing, alignment, format and version
 *     areas, divide by eight. That is geometry, not a table, and it cannot be
 *     mistyped.
 *   • The data codewords are then total minus (blocks × EC per block).
 *   • The split into two block groups follows the standard's own rule — the
 *     longer blocks carry exactly one more codeword than the shorter ones — so
 *     it falls out of a division with a remainder.
 *
 * `verifyCapacityTable()` at the foot of this file checks the whole thing
 * against the published data-codeword capacities. A typo in the two remaining
 * columns shows up as a thrown error rather than as an unscannable label.
 */

export type EcLevel = 'L' | 'M' | 'Q' | 'H';

export const EC_LEVELS: { value: EcLevel; label: string; blurb: string }[] = [
    {
        value: 'L',
        label: 'Low',
        blurb:
            'Recovers about 7% damage. The simplest pattern — use it for a long address on a clean surface.',
    },
    { value: 'M', label: 'Medium', blurb: 'About 15%. The sensible default for almost everything.' },
    {
        value: 'Q',
        label: 'High',
        blurb: 'About 25%. Worth it for anything that gets handled — a menu, a table card.',
    },
    {
        value: 'H',
        label: 'Highest',
        blurb: 'About 30%. Use this if you are putting a logo in the middle.',
    },
];

/** Error-correction codewords per block, by version (1-40) and level. */
const EC_PER_BLOCK: Record<EcLevel, number[]> = {
    L: [
        7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30,
        26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    ],
    M: [
        10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28,
        28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    ],
    Q: [
        13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30,
        30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    ],
    H: [
        17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30,
        30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    ],
};

/** Number of blocks the data is split into, by version (1-40) and level. */
const BLOCK_COUNT: Record<EcLevel, number[]> = {
    L: [
        1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15,
        16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
    ],
    M: [
        1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25,
        26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
    ],
    Q: [
        1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34,
        35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
    ],
    H: [
        1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37,
        40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
    ],
};

/** Where the alignment patterns go, per version. Row/column centres; the three
 *  combinations that would land on a finder pattern are skipped when placing. */
function alignmentCentres(version: number): number[] {
    if (version === 1) return [];
    const count = Math.floor(version / 7) + 2;
    const size = version * 4 + 17;
    // The standard's step: even, and derived so the last gap is the smallest.
    const step = version === 32 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
    const result = [6];
    for (let i = count - 1; i >= 1; i--) result.push(size - 7 - (count - 1 - i) * step);
    return result.sort((a, b) => a - b);
}

/**
 * Total codewords a symbol can hold, computed from its geometry.
 *
 * This is the number the whole table is checked against, so it is written to be
 * obviously right rather than compact: count every module, take away everything
 * that is not data.
 */
function totalCodewords(version: number): number {
    const size = version * 4 + 17;
    let modules = size * size;

    modules -= 3 * 8 * 8; // three finder patterns with their separators
    modules -= 2 * 15 + 1; // two copies of the format information, plus the dark module
    modules -= (size - 16) * 2; // the two timing lines, less the parts inside finders

    const centres = alignmentCentres(version);
    if (centres.length > 0) {
        const n = centres.length;
        modules -= (n * n - 3) * 25; // 5×5 alignment patterns, less the three on finders
        // ADD BACK, do not subtract again. The alignment patterns that sit on row 6
        // or column 6 overlap the timing lines, whose modules were already taken off
        // above — so those squares have been counted twice and one count has to be
        // returned. Subtracting here instead (which is the easy slip, and was the
        // slip) makes every symbol from version 7 up come out three to thirteen
        // codewords short, which the capacity check at the foot of this file catches
        // and a scanner would not.
        modules += (n - 2) * 2 * 5;
    }
    if (version >= 7) modules -= 2 * 18; // two copies of the version information

    return Math.floor(modules / 8);
}

interface BlockPlan {
    totalCodewords: number;
    dataCodewords: number;
    ecPerBlock: number;
    /** [dataCodewordsInBlock] for each block, in order. */
    blocks: number[];
}

function planFor(version: number, ec: EcLevel): BlockPlan {
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

// ── GF(256) ─────────────────────────────────────────────────────────────────
//
// Reed-Solomon works in a finite field of 256 elements, which means arithmetic
// where adding is XOR and multiplying wraps through a fixed polynomial (0x11D
// for QR). Building log and antilog tables once turns every later multiply into
// two lookups and an addition.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

/**
 * The generator polynomial for `degree` error-correction codewords.
 *
 * g(x) = (x − α⁰)(x − α¹)…(x − α^(degree−1)), with the coefficients stored
 * HIGHEST POWER FIRST — `poly[0]` is the leading 1.
 *
 * ── THE ORDER IS THE WHOLE BUG SURFACE HERE ─────────────────────────────────
 *
 * Multiplying by `(x − αⁱ)` is two operations added together: multiply by x, and
 * multiply by αⁱ. In this ordering the ×x term keeps its index (the array grows
 * by one at the END, so every existing coefficient represents one power higher)
 * and the ×αⁱ term shifts one to the right.
 *
 * Writing those two the other way round produces the correct polynomial exactly
 * REVERSED, and it is very hard to notice: degrees 0 and 1 are palindromes, so
 * the first two cases agree. Everything past that yields error-correction bytes
 * that are wrong in every position — which does NOT stop the symbol rendering,
 * does not stop the data being placed correctly, and does not stop this tool
 * looking like it works. A scanner computes the syndrome, finds it non-zero,
 * fails to correct, and rejects the code. Every single one.
 *
 * That shipped, briefly, and was caught only by decoding our own output back and
 * checking the syndrome — which is now `check-qr-decode.mjs`. It is the reason
 * that script exists.
 */
function generatorPoly(degree: number): number[] {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
        const next = new Array<number>(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
            next[j] = (next[j] ?? 0) ^ poly[j]!;
            next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j]!, EXP[i]!);
        }
        poly = next;
    }
    return poly;
}

function ecCodewords(data: number[], count: number): number[] {
    const gen = generatorPoly(count);
    const remainder = new Array<number>(count).fill(0);

    for (const byte of data) {
        const factor = byte ^ remainder[0]!;
        remainder.shift();
        remainder.push(0);
        for (let i = 0; i < count; i++) {
            remainder[i] = remainder[i]! ^ gfMul(gen[i + 1]!, factor);
        }
    }
    return remainder;
}

// ── ENCODING ────────────────────────────────────────────────────────────────

class BitBuffer {
    bits: number[] = [];

    put(value: number, length: number): void {
        for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
    }

    get length(): number {
        return this.bits.length;
    }
}

/** Byte mode only, and deliberately so. Numeric and alphanumeric modes pack more
 *  densely, but they apply to a minority of real inputs, they add two more code
 *  paths to get wrong, and the saving only matters at the very edge of a version
 *  boundary. UTF-8 in byte mode handles every input this tool accepts — including
 *  a Wi-Fi password with an emoji in it, which people do. */
function encodeBytes(text: string): number[] {
    return [...new TextEncoder().encode(text)];
}

function charCountBits(version: number): number {
    // Byte mode: 8 bits up to version 9, then 16.
    return version <= 9 ? 8 : 16;
}

function smallestVersion(byteLength: number, ec: EcLevel): number {
    for (let v = 1; v <= 40; v++) {
        const { dataCodewords } = planFor(v, ec);
        const needed = Math.ceil((4 + charCountBits(v) + byteLength * 8) / 8);
        if (needed <= dataCodewords) return v;
    }
    throw new Error('That is too much text for a QR code. Try shortening the link.');
}

function buildCodewords(text: string, version: number, ec: EcLevel): number[] {
    const plan = planFor(version, ec);
    const bytes = encodeBytes(text);

    const buffer = new BitBuffer();
    buffer.put(0b0100, 4); // byte mode
    buffer.put(bytes.length, charCountBits(version));
    for (const b of bytes) buffer.put(b, 8);

    const capacityBits = plan.dataCodewords * 8;
    // Terminator: up to four zero bits, or fewer if we are near the end.
    buffer.put(0, Math.min(4, capacityBits - buffer.length));
    // Pad to a byte boundary.
    while (buffer.length % 8 !== 0) buffer.bits.push(0);

    const data: number[] = [];
    for (let i = 0; i < buffer.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | buffer.bits[i + j]!;
        data.push(byte);
    }
    // Fill the remainder with the standard's alternating pad bytes.
    const PAD = [0xec, 0x11];
    while (data.length < plan.dataCodewords) data.push(PAD[(data.length - buffer.length / 8) % 2]!);

    // Split into blocks, compute EC for each, then INTERLEAVE. Interleaving is
    // what makes the correction work against physical damage: a scratch across
    // the symbol then hits one codeword of many blocks rather than destroying one
    // block entirely, and each block can lose a few codewords and still recover.
    const dataBlocks: number[][] = [];
    const ecBlocks: number[][] = [];
    let offset = 0;
    for (const size of plan.blocks) {
        const block = data.slice(offset, offset + size);
        offset += size;
        dataBlocks.push(block);
        ecBlocks.push(ecCodewords(block, plan.ecPerBlock));
    }

    const result: number[] = [];
    const maxData = Math.max(...plan.blocks);
    for (let i = 0; i < maxData; i++) {
        for (const block of dataBlocks) if (i < block.length) result.push(block[i]!);
    }
    for (let i = 0; i < plan.ecPerBlock; i++) {
        for (const block of ecBlocks) result.push(block[i]!);
    }
    return result;
}

// ── THE MATRIX ──────────────────────────────────────────────────────────────

type Grid = (boolean | null)[][];

function placeFunctionPatterns(grid: Grid, version: number): void {
    const size = grid.length;

    const finder = (row: number, col: number) => {
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
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    // Timing patterns.
    for (let i = 8; i < size - 8; i++) {
        const on = i % 2 === 0;
        grid[6]![i] = on;
        grid[i]![6] = on;
    }

    // Alignment patterns, skipping the three positions that sit on a finder.
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

    // The dark module — always on, always here. It carries no information and the
    // specification simply requires it.
    grid[size - 8]![8] = true;

    // Reserve the format areas so data placement skips them.
    for (let i = 0; i < 9; i++) {
        if (grid[8]![i] === null) grid[8]![i] = false;
        if (grid[i]![8] === null) grid[i]![8] = false;
    }
    for (let i = 0; i < 8; i++) {
        if (grid[8]![size - 1 - i] === null) grid[8]![size - 1 - i] = false;
        if (grid[size - 1 - i]![8] === null) grid[size - 1 - i]![8] = false;
    }

    if (version >= 7) {
        const bits = versionBits(version);
        for (let i = 0; i < 18; i++) {
            const on = ((bits >> i) & 1) === 1;
            grid[Math.floor(i / 3)]![size - 11 + (i % 3)] = on;
            grid[size - 11 + (i % 3)]![Math.floor(i / 3)] = on;
        }
    }
}

function versionBits(version: number): number {
    let d = version << 12;
    for (let i = 0; i < 6; i++) {
        if ((d >>> (17 - i)) & 1) d ^= 0x1f25 << (5 - i);
    }
    return (version << 12) | d;
}

function formatBits(ec: EcLevel, mask: number): number {
    const ecBits: Record<EcLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
    const data = (ecBits[ec] << 3) | mask;
    let d = data << 10;
    for (let i = 0; i < 5; i++) {
        if ((d >>> (14 - i)) & 1) d ^= 0x537 << (4 - i);
    }
    return ((data << 10) | d) ^ 0x5412;
}

function placeFormat(grid: Grid, ec: EcLevel, mask: number): void {
    const size = grid.length;
    const bits = formatBits(ec, mask);
    for (let i = 0; i < 15; i++) {
        const on = ((bits >> i) & 1) === 1;
        // First copy, around the top-left finder.
        if (i < 6) grid[8]![i] = on;
        else if (i < 8) grid[8]![i + 1] = on;
        else if (i === 8) grid[7]![8] = on;
        else grid[14 - i]![8] = on;

        // Second copy, split between the other two finders: SEVEN modules running up
        // column 8 from the bottom edge, then EIGHT along row 8 to the right edge.
        //
        // Seven and eight, not eight and seven. The symmetrical-looking split writes
        // one module too far up column 8 and lands on the dark module at
        // (size - 8, 8) — overwriting a module the standard requires to be set, and
        // simultaneously leaving the last format bit unwritten. It scans perfectly
        // whenever that bit happens to be 1, which is about half of all masks, so it
        // is a bug that appears to work.
        if (i < 7) grid[size - 1 - i]![8] = on;
        else grid[8]![size - 15 + i] = on;
    }
}

function placeData(grid: Grid, codewords: number[]): void {
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

const MASKS: ((r: number, c: number) => boolean)[] = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * How bad a masked symbol looks to a scanner.
 *
 * A mask is applied so the finished pattern has no large blank areas and no
 * accidental repeats of the finder pattern, both of which confuse scanners. All
 * eight are tried and the least-penalised wins — which is why generating a code
 * does eight times more work than it looks like it should.
 */
function penalty(grid: boolean[][]): number {
    const size = grid.length;
    let score = 0;

    // Runs of five or more of the same color, in each direction.
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

    // Solid 2×2 blocks.
    for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
            const v = grid[r]![c]!;
            if (v === grid[r]![c + 1] && v === grid[r + 1]![c] && v === grid[r + 1]![c + 1]) score += 3;
        }
    }

    // Anything resembling the finder pattern's 1:1:3:1:1 signature.
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

    // A symbol that is mostly dark, or mostly light, scans poorly.
    const dark = grid.flat().filter(Boolean).length;
    const ratio = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

    return score;
}

export interface QrResult {
    /** Row-major, true = dark. Does not include the quiet zone. */
    matrix: boolean[][];
    size: number;
    version: number;
    ec: EcLevel;
}

/**
 * Encode a string.
 *
 * `minVersion` lets a caller keep a code at a steady size while its content is
 * being edited — a preview that jumps between 25 and 29 modules on every
 * keystroke is unusable, which is a UI concern the encoder can solve in one
 * argument.
 */
export function encodeQr(text: string, ec: EcLevel = 'M', minVersion = 1): QrResult {
    if (text.length === 0) throw new Error('Nothing to encode yet.');

    const version = Math.max(minVersion, smallestVersion(new TextEncoder().encode(text).length, ec));
    const codewords = buildCodewords(text, version, ec);
    const size = version * 4 + 17;

    // `Array.from` twice rather than `new Array(size).fill(null)`: the latter is
    // typed `any[]`, which quietly turns the whole grid into `any[][]` and takes
    // every later index check off with it.
    const base: Grid = Array.from({ length: size }, () =>
        Array.from({ length: size }, (): boolean | null => null)
    );
    placeFunctionPatterns(base, version);

    // Remember which modules are function patterns BEFORE the data goes in — the
    // mask must not be applied to them.
    const reserved = base.map((row) => row.map((cell) => cell !== null));
    placeData(base, codewords);

    let best: boolean[][] | null = null;
    let bestScore = Infinity;
    let bestMask = 0;

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
            bestMask = mask;
        }
    }

    void bestMask;
    return { matrix: best!, size, version, ec };
}

// ── WHAT GOES IN A QR CODE ──────────────────────────────────────────────────
//
// These build the strings that phones recognise as something other than text.
// Each format is a small convention with a specific escaping rule, and getting
// the escaping wrong produces a code that scans and then does nothing — which
// looks like a broken phone rather than a broken code.

export function wifiPayload(opts: {
    ssid: string;
    password: string;
    security: 'WPA' | 'WEP' | 'nopass';
    hidden: boolean;
}): string {
    // Semicolons, colons, commas and backslashes are separators in this format and
    // have to be escaped. A café Wi-Fi password with a semicolon in it is exactly
    // the sort of thing that silently truncates.
    const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
    const parts = [`T:${opts.security}`, `S:${esc(opts.ssid)}`];
    if (opts.security !== 'nopass') parts.push(`P:${esc(opts.password)}`);
    if (opts.hidden) parts.push('H:true');
    return `WIFI:${parts.join(';')};;`;
}

export function smsPayload(number: string, message: string): string {
    return message ? `SMSTO:${number}:${message}` : `SMSTO:${number}`;
}

export function emailPayload(to: string, subject: string, body: string): string {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);
    const query = params.toString();
    return `mailto:${to}${query ? `?${query}` : ''}`;
}

export function telPayload(number: string): string {
    return `tel:${number.replace(/[^\d+]/g, '')}`;
}

export function geoPayload(lat: string, lng: string): string {
    return `geo:${lat},${lng}`;
}

// ── SELF-CHECK ──────────────────────────────────────────────────────────────

/**
 * Prove the capacity table against the published data-codeword capacities.
 *
 * Called by the unit check in the scratchpad and safe to call at runtime. It
 * exists because the two tables above are the only hand-entered numbers in this
 * file, and a wrong one produces a code that renders perfectly and cannot be
 * read — the exact failure this file's design is trying to make impossible.
 */
export function verifyCapacityTable(): { ok: boolean; problems: string[] } {
    const problems: string[] = [];
    const LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H'];

    // 1. THE GEOMETRY, against ISO/IEC 18004 Table 1 — the total codeword count per
    //    version, which does not vary by correction level and is therefore the one
    //    figure that pins the module accounting on its own. This sequence is the
    //    authority for `totalCodewords`, and checking against it is what caught a
    //    sign error that made every symbol from version 7 up come out short.
    const PUBLISHED_TOTALS = [
        26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991,
        1085, 1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876,
        3034, 3196, 3362, 3532, 3706,
    ];
    for (let v = 1; v <= 40; v++) {
        const got = totalCodewords(v);
        if (got !== PUBLISHED_TOTALS[v - 1]) {
            problems.push(
                `v${v}: geometry gives ${got} codewords, standard says ${PUBLISHED_TOTALS[v - 1]}`
            );
        }
    }

    // 2. DATA CAPACITY for the versions worth stating outright. Kept to the ones a
    //    real input actually lands on — a web address is version 2 to 6, a vCard 5
    //    to 12 — plus 40 to pin the far end.
    //
    //    Deliberately NOT extended to more versions by recollection. Every figure
    //    that "failed" while this was being written turned out to be the BYTE
    //    capacity rather than the data-codeword count: the two differ by exactly
    //    three from version 10 up, because the mode indicator and character count
    //    take twenty bits off the front. Half-remembered numbers make a check that
    //    fails on correct code, which is worse than no check — you learn to ignore
    //    it. The invariants below cover the rest properly.
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

    // 3. STRUCTURAL INVARIANTS across all 160 combinations. These need no recalled
    //    figures and a mistyped table entry is very unlikely to survive them.
    for (let version = 1; version <= 40; version++) {
        let previousData = -1;
        for (const ec of LEVELS) {
            const plan = planFor(version, ec);
            const blocks = plan.blocks;

            if (plan.dataCodewords < 1) {
                problems.push(`v${version}-${ec}: no room for any data`);
            }
            // The standard splits data into at most two group sizes, one codeword
            // apart. Anything else means the block count or EC count is wrong.
            const min = Math.min(...blocks);
            const max = Math.max(...blocks);
            if (min < 1) problems.push(`v${version}-${ec}: a block holds no data`);
            if (max - min > 1) problems.push(`v${version}-${ec}: block sizes differ by ${max - min}`);
            // Reed-Solomon cannot correct more than it carries: a block's EC count has
            // to be under 256 and the standard never exceeds 30.
            if (plan.ecPerBlock < 7 || plan.ecPerBlock > 30) {
                problems.push(
                    `v${version}-${ec}: ${plan.ecPerBlock} EC codewords per block is out of range`
                );
            }
            // Stronger correction always costs capacity: L > M > Q > H, without fail.
            if (previousData >= 0 && plan.dataCodewords >= previousData) {
                problems.push(`v${version}-${ec}: holds as much as the weaker level above it`);
            }
            previousData = plan.dataCodewords;
        }
    }

    // 4. CAPACITY RISES WITH VERSION, at every level. A transposed pair of table
    //    entries almost always breaks this.
    for (const ec of LEVELS) {
        for (let version = 2; version <= 40; version++) {
            const here = planFor(version, ec).dataCodewords;
            const before = planFor(version - 1, ec).dataCodewords;
            if (here <= before) {
                problems.push(`v${version}-${ec}: holds ${here}, no more than v${version - 1}'s ${before}`);
            }
        }
    }

    return { ok: problems.length === 0, problems };
}

/* The format and version words are the two other places a single wrong bit makes
 * a perfect-looking symbol unreadable, and unlike the block structure they are
 * published as literal tables — so they can be checked exactly. Exported under
 * deliberately awkward names because nothing in the app should call them; they
 * exist so the check script can reach the internals without those internals
 * becoming part of this module's usable surface. */
export const __formatBitsForTest = formatBits;
export const __versionBitsForTest = versionBits;
/** The block plan, so the check script can de-interleave a symbol it has read
 *  back out of the pixels without re-deriving the standard's split. */
export const __planForTest = planFor;
