// Goods cost reaches finance (persona issue 924).
//
// The inventory sell path files a sale's stock movement under
// `referenceType: 'Order'`. Finance looked for `'order'`, matched nothing, and
// read every order's goods cost as zero: By job printed $0.00 and a 100% margin
// on every sale, and the daily rollup filed the cost under "no site", so a
// site's Profit took nothing off for goods. The movement below is written the
// way `@wizeworks/inventory` sell-path.ts writes one.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@wizeworks/db';

import { jobProfitability, provisionFinance, recomputeDay } from '../../src/index';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers';

let t: TestTenant;
let orderId: string;
let uncostedOrderId: string;
let serviceOrderId: string;
const SOLD = day('2027-04-10');

beforeAll(async () => {
  t = await createTestTenant();
  await provisionFinance(t.tenantId);
  orderId = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${t.tenantId}'`);
    const customer = await tx.customer.create({
      data: { tenantId: t.tenantId, firstName: 'Anneliese', email: 'anneliese@example.test' },
    });
    const product = await tx.product.create({
      data: { tenantId: t.tenantId, title: 'The Ash Overshirt', handle: 'ash-overshirt' },
    });
    const variant = await tx.productVariant.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        sku: 'ASH-M-CLAY',
        priceCents: 145_00,
        currency: 'USD',
      },
    });
    const warehouse = await tx.warehouse.create({
      data: { tenantId: t.tenantId, name: 'Studio', code: 'STUDIO' },
    });
    const order = await tx.order.create({
      data: {
        tenantId: t.tenantId,
        customerId: customer.id,
        propertyId: t.propertyId,
        orderNumber: 'O-000001',
        placedAt: new Date(SOLD.getTime() + 15 * 60 * 60 * 1000),
        total: 145,
        currency: 'USD',
        status: 'paid',
      },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId: t.tenantId,
        variantId: variant.id,
        warehouseId: warehouse.id,
        delta: -1,
        reason: 'sale',
        referenceType: 'Order',
        referenceId: order.id,
        unitCostCents: 58_00,
        costConsumedCents: 58_00,
        createdAt: new Date(SOLD.getTime() + 15 * 60 * 60 * 1000),
      },
    });
    // A dress nobody costed. The ledger stamps its sale 0, not null.
    const dress = await tx.productVariant.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        sku: 'DRESS-M-CHALK',
        priceCents: 145_00,
        currency: 'USD',
      },
    });
    const at = new Date(SOLD.getTime() + 16 * 60 * 60 * 1000);
    const uncosted = await tx.order.create({
      data: {
        tenantId: t.tenantId,
        customerId: customer.id,
        propertyId: t.propertyId,
        orderNumber: 'O-000002',
        placedAt: at,
        total: 145,
        currency: 'USD',
        status: 'paid',
        items: {
          create: [
            {
              tenantId: t.tenantId,
              variantId: dress.id,
              name: 'Linen Shirtdress',
              sku: 'DRESS-M-CHALK',
              quantity: 1,
              unitPrice: 145,
            },
          ],
        },
      },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId: t.tenantId,
        variantId: dress.id,
        warehouseId: warehouse.id,
        delta: -1,
        reason: 'sale',
        referenceType: 'Order',
        referenceId: uncosted.id,
        costConsumedCents: 0,
        createdAt: at,
      },
    });
    uncostedOrderId = uncosted.id;
    // A service written in at the till: no goods, so a real $0.00 of goods.
    const service = await tx.order.create({
      data: {
        tenantId: t.tenantId,
        customerId: customer.id,
        propertyId: t.propertyId,
        orderNumber: 'O-000003',
        placedAt: at,
        total: 40,
        currency: 'USD',
        status: 'paid',
        items: {
          create: [
            { tenantId: t.tenantId, name: 'Hem and alter', sku: 'HEM', quantity: 1, unitPrice: 40 },
          ],
        },
      },
    });
    serviceOrderId = service.id;
    await tx.orderItem.create({
      data: {
        tenantId: t.tenantId,
        orderId: order.id,
        variantId: variant.id,
        name: 'The Ash Overshirt',
        sku: 'ASH-M-CLAY',
        quantity: 1,
        unitPrice: 145,
      },
    });
    return order.id;
  });
});

afterAll(async () => {
  await dropTestTenant(t.tenantId);
});

describe('the cost of what an order sold', () => {
  it('is on the order’s row in By job', async () => {
    const rows = await jobProfitability(t.tenantId, {
      from: SOLD,
      to: day('2027-04-11'),
      propertyId: t.propertyId,
      types: ['order'],
    });
    const row = rows.find((r) => r.id === orderId);
    expect(row?.cogsCents).toBe(58_00);
    expect(row?.marginCents).toBe(87_00);
  });

  it('counts work done on the last day of the range, which is how "This month" ends', async () => {
    // `to` is a calendar day. Compared as an instant it meant midnight, so a sale
    // at 3 PM on the last day, today for "This month", was not there.
    const rows = await jobProfitability(t.tenantId, {
      from: SOLD,
      to: SOLD,
      propertyId: t.propertyId,
    });
    expect(rows.map((r) => r.id)).toContain(orderId);
  });

  it('says a sale’s goods cost was not recorded, instead of a 100% margin', async () => {
    const rows = await jobProfitability(t.tenantId, {
      from: SOLD,
      to: SOLD,
      propertyId: t.propertyId,
      types: ['order'],
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(uncostedOrderId)?.uncostedLines).toBe(1);
    expect(byId.get(uncostedOrderId)?.marginRate).toBeNull();
    // The costed belt and the service are measured: one has a cost, one has no goods.
    expect(byId.get(orderId)?.uncostedLines).toBe(0);
    expect(byId.get(serviceOrderId)?.uncostedLines).toBe(0);
    expect(byId.get(serviceOrderId)?.marginRate).toBe(1);
    // And it ranks after both, though its "margin" is the biggest.
    expect(rows.at(-1)?.id).toBe(uncostedOrderId);
  });

  it('is charged to the order’s site in the daily profit, not to no site', async () => {
    const rows = await recomputeDay(t.tenantId, SOLD);
    const site = rows.find((r) => r.propertyId === t.propertyId);
    expect(site?.cogsCents).toBe(58_00);
    expect(rows.find((r) => r.propertyId === null)?.cogsCents ?? 0).toBe(0);
  });
});
