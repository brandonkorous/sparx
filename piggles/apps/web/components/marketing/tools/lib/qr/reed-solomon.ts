// GF(256): adding is XOR and multiplying wraps through 0x11D. Log and antilog
// tables built once turn every later multiply into two lookups and an addition.

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

/** g(x) = (x − α⁰)…(x − α^(degree−1)), HIGHEST POWER FIRST. Swapping the two terms
 *  below yields it reversed: degrees 0-1 still agree, every EC byte after is wrong,
 *  and scanners reject every code. That shipped once; qr-format.test.ts guards it. */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      // ×x keeps its index (the array grows at the END); ×αⁱ shifts one right.
      next[j] = (next[j] ?? 0) ^ poly[j]!;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j]!, EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

export function ecCodewords(data: number[], count: number): number[] {
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
