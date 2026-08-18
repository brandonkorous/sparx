// DB-backed coverage for the movement ledger (docs/100 §2.5, deferred from P1b →
// landed in P1e once catalog/inventory fixtures existed). The pure cost-basis
// math lives in test/ledger.test.ts; THIS suite proves the three guarantees that
// only a real Postgres can: the `onHand == Σ(movements)` invariant with a running
// `balanceAfter`, idempotency-key dedupe, the absolute `setOnHand` reconcile, and
// that the `FOR UPDATE` row lock serializes concurrent writers without losing an
// update. Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { applyMovement } from '../../src/services/ledger.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('applyMovement — DB-backed ledger invariants', () => {
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** Σ(delta) over the ledger for one (variant, warehouse) — must equal onHand. */
  async function ledgerSum(f: InventoryFixture): Promise<number> {
    const rows = await withTenant(
      { tenantId },
      (tx) =>
        tx.$queryRaw<{ sum: bigint }[]>`
        SELECT COALESCE(SUM(delta), 0)::bigint AS sum
        FROM inventory_movements
        WHERE variant_id = ${f.variantId}::uuid AND warehouse_id = ${f.warehouseId}::uuid
      `
    );
    return Number(rows[0]?.sum ?? 0);
  }

  it('keeps onHand == Σ(movements) with a running balanceAfter', async () => {
    const f = await createInventoryFixture(tenantId);
    const deltas = [100, -30, 5, -12];
    let running = 0;
    for (const delta of deltas) {
      const res = await withTenant({ tenantId }, (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          delta,
          reason: delta > 0 ? 'receive' : 'sale',
          actorType: 'system',
          ...(delta > 0 ? { unitCostCents: 500 } : {}),
        })
      );
      running += delta;
      expect(res.onHand).toBe(running);
      expect(res.appliedDelta).toBe(delta);
    }
    expect(running).toBe(63);
    expect(await ledgerSum(f)).toBe(63);

    // balanceAfter on each row is the running on-hand at that point, in order.
    const movements = await withTenant({ tenantId }, (tx) =>
      tx.inventoryMovement.findMany({
        where: { variantId: f.variantId, warehouseId: f.warehouseId },
        orderBy: { createdAt: 'asc' },
        select: { balanceAfter: true },
      })
    );
    expect(movements.map((m) => m.balanceAfter)).toEqual([100, 70, 75, 63]);
  });

  it('dedupes a repeated idempotencyKey — applies exactly once', async () => {
    const f = await createInventoryFixture(tenantId);
    const idempotencyKey = `idem-${f.variantId}`;
    const move = () =>
      withTenant({ tenantId }, (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          delta: 50,
          reason: 'receive',
          actorType: 'integration',
          source: 'fishbowl',
          idempotencyKey,
        })
      );

    const first = await move();
    expect(first.deduped).toBe(false);
    expect(first.onHand).toBe(50);

    const second = await move();
    expect(second.deduped).toBe(true);
    expect(second.appliedDelta).toBe(0);
    expect(second.onHand).toBe(50); // unchanged — the retry was absorbed

    const count = await withTenant({ tenantId }, (tx) =>
      tx.inventoryMovement.count({ where: { idempotencyKey } })
    );
    expect(count).toBe(1);
    expect(await ledgerSum(f)).toBe(50);
  });

  it('reconciles an absolute setOnHand to a corrective delta, then no-ops', async () => {
    const f = await createInventoryFixture(tenantId);
    await withTenant({ tenantId }, (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: 40,
        reason: 'receive',
        actorType: 'system',
      })
    );

    // A feed reporting "now 25 units" must reconcile to a −15 corrective movement.
    const reconcile = await withTenant({ tenantId }, (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: 0,
        setOnHand: 25,
        reason: 'sync',
        actorType: 'integration',
        source: 'fishbowl',
      })
    );
    expect(reconcile.appliedDelta).toBe(-15);
    expect(reconcile.onHand).toBe(25);

    // Reconciling to the same target again is a zero-effect no-op — no ledger row.
    const noop = await withTenant({ tenantId }, (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: 0,
        setOnHand: 25,
        reason: 'sync',
        actorType: 'integration',
      })
    );
    expect(noop.deduped).toBe(true);
    expect(noop.appliedDelta).toBe(0);

    expect(await ledgerSum(f)).toBe(25);
    const rowCount = await withTenant({ tenantId }, (tx) =>
      tx.inventoryMovement.count({
        where: { variantId: f.variantId, warehouseId: f.warehouseId },
      })
    );
    expect(rowCount).toBe(2); // the +40 receive and the −15 reconcile; the no-op wrote nothing
  });

  it('serializes concurrent writers without losing an update (FOR UPDATE lock)', async () => {
    const f = await createInventoryFixture(tenantId);
    const N = 12;
    // Each +1 runs in its OWN tenant-scoped transaction, so they genuinely
    // contend on the level's row lock. Without the lock, the read-modify-write
    // would lose updates and onHand would land below N.
    await Promise.all(
      Array.from({ length: N }, () =>
        withTenant({ tenantId }, (tx) =>
          applyMovement(tx, {
            tenantId,
            variantId: f.variantId,
            warehouseId: f.warehouseId,
            delta: 1,
            reason: 'receive',
            actorType: 'system',
          })
        )
      )
    );

    const level = await withTenant({ tenantId }, (tx) =>
      tx.inventoryLevel.findUnique({
        where: { variantId_warehouseId: { variantId: f.variantId, warehouseId: f.warehouseId } },
        select: { onHand: true },
      })
    );
    expect(level?.onHand).toBe(N);
    expect(await ledgerSum(f)).toBe(N);
  });
});
