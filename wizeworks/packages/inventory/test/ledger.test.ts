// Unit coverage for the ledger's pure cost-basis math. The DB-bound parts of
// `applyMovement` (row-lock, idempotency, the onHand == Σ(movements) invariant)
// are exercised end-to-end once catalog + inventory seed data lands (P1e); this
// file pins the moving-average formula, which is the part most prone to
// rounding / first-receipt / outbound bugs.

import { describe, expect, it } from 'vitest';

import { nextAvgCost } from '../src/services/ledger';

describe('nextAvgCost (moving-average cost basis)', () => {
  it('sets the basis from the first costed receipt (no prior stock)', () => {
    // 0 on hand, no avg yet, receive 10 @ 500¢ → basis = 500.
    expect(nextAvgCost(0, null, 10, 500)).toBe(500);
  });

  it('treats a costed receipt onto a zero-onHand level as a reset, ignoring stale avg', () => {
    // Fully depleted then restocked at a new cost — the new cost is the basis.
    expect(nextAvgCost(0, 999, 5, 300)).toBe(300);
  });

  it('weights the average by quantity on a costed receipt', () => {
    // 10 @ 500 + 10 @ 700 → (10·500 + 10·700) / 20 = 600.
    expect(nextAvgCost(10, 500, 10, 700)).toBe(600);
    // 30 @ 200 + 10 @ 600 → (30·200 + 10·600) / 40 = 300.
    expect(nextAvgCost(30, 200, 10, 600)).toBe(300);
  });

  it('rounds to whole cents', () => {
    // 3 @ 100 + 1 @ 150 → (300 + 150) / 4 = 112.5 → 113.
    expect(nextAvgCost(3, 100, 1, 150)).toBe(113);
  });

  it('does not move the basis on an outbound movement (delta <= 0)', () => {
    expect(nextAvgCost(10, 500, -3, 999)).toBe(500);
    expect(nextAvgCost(10, 500, 0, 999)).toBe(500);
  });

  it('does not move the basis on an uncosted inbound movement (no unit cost)', () => {
    expect(nextAvgCost(10, 500, 5, null)).toBe(500);
  });

  it('returns null when there is no basis and no cost to establish one', () => {
    expect(nextAvgCost(0, null, -5, null)).toBeNull();
    expect(nextAvgCost(10, null, 5, null)).toBeNull();
  });

  it('clamps a negative on-hand base to zero so a backordered level re-bases cleanly', () => {
    // onHand went negative (oversold); a costed receipt re-establishes the basis
    // from the incoming cost rather than weighting against negative stock.
    expect(nextAvgCost(-4, 500, 10, 700)).toBe(700);
  });
});
