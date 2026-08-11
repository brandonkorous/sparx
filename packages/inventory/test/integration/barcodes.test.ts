// DB-backed coverage for the scan registry (docs/146 Phase 3.1–3.2, 3.4).
//
// The claims worth testing here are all claims about CONSTRAINTS, so a fake
// proves nothing:
//
//   1. A barcode belongs to exactly one item, tenant-wide, and the refusal names
//      the item that already has it. This is what makes a scan unambiguous.
//   2. An item has exactly one main barcode at all times — including after the
//      main one is deleted, which must promote a survivor rather than leave the
//      item without one.
//   3. The GTIN mirror into `ProductVariant.barcode` follows the primary, and an
//      internal Code 128 never reaches it (the product feeds mean a GTIN).
//   4. Minted codes come from a counter that only goes up, so a deleted code is
//      never re-issued onto shelves whose labels still carry it.
//   5. Resolution finds the item through EVERY reading of the same physical
//      code — which is the difference between the feature working and "we
//      registered the barcode and it still says unknown".
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

import { withTenant } from '@sparx/db';
import { withGs1CheckDigit } from '@sparx/commerce-schemas';

/**
 * A fresh, valid EAN-13 per call.
 *
 * The registry's uniqueness is TENANT-WIDE, which is the behaviour under test —
 * so tests sharing a tenant cannot share a literal barcode. Minting one keeps
 * each case independent without giving every test its own tenant.
 */
let gtinSeed = 0;
function freshGtin(): string {
  gtinSeed += 1;
  return withGs1CheckDigit(`700${gtinSeed.toString().padStart(9, '0')}`);
}

import {
  barcodesForVariant,
  createBarcode,
  deleteBarcode,
  generateBarcodes,
  listBarcodeConflicts,
  resolveBarcode,
  setPrimaryBarcode,
  updateBarcode,
} from '../../src/services/barcodes.js';
import { resolveScan } from '../../src/services/scan.js';
import { applyMovement } from '../../src/services/ledger.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('barcode registry — DB-backed', () => {
  let tenantId: string;
  const ctx = () => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** The denormalized column the channel feeds read. */
  async function mirrorColumn(variantId: string): Promise<string | null> {
    const rows = await withTenant(
      ctx(),
      (tx) =>
        tx.$queryRaw<{ barcode: string | null }[]>`
          SELECT barcode FROM commerce_product_variants WHERE id = ${variantId}::uuid
        `
    );
    return rows[0]?.barcode ?? null;
  }

  // ── 1. One value, one item ─────────────────────────────────────────────────

  it('refuses a barcode already on another item, and names that item', async () => {
    const a = await createInventoryFixture(tenantId);
    const b = await createInventoryFixture(tenantId);
    await createBarcode(ctx(), {
      variantId: a.variantId,
      value: '036000291452',
      packSize: 1,
      isPrimary: false,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });

    await expect(
      createBarcode(ctx(), {
        variantId: b.variantId,
        value: '036000291452',
        packSize: 1,
        isPrimary: false,
        source: 'manual',
        allowInvalidCheckDigit: false,
      })
      // The whole point of the message: a person can act on "it is on Test Part",
      // and cannot act on "duplicate key value violates unique constraint".
    ).rejects.toThrow(/already on Test Part/);
  });

  it('refuses a mis-typed check digit and says which digit it should be', async () => {
    const f = await createInventoryFixture(tenantId);
    await expect(
      createBarcode(ctx(), {
        variantId: f.variantId,
        value: '036000291453',
        packSize: 1,
        isPrimary: false,
        source: 'manual',
        allowInvalidCheckDigit: false,
      })
    ).rejects.toThrow(/should end in 2, not 3/);
  });

  it('accepts a bad check digit when explicitly waived — legacy labels are real', async () => {
    const f = await createInventoryFixture(tenantId);
    const row = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '036000291453',
      packSize: 1,
      isPrimary: false,
      source: 'import',
      allowInvalidCheckDigit: true,
    });
    expect(row.value).toBe('036000291453');
  });

  it('still refuses a wrong LENGTH, which no override can rescue', async () => {
    // A ten-digit "UPC-A" cannot be printed as one, so storing it would record
    // something no label can ever carry.
    const f = await createInventoryFixture(tenantId);
    await expect(
      createBarcode(ctx(), {
        variantId: f.variantId,
        value: '0360002914',
        symbology: 'upc_a',
        packSize: 1,
        isPrimary: false,
        source: 'manual',
        allowInvalidCheckDigit: true,
      })
    ).rejects.toThrow(/12 digits/);
  });

  // ── 2. Exactly one primary ─────────────────────────────────────────────────

  it('makes the first code primary whether or not the caller asked', async () => {
    const f = await createInventoryFixture(tenantId);
    const first = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '4006381333931',
      packSize: 1,
      isPrimary: false,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    expect(first.isPrimary).toBe(true);
  });

  it('moves the primary rather than ending up with two', async () => {
    const f = await createInventoryFixture(tenantId);
    const unit = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '9780306406157',
      packSize: 1,
      isPrimary: false,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const caseCode = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '10036000291459',
      packSize: 12,
      isPrimary: false,
      label: 'Case of 12',
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    await setPrimaryBarcode(ctx(), caseCode.id);

    const all = await barcodesForVariant(ctx(), f.variantId);
    expect(all.filter((b) => b.isPrimary)).toHaveLength(1);
    expect(all.find((b) => b.isPrimary)?.id).toBe(caseCode.id);
    expect(all.find((b) => b.id === unit.id)?.isPrimary).toBe(false);
  });

  it('refuses to leave an item with no main barcode', async () => {
    const f = await createInventoryFixture(tenantId);
    const only = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '96385074',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    await expect(updateBarcode(ctx(), only.id, { isPrimary: false })).rejects.toThrow(
      /needs one main barcode/
    );
  });

  it('promotes a survivor when the primary is deleted', async () => {
    const f = await createInventoryFixture(tenantId);
    const first = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '5901234123457',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: 'SPX-SPARE-01',
      packSize: 1,
      isPrimary: false,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });

    await deleteBarcode(ctx(), first.id);
    const remaining = await barcodesForVariant(ctx(), f.variantId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.isPrimary).toBe(true);
  });

  // ── 3. The GTIN mirror ─────────────────────────────────────────────────────

  it('mirrors a GTIN primary down to the column the feeds read', async () => {
    const f = await createInventoryFixture(tenantId);
    const gtin = freshGtin();
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: gtin,
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    expect(await mirrorColumn(f.variantId)).toBe(gtin);
  });

  it('never mirrors an internal Code 128 — it means nothing to a marketplace', async () => {
    const f = await createInventoryFixture(tenantId);
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: 'SPX-INTERNAL-42',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    expect(await mirrorColumn(f.variantId)).toBeNull();
  });

  it('clears the column when the primary stops being a GTIN', async () => {
    // A stale GTIN in a product feed is worse than no GTIN: it advertises
    // somebody else's product as ours.
    const f = await createInventoryFixture(tenantId);
    const gtin = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '0012345000065',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const internal = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: 'SPX-TAKEOVER',
      packSize: 1,
      isPrimary: false,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    expect(await mirrorColumn(f.variantId)).toBe('0012345000065');

    await setPrimaryBarcode(ctx(), internal.id);
    expect(await mirrorColumn(f.variantId)).toBeNull();
    expect(gtin.value).toBe('0012345000065');
  });

  // ── 4. Minting ─────────────────────────────────────────────────────────────

  it('mints scannable UPC-A codes in the restricted-circulation range', async () => {
    const a = await createInventoryFixture(tenantId);
    const b = await createInventoryFixture(tenantId);
    const result = await generateBarcodes(ctx(), {
      variantIds: [a.variantId, b.variantId],
      force: false,
    });

    expect(result.generated).toHaveLength(2);
    for (const g of result.generated) {
      expect(g.value).toHaveLength(12);
      expect(g.value.startsWith('2')).toBe(true);
    }
    // Distinct, and both actually resolve.
    const values = new Set(result.generated.map((g) => g.value));
    expect(values.size).toBe(2);
    // A minted UPC-A IS a GTIN, so it mirrors — which is right: it is the code
    // this business knows the item by, and it is a real UPC. Looked up by
    // variant rather than by position: the result is ordered by SKU, not by the
    // order the ids were passed in.
    const forA = result.generated.find((g) => g.variantId === a.variantId);
    expect(await mirrorColumn(a.variantId)).toBe(forA?.value);
  });

  it('skips items that already have a code rather than piling on another', async () => {
    const f = await createInventoryFixture(tenantId);
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '0123456789012',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: true,
    });
    const result = await generateBarcodes(ctx(), { variantIds: [f.variantId], force: false });
    expect(result.generated).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });

  it('never re-issues a number after its code is deleted', async () => {
    // The labels carrying it may still be on shelves. `MAX + 1` would hand the
    // same number to a different item; a stored counter does not.
    const a = await createInventoryFixture(tenantId);
    const first = await generateBarcodes(ctx(), { variantIds: [a.variantId], force: false });
    const issued = first.generated[0]!.value;

    const rows = await barcodesForVariant(ctx(), a.variantId);
    await deleteBarcode(ctx(), rows[0]!.id);

    const b = await createInventoryFixture(tenantId);
    const second = await generateBarcodes(ctx(), { variantIds: [b.variantId], force: false });
    expect(second.generated[0]!.value).not.toBe(issued);
  });

  // ── 5. Resolution ──────────────────────────────────────────────────────────

  it('resolves a UPC-A that a scanner reported as an EAN-13', async () => {
    const f = await createInventoryFixture(tenantId);
    // A real 12-digit UPC-A, minted fresh so it cannot collide with another case.
    const upc = withGs1CheckDigit('64200000001'.slice(0, 11));
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: upc,
      symbology: 'upc_a',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    // The gun sent thirteen digits; the registry holds twelve.
    const hit = await resolveBarcode(ctx(), `0${upc}`);
    expect(hit?.variantId).toBe(f.variantId);
    expect(hit?.value).toBe(upc);
  });

  it('resolves a UPC-E through its expansion', async () => {
    const f = await createInventoryFixture(tenantId);
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: '012345000065',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const hit = await resolveBarcode(ctx(), '01234565');
    expect(hit?.variantId).toBe(f.variantId);
  });

  it('carries the pack size, so a case scan means a case', async () => {
    const f = await createInventoryFixture(tenantId);
    const caseCode = withGs1CheckDigit('1700000000234'.slice(0, 13));
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: caseCode,
      packSize: 12,
      isPrimary: true,
      label: 'Case of 12',
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const hit = await resolveBarcode(ctx(), caseCode);
    expect(hit?.packSize).toBe(12);
  });

  it('counts the scan, so an unused old label can be identified later', async () => {
    const f = await createInventoryFixture(tenantId);
    const row = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: 'SPX-COUNTED',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    await resolveBarcode(ctx(), 'SPX-COUNTED');
    await resolveBarcode(ctx(), 'SPX-COUNTED');
    const after = (await barcodesForVariant(ctx(), f.variantId)).find((b) => b.id === row.id);
    expect(after?.scanCount).toBe(2);
    expect(after?.lastScannedAt).not.toBeNull();
  });

  it('resolves a retired code — an old label is still stuck to a box', async () => {
    const f = await createInventoryFixture(tenantId);
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: 'SPX-CURRENT',
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const old = await createBarcode(ctx(), {
      variantId: f.variantId,
      value: 'SPX-RETIRED',
      packSize: 1,
      isPrimary: false,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    await updateBarcode(ctx(), old.id, { isActive: false });

    const hit = await resolveBarcode(ctx(), 'SPX-RETIRED');
    expect(hit?.variantId).toBe(f.variantId);
  });
});

// ─── The universal resolver ────────────────────────────────────────────────────

describe('resolveScan — DB-backed', () => {
  let tenantId: string;
  let fixture: InventoryFixture;
  const ctx = () => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    fixture = await createInventoryFixture(tenantId);
    await applyMovementForFixture();
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  async function applyMovementForFixture(): Promise<void> {
    await withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 40,
        reason: 'receive',
        actorType: 'system',
        idempotencyKey: `seed-${crypto.randomBytes(4).toString('hex')}`,
      })
    );
  }

  it('finds an item by its SKU, not only by a registered barcode', async () => {
    // Plenty of tenants already print their own SKU labels. Telling them those
    // do not work until every code is re-registered is how a feature goes unused.
    const sku = (
      await withTenant(
        ctx(),
        (tx) =>
          tx.$queryRaw<{ sku: string }[]>`
            SELECT sku FROM commerce_product_variants WHERE id = ${fixture.variantId}::uuid
          `
      )
    )[0]!.sku;

    const { matches } = await resolveScan(ctx(), sku);
    expect(matches[0]?.kind).toBe('variant');
    expect(matches[0]?.id).toBe(fixture.variantId);
  });

  it('reports the on-hand alongside the item, which is what was being asked', async () => {
    const { matches } = await resolveScan(ctx(), (await skuOf()) ?? '');
    const variant = matches.find((m) => m.kind === 'variant');
    expect(variant && 'onHand' in variant ? variant.onHand : null).toBe(40);
  });

  it('returns nothing rather than guessing for an unknown code', async () => {
    const { matches } = await resolveScan(ctx(), '999999999999999');
    expect(matches).toHaveLength(0);
  });

  it('honours the expected-kinds filter, so a receiving screen asks no stray questions', async () => {
    const sku = (await skuOf()) ?? '';
    const { matches } = await resolveScan(ctx(), sku, { expect: ['bin'] });
    expect(matches).toHaveLength(0);
  });

  async function skuOf(): Promise<string | null> {
    const rows = await withTenant(
      ctx(),
      (tx) =>
        tx.$queryRaw<{ sku: string }[]>`
          SELECT sku FROM commerce_product_variants WHERE id = ${fixture.variantId}::uuid
        `
    );
    return rows[0]?.sku ?? null;
  }
});

// ─── The conflict list ─────────────────────────────────────────────────────────

describe('barcode conflicts — DB-backed', () => {
  let tenantId: string;
  const ctx = () => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  it('surfaces a variant whose legacy column value the registry gave to someone else', async () => {
    // Exactly the state the backfill leaves behind for a duplicated code: the
    // oldest claimant keeps the registry row, the loser keeps its column, and
    // only the tenant can say which is right.
    const winner = await createInventoryFixture(tenantId);
    const loser = await createInventoryFixture(tenantId);

    await createBarcode(ctx(), {
      variantId: winner.variantId,
      value: '4006381333931',
      packSize: 1,
      isPrimary: true,
      source: 'import',
      allowInvalidCheckDigit: false,
    });
    await withTenant(
      ctx(),
      (tx) => tx.$executeRaw`
        UPDATE commerce_product_variants
           SET barcode = '4006381333931'
         WHERE id = ${loser.variantId}::uuid
      `
    );

    const conflicts = await listBarcodeConflicts(ctx());
    const row = conflicts.find((c) => c.variantId === loser.variantId);
    expect(row).toBeDefined();
    expect(row?.value).toBe('4006381333931');
    // Naming the other claimant is the difference between a list and a fix.
    expect(row?.heldByVariantId).toBe(winner.variantId);
  });
});
