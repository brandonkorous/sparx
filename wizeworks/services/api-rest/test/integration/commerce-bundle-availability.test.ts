// Bundle availability derived from components (docs/146 Phase 6.8).
//
// A `decrement_components` bundle has no stock of its own — buying one takes a
// unit off each of its parts. Until this shipped, nothing computed that: the
// buy-box asked the bundle's own wrapper product whether it was in stock, got
// "untracked, always available", and happily sold a gift set whose candle ran
// out last Tuesday. The customer found out at the pick face.
//
// Covered here against real Postgres + RLS, because the answer is a join across
// bundle components, stock levels and each component's sell-past-zero policy —
// none of which a fake would exercise. The four claims that matter:
//
//   1. The answer is the SMALLEST required component's coverage, and the
//      component that produced it is named.
//   2. OPTIONAL components do not gate. A bundle that ships without the ribbon
//      is not out of stock because the ribbon is.
//   3. A component that may be sold past zero does not cap the bundle — the
//      business has already said it will keep taking orders for that part.
//   4. A bundle with its OWN stock is answered by its own level row, and says
//      so rather than inventing a number from the wrong source.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withTenant } from '@wizeworks/db';
import { bundleAvailability } from '@wizeworks/commerce';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

describe('bundle availability from components', () => {
  let t: TestTenant;
  let warehouseId: string;
  const ctx = () => ({ tenantId: t.tenantId });

  beforeAll(async () => {
    t = await createTestTenant();
    await prisma.tenant.update({
      where: { id: t.tenantId },
      data: {
        settings: { modules: { commerce: { enabled: true }, inventory: { enabled: true } } },
      },
    });
    warehouseId = await withTenant(ctx(), async (tx) => {
      const w = await tx.warehouse.create({
        data: { tenantId: t.tenantId, name: 'Main', code: 'MAIN' },
        select: { id: true },
      });
      return w.id;
    });
  });
  afterAll(async () => {
    await dropTestTenant(t.tenantId);
  });

  /** A product + variant, optionally with stock on the shelf. */
  async function seedVariant(
    sku: string,
    opts: { onHand?: number; policy?: string } = {}
  ): Promise<{ productId: string; variantId: string }> {
    return withTenant(ctx(), async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId: t.tenantId,
          title: sku,
          handle: sku.toLowerCase(),
          status: 'active',
        },
        select: { id: true },
      });
      const variant = await tx.productVariant.create({
        data: {
          tenantId: t.tenantId,
          productId: product.id,
          sku,
          priceCents: 1000,
          currency: 'USD',
          isDefault: true,
          inventoryPolicy: opts.policy ?? 'deny',
        },
        select: { id: true },
      });
      if (opts.onHand !== undefined) {
        await tx.inventoryLevel.create({
          data: {
            tenantId: t.tenantId,
            variantId: variant.id,
            warehouseId,
            onHand: opts.onHand,
            allocated: 0,
          },
        });
      }
      return { productId: product.id, variantId: variant.id };
    });
  }

  async function seedBundle(
    wrapperProductId: string,
    components: { variantId: string; quantity: number; required?: boolean }[],
    inventoryMode = 'decrement_components'
  ): Promise<string> {
    return withTenant(ctx(), async (tx) => {
      const bundle = await tx.bundle.create({
        data: { tenantId: t.tenantId, bundleProductId: wrapperProductId, inventoryMode },
        select: { id: true },
      });
      for (const [index, c] of components.entries()) {
        await tx.bundleComponent.create({
          data: {
            tenantId: t.tenantId,
            bundleId: bundle.id,
            variantId: c.variantId,
            defaultQuantity: c.quantity,
            isRequired: c.required ?? true,
            position: index,
          },
        });
      }
      return bundle.id;
    });
  }

  it('is capped by the required component that runs out first, and names it', async () => {
    const candle = await seedVariant('CANDLE-A', { onHand: 9 });
    const soap = await seedVariant('SOAP-A', { onHand: 40 });
    const wrapper = await seedVariant('GIFTSET-A');
    await seedBundle(wrapper.productId, [
      { variantId: candle.variantId, quantity: 2 },
      { variantId: soap.variantId, quantity: 1 },
    ]);

    const result = await bundleAvailability(ctx(), wrapper.productId);
    expect(result).not.toBeNull();
    // 9 candles at 2 per set is 4 sets — not 4.5, because there is no half set
    // on the shelf.
    expect(result!.available).toBe(4);
    expect(result!.inStock).toBe(true);
    expect(result!.derived).toBe(true);
    // The half that turns a number into a purchase order.
    expect(result!.limitingSku).toBe('CANDLE-A');
    expect(result!.components.find((c) => c.isLimiting)?.variantSku).toBe('CANDLE-A');
  });

  it('reads zero, and out of stock, when a required component is gone', async () => {
    const bath = await seedVariant('BATH-B', { onHand: 0 });
    const towel = await seedVariant('TOWEL-B', { onHand: 100 });
    const wrapper = await seedVariant('GIFTSET-B');
    await seedBundle(wrapper.productId, [
      { variantId: bath.variantId, quantity: 1 },
      { variantId: towel.variantId, quantity: 1 },
    ]);

    const result = await bundleAvailability(ctx(), wrapper.productId);
    expect(result!.available).toBe(0);
    expect(result!.inStock).toBe(false);
    expect(result!.limitingSku).toBe('BATH-B');
  });

  it('does not let an optional component gate the bundle', async () => {
    const mug = await seedVariant('MUG-C', { onHand: 12 });
    const ribbon = await seedVariant('RIBBON-C', { onHand: 0 });
    const wrapper = await seedVariant('GIFTSET-C');
    await seedBundle(wrapper.productId, [
      { variantId: mug.variantId, quantity: 1 },
      { variantId: ribbon.variantId, quantity: 1, required: false },
    ]);

    const result = await bundleAvailability(ctx(), wrapper.productId);
    // A set that can ship without the ribbon is not out of stock because the
    // ribbon is — that is what "optional" means.
    expect(result!.available).toBe(12);
    expect(result!.inStock).toBe(true);
    expect(result!.limitingSku).toBe('MUG-C');
    // The ribbon is still REPORTED, so nobody has to wonder where it went.
    expect(result!.components.some((c) => c.variantSku === 'RIBBON-C')).toBe(true);
  });

  it('lets a sell-past-zero component off the cap, because the business already said so', async () => {
    const print = await seedVariant('PRINT-D', { onHand: 0, policy: 'continue' });
    const frame = await seedVariant('FRAME-D', { onHand: 7 });
    const wrapper = await seedVariant('GIFTSET-D');
    await seedBundle(wrapper.productId, [
      { variantId: print.variantId, quantity: 1 },
      { variantId: frame.variantId, quantity: 1 },
    ]);

    const result = await bundleAvailability(ctx(), wrapper.productId);
    // The print keeps selling at zero, so the frame is what decides.
    expect(result!.available).toBe(7);
    expect(result!.limitingSku).toBe('FRAME-D');
  });

  it('declines to answer for a bundle that keeps its own stock', async () => {
    const part = await seedVariant('PART-E', { onHand: 3 });
    const wrapper = await seedVariant('KIT-E', { onHand: 50 });
    await seedBundle(
      wrapper.productId,
      [{ variantId: part.variantId, quantity: 1 }],
      'decrement_bundle_sku'
    );

    const result = await bundleAvailability(ctx(), wrapper.productId);
    // Asking the components is the wrong question here, and a number derived
    // from them would be one nobody should act on.
    expect(result!.derived).toBe(false);
    expect(result!.available).toBeNull();
    expect(result!.inStock).toBe(true);
  });

  it('returns nothing for a product that is not a bundle', async () => {
    const plain = await seedVariant('PLAIN-F', { onHand: 5 });
    expect(await bundleAvailability(ctx(), plain.productId)).toBeNull();
  });
});
