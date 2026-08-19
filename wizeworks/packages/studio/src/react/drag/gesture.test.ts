import { describe, expect, it } from 'vitest';
import { EDGE, EDGE_STEP, SLOP, edgePull, strayed } from './gesture';

describe('strayed', () => {
  const from = { x: 100, y: 200 };

  it('lets a still finger through', () => {
    expect(strayed(from, { x: 100, y: 200 })).toBe(false);
    expect(strayed(from, { x: 103, y: 204 })).toBe(false);
  });

  it('holds at exactly the slop, and cancels past it', () => {
    expect(strayed(from, { x: 100, y: 200 + SLOP })).toBe(false);
    expect(strayed(from, { x: 100, y: 200 + SLOP + 1 })).toBe(true);
  });

  it('cancels on either axis, and in either direction', () => {
    expect(strayed(from, { x: 100 - SLOP - 1, y: 200 })).toBe(true);
    expect(strayed(from, { x: 100, y: 200 - SLOP - 1 })).toBe(true);
  });

  it('measures each axis on its own, not the distance between', () => {
    // 7px each way is under the slop diagonally and nearly 10px of real travel.
    // A hypotenuse test would arm a drag here; a scroll starts like this.
    expect(strayed(from, { x: 107, y: 207 })).toBe(false);
    expect(strayed(from, { x: 109, y: 209 })).toBe(true);
  });
});

describe('edgePull', () => {
  const top = 100;
  const bottom = 700;

  it('does nothing in the middle', () => {
    expect(edgePull(400, top, bottom)).toBe(0);
    expect(edgePull(top + EDGE, top, bottom)).toBe(0);
    expect(edgePull(bottom - EDGE, top, bottom)).toBe(0);
  });

  it('pulls up near the top and down near the bottom', () => {
    expect(edgePull(top + 1, top, bottom)).toBeLessThan(0);
    expect(edgePull(bottom - 1, top, bottom)).toBeGreaterThan(0);
  });

  it('tapers, so the list does not bolt at the band edge', () => {
    const lip = Math.abs(edgePull(top + EDGE - 1, top, bottom));
    const deep = Math.abs(edgePull(top + 1, top, bottom));
    expect(lip).toBeLessThan(deep);
    expect(lip).toBe(1);
  });

  it('caps at full speed past the edge rather than accelerating away', () => {
    expect(edgePull(top, top, bottom)).toBe(-EDGE_STEP);
    expect(edgePull(top - 500, top, bottom)).toBe(-EDGE_STEP);
    expect(edgePull(bottom + 500, top, bottom)).toBe(EDGE_STEP);
  });
});
