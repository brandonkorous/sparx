import { planFor, type BlockPlan } from './plan';
import { ecCodewords } from './reed-solomon';
import type { EcLevel } from './tables';

class BitBuffer {
  bits: number[] = [];

  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }

  get length(): number {
    return this.bits.length;
  }
}

/** Byte mode only, deliberately: numeric/alphanumeric add code paths for a rare
 *  saving at version edges, and UTF-8 bytes handle every input this tool accepts
 *  (including a Wi-Fi password with an emoji in it, which people do). */
function encodeBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

function charCountBits(version: number): number {
  // Byte mode: 8 bits up to version 9, then 16.
  return version <= 9 ? 8 : 16;
}

export function smallestVersion(byteLength: number, ec: EcLevel): number {
  for (let v = 1; v <= 40; v++) {
    const { dataCodewords } = planFor(v, ec);
    const needed = Math.ceil((4 + charCountBits(v) + byteLength * 8) / 8);
    if (needed <= dataCodewords) return v;
  }
  throw new Error('That is too much text for a QR code. Try shortening the link.');
}

/** Mode, count, payload, terminator and padding, packed into data codewords. */
function dataCodewords(text: string, version: number, plan: BlockPlan): number[] {
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
  return data;
}

/** Split into blocks, add EC to each, then INTERLEAVE, so a scratch across the
 *  symbol costs many blocks one codeword each instead of destroying one block. */
function interleave(data: number[], plan: BlockPlan): number[] {
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

export function buildCodewords(text: string, version: number, ec: EcLevel): number[] {
  const plan = planFor(version, ec);
  return interleave(dataCodewords(text, version, plan), plan);
}
