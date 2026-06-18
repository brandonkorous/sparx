// DB-backed coverage for the counts engine (docs/100 P4): a counting session
// snapshots expected on-hand, captures counted quantities, computes variance, and
// — on post — reconciles each level to the counted value via a `recount` movement
// (absolute setOnHand, so a mid-count sale is reconciled not lost). Variance value
// over the per-count threshold gates the post behind an approval. Requires
// `pnpm db:up`; skipped in CI per vitest.config.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { adjust } from '../../src/services/movements.js';
import { getLevel } from '../../src/services/levels.js';
import {
  addCountLine,
  createInventoryCount,
  enterCounts,
  getInventoryCount,
} from '../../src/services/inventory-counts.js';
import {
  approveInventoryCount,
  cancelInventoryCount,
  postInventoryCount,
  submitInventoryCount,
} from '../../src/services/inventory-count-lifecycle.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('inventory counts', () => {
  let tenantId: string;
  let warehouseId: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    warehouseId = (await createInventoryFixture(tenantId)).warehouseId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** A fresh variant (its own product) with a catalog cost (the variance basis). */
  async function newVariant(costCents = 500): Promise<string> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const product = await tx.product.create({
        data: { tenantId, title: `Part ${tag}`, handle: `part-${tag}`, status: 'active' },
      });
      const v = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          sku: `SKU-${tag}`,
          priceCents: 1000,
          costCents,
          currency: 'USD',
          isDefault: true,
        },
      });
      return v.id;
    });
  }

  async function stock(variantId: string, onHand: number): Promise<void> {
    if (onHand !== 0) {
      await adjust(ctx(), { variantId, warehouseId, delta: onHand, reason: 'manual' });
    }
  }

  async function recountMovements(countId: string): Promise<{ delta: number; reason: string }[]> {
    return withTenant(ctx(), (tx) =>
      tx.inventoryMovement.findMany({
        where: { reason: 'recount', referenceType: 'InventoryCount', referenceId: countId },
        select: { delta: true, reason: true },
      })
    );
  }

  it('full count under threshold: submit (no approval) → post reconciles on-hand', async () => {
    const a = await newVariant(); // cost 500
    const b = await newVariant();
    await stock(a, 20);
    await stock(b, 12);

    const count = await createInventoryCount(ctx(), { warehouseId, type: 'full' });
    expect(count.type).toBe('full');
    // Full count snapshots every level in the warehouse (these two + the fixture's).
    const lineA = count.lines.find((l) => l.variantId === a)!;
    const lineB = count.lines.find((l) => l.variantId === b)!;
    expect(lineA.expectedQuantity).toBe(20);
    expect(lineB.expectedQuantity).toBe(12);

    // Count every line — a matches, b is short by 2 (shrinkage).
    const entries = count.lines.map((l) => ({
      lineId: l.id,
      countedQuantity: l.variantId === b ? 10 : l.expectedQuantity,
    }));
    await enterCounts(ctx(), count.id, { entries });

    const reviewed = await submitInventoryCount(ctx(), count.id);
    expect(reviewed.status).toBe('review');
    expect(reviewed.requiresApproval).toBe(false); // 2 units × $5 = $10 < $50
    expect(reviewed.varianceValueCents).toBe(1000);

    const posted = await postInventoryCount(ctx(), count.id);
    expect(posted.status).toBe('posted');
    const postedB = posted.lines.find((l) => l.variantId === b)!;
    expect(postedB.variance).toBe(-2);
    expect(postedB.appliedDelta).toBe(-2);
    expect(postedB.movementId).not.toBeNull();

    expect((await getLevel(ctx(), b, warehouseId))!.onHand).toBe(10);
    expect((await getLevel(ctx(), a, warehouseId))!.onHand).toBe(20); // unchanged
    const moves = await recountMovements(count.id);
    expect(moves.some((m) => m.delta === -2)).toBe(true);
  });

  it('over threshold: post is blocked until an approval, then it applies', async () => {
    const a = await newVariant(); // cost 500
    await stock(a, 30);

    // $1 threshold — any real variance trips approval.
    const count = await createInventoryCount(ctx(), {
      warehouseId,
      type: 'cycle',
      variantIds: [a],
      approvalThresholdCents: 100,
    });
    await enterCounts(ctx(), count.id, {
      entries: [{ lineId: count.lines[0]!.id, countedQuantity: 25 }],
    });

    const reviewed = await submitInventoryCount(ctx(), count.id);
    expect(reviewed.requiresApproval).toBe(true); // 5 × $5 = $25 > $1
    expect(reviewed.varianceValueCents).toBe(2500);

    await expect(postInventoryCount(ctx(), count.id)).rejects.toThrow(/approv/i);

    const approved = await approveInventoryCount(ctx(), count.id);
    expect(approved.status).toBe('approved');

    const posted = await postInventoryCount(ctx(), count.id);
    expect(posted.status).toBe('posted');
    expect((await getLevel(ctx(), a, warehouseId))!.onHand).toBe(25);
  });

  it('cycle count: add a line, and a mid-count sale is reconciled by setOnHand', async () => {
    const a = await newVariant();
    const b = await newVariant();
    await stock(a, 10);
    await stock(b, 7);

    // Start a cycle count on `a` only, then add `b` while counting.
    const count = await createInventoryCount(ctx(), {
      warehouseId,
      type: 'cycle',
      variantIds: [a],
    });
    expect(count.lines).toHaveLength(1);
    const withB = await addCountLine(ctx(), count.id, { variantId: b });
    expect(withB.lines).toHaveLength(2);
    const lineA = withB.lines.find((l) => l.variantId === a)!;
    expect(lineA.expectedQuantity).toBe(10);

    // Counter records 10 for a (matches the snapshot) and 7 for b.
    await enterCounts(ctx(), count.id, {
      entries: withB.lines.map((l) => ({
        lineId: l.id,
        countedQuantity: l.variantId === a ? 10 : 7,
      })),
    });

    // A sale lands AFTER the snapshot, before the post — live on-hand for a drops to 8.
    await adjust(ctx(), { variantId: a, warehouseId, delta: -2, reason: 'sale' });

    const reviewed = await submitInventoryCount(ctx(), count.id);
    expect(reviewed.varianceValueCents).toBe(0); // counted == expected for both

    const posted = await postInventoryCount(ctx(), count.id);
    const postedA = posted.lines.find((l) => l.variantId === a)!;
    // Count-time variance is 0, but the recount reconciles to the counted 10
    // against the LIVE 8 → applied +2 (the mid-count sale is corrected, not lost).
    expect(postedA.variance).toBe(0);
    expect(postedA.appliedDelta).toBe(2);
    expect((await getLevel(ctx(), a, warehouseId))!.onHand).toBe(10);
  });

  it('blocks submitting with an uncounted line, and cancel abandons the count', async () => {
    const a = await newVariant();
    const b = await newVariant();
    await stock(a, 5);
    await stock(b, 5);

    const count = await createInventoryCount(ctx(), {
      warehouseId,
      type: 'cycle',
      variantIds: [a, b],
    });
    // Only count one line.
    await enterCounts(ctx(), count.id, {
      entries: [{ lineId: count.lines[0]!.id, countedQuantity: 5 }],
    });
    await expect(submitInventoryCount(ctx(), count.id)).rejects.toThrow(/not yet counted/i);

    const cancelled = await cancelInventoryCount(ctx(), count.id);
    expect(cancelled.status).toBe('cancelled');
    // A cancelled count applied nothing.
    expect((await getLevel(ctx(), a, warehouseId))!.onHand).toBe(5);
    const after = await getInventoryCount(ctx(), count.id);
    expect(after.status).toBe('cancelled');
  });
});
