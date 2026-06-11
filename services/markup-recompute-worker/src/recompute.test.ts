import { describe, expect, it } from 'vitest';
import { decideAutoApply, priceDeltaPct } from './recompute.js';

// The auto-apply-vs-staged policy (docs/48 §8/§11) is the worker's most
// consequential decision: it gates whether a cost change silently moves a shelf
// price or waits for a human. Cover the boundaries.

describe('priceDeltaPct', () => {
  it('is the absolute percent change against the old price', () => {
    expect(priceDeltaPct(1000, 1100)).toBeCloseTo(10);
    expect(priceDeltaPct(1000, 900)).toBeCloseTo(10);
    expect(priceDeltaPct(2000, 2500)).toBeCloseTo(25);
  });

  it('is Infinity when the old price is zero (any move is unbounded)', () => {
    expect(priceDeltaPct(0, 500)).toBe(Number.POSITIVE_INFINITY);
    expect(priceDeltaPct(-10, 500)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('decideAutoApply', () => {
  it('never auto-applies in review mode', () => {
    expect(decideAutoApply('review', null, 0.1)).toBe(false);
    expect(decideAutoApply('review', 50, 1)).toBe(false);
  });

  it('never auto-applies in off mode (defensive — callers short-circuit off)', () => {
    expect(decideAutoApply('off', null, 0)).toBe(false);
  });

  it('auto-applies unbounded when auto with a null tolerance', () => {
    expect(decideAutoApply('auto', null, 0)).toBe(true);
    expect(decideAutoApply('auto', null, 999)).toBe(true);
    expect(decideAutoApply('auto', null, Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('auto-applies within the tolerance band and stages beyond it', () => {
    expect(decideAutoApply('auto', 15, 10)).toBe(true);
    expect(decideAutoApply('auto', 15, 15)).toBe(true); // inclusive boundary
    expect(decideAutoApply('auto', 15, 15.01)).toBe(false);
    expect(decideAutoApply('auto', 15, 80)).toBe(false);
  });

  it('stages an infinite delta (price moving off zero) under any finite tolerance', () => {
    expect(decideAutoApply('auto', 1000, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('with a zero tolerance, only a zero delta auto-applies', () => {
    expect(decideAutoApply('auto', 0, 0)).toBe(true);
    expect(decideAutoApply('auto', 0, 0.5)).toBe(false);
  });
});
