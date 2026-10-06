import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateOption } from '@wizeworks/commerce-schemas';

/**
 * A REPEAT DELIVERY THAT CHARGED NO POSTAGE AND NO TAX (issue 916).
 *
 * Every renewal was written with its items and nothing else, so the first
 * delivery carried the shop's postage and the sales tax and every one after it
 * carried neither. For Juniper Row: a $145.00 dress every month with $9.00
 * postage, paid as $154.00 plus tax once and then $145.00 flat for ever.
 *
 * These pin the two halves: a renewal's order carries the postage of the option
 * the shopper chose and the tax on the day, and a renewal nothing can deliver
 * is held rather than sent free.
 */

const tx = {
  subscription: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  subscriptionEvent: { create: vi.fn().mockResolvedValue({}) },
  taxExemption: { findMany: vi.fn().mockResolvedValue([]) },
  // Whose certificates apply also asks which wholesale account the shopper buys
  // for (issue 075). This shopper buys for none.
  customer: { findFirst: vi.fn().mockResolvedValue({ companyId: null }) },
  b2bAccountContact: { findFirst: vi.fn().mockResolvedValue(null) },
};
const createOrder = vi.fn();
const quoteForLines = vi.fn();
const calculate = vi.fn();
const publishCommerceEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/crm', () => ({ orderService: { create: createOrder } }));
vi.mock('./shipping-service', () => ({ quoteForLines }));
vi.mock('./tax-service', () => ({ calculate }));
vi.mock('./shipping-request-resolver', () => ({
  resolveShipFromAddress: () => Promise.resolve({ country: 'US', region: 'OR' }),
}));
vi.mock('../events', () => ({
  publishCommerceEvent,
  indexCommerceEntity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { pickRenewalRate } = await import('./renewal-pricing');
const { processOccurrence } = await import('./subscription-service');

function rate(over: Partial<RateOption> & Pick<RateOption, 'rateRef' | 'amountCents'>): RateOption {
  return {
    providerSlug: 'sparx-manual',
    carrier: 'Standard',
    service: 'Post',
    currency: 'USD',
    isFreight: false,
    ...over,
  };
}

const POST = rate({ rateRef: 'manual:post', service: 'Post', amountCents: 900 });
const EXPRESS = rate({ rateRef: 'manual:express', service: 'Express', amountCents: 1800 });
const COLLECT = rate({
  rateRef: 'collection',
  providerSlug: 'collection',
  carrier: 'Collection',
  service: 'Collect in person',
  amountCents: 0,
});

describe('pickRenewalRate', () => {
  it('goes by the option the shopper chose, not the cheapest', () => {
    const picked = pickRenewalRate([POST, EXPRESS], {
      providerSlug: 'sparx-manual',
      rateRef: 'manual:express',
      description: 'Standard Express',
    });
    expect(picked).toEqual({ rate: EXPRESS, replaced: false });
  });

  it('finds a live carrier option again by its name, since its ref changes every quote', () => {
    const live = rate({
      rateRef: 'shippo:new-ref',
      providerSlug: 'shippo',
      carrier: 'USPS',
      service: 'Priority',
      amountCents: 1240,
    });
    expect(
      pickRenewalRate([POST, live], {
        providerSlug: 'shippo',
        rateRef: 'shippo:old-ref',
        description: 'USPS Priority',
      })
    ).toEqual({ rate: live, replaced: false });
  });

  it('uses the cheapest delivery when the chosen one is gone, and says so', () => {
    expect(
      pickRenewalRate([EXPRESS, POST, COLLECT], {
        providerSlug: 'sparx-manual',
        rateRef: 'manual:gone',
        description: 'Standard Gone',
      })
    ).toEqual({ rate: POST, replaced: true });
  });

  it('never stands collection in for a delivery the shopper asked for', () => {
    expect(
      pickRenewalRate([COLLECT], {
        providerSlug: 'sparx-manual',
        rateRef: 'manual:post',
        description: 'Standard Post',
      })
    ).toBeNull();
  });

  it('collects when nobody chose and collection is all the shop does', () => {
    expect(pickRenewalRate([COLLECT], null)).toEqual({ rate: COLLECT, replaced: false });
  });
});

const DUE = new Date('2026-09-01T00:00:00Z');
const TOUCHED = new Date('2026-08-01T00:00:00Z');

function subscription(over: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    customerId: 'cust-1',
    propertyId: 'a3fd094d-c8fe-48fd-b8e7-d1e0dbb42586',
    status: 'active',
    currency: 'USD',
    intervalUnit: 'month',
    intervalCount: 1,
    nextOccurrenceAt: DUE,
    updatedAt: TOUCHED,
    providerSlug: 'stripe_direct',
    providerScheduleRef: null,
    shippingAddress: {
      line1: '14 Larch Street',
      city: 'Portland',
      region: 'OR',
      postalCode: '97214',
      country: 'US',
    },
    billingAddress: null,
    shippingChoice: {
      providerSlug: 'sparx-manual',
      rateRef: 'manual:post',
      description: 'Standard Post',
    },
    items: [
      {
        variantId: 'var-1',
        quantity: 1,
        unitPriceCents: 14_500,
        variant: {
          productId: 'prod-1',
          sku: 'LSD-M',
          product: { title: 'Linen Shirtdress', taxClass: null },
        },
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  tx.subscription.findFirst.mockReset().mockResolvedValue(subscription());
  tx.subscription.update.mockClear();
  tx.subscriptionEvent.create.mockClear();
  createOrder.mockReset().mockResolvedValue({ id: 'order-2', orderNumber: 'O-000020' });
  quoteForLines.mockReset().mockResolvedValue([POST, EXPRESS]);
  calculate.mockReset().mockResolvedValue({
    totalTaxCents: 1_276,
    providerSlug: 'sparx-tax',
    breakdownRef: 'tax-1',
  });
  publishCommerceEvent.mockClear();
});

describe('processOccurrence', () => {
  it('charges a renewal the postage it chose and the tax on the day, not the items alone', async () => {
    const result = await processOccurrence({ tenantId: 't-1' }, 'sub-1', '2026-09-02T00:00:00Z');

    expect(result.orderId).toBe('order-2');
    expect(createOrder).toHaveBeenCalledTimes(1);
    const [orderCtx, input] = createOrder.mock.calls[0] as [
      { tx?: unknown },
      Record<string, unknown>,
    ];
    expect(input).toMatchObject({
      shippingTotal: 9,
      taxTotal: 12.76,
      metadata: { shippingDescription: 'Standard Post', shippingRateRef: 'manual:post' },
    });
    // The order and the schedule advance are one transaction.
    expect(orderCtx.tx).toBe(tx);

    // Tax is asked about the postage too, and about the line at its price.
    expect(calculate.mock.calls[0]?.[1]).toMatchObject({
      shippingAmountCents: 900,
      shipTo: { country: 'US', region: 'US-OR', postalCode: '97214' },
      lines: [{ variantId: 'var-1', quantity: 1, unitPriceCents: 14_500 }],
    });
    // "Free over" is judged against what this renewal costs.
    expect(quoteForLines.mock.calls[0]?.[1]).toMatchObject({
      lines: [{ variantId: 'var-1', quantity: 1, subtotalCents: 14_500 }],
    });
  });

  it('holds a renewal nothing can deliver, instead of sending it with no postage', async () => {
    quoteForLines.mockResolvedValue([COLLECT]);

    const result = await processOccurrence({ tenantId: 't-1' }, 'sub-1', '2026-09-02T00:00:00Z');

    expect(createOrder).not.toHaveBeenCalled();
    expect(result.orderId).toBeNull();
    expect(result.held).toMatch(/no longer delivers to the address/);
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: 'paused', pausedUntil: null },
    });
    expect(publishCommerceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'subscription.paused' })
    );
  });

  it('leaves it due when the repeat order changed after it was priced', async () => {
    tx.subscription.findFirst
      .mockResolvedValueOnce(subscription())
      .mockResolvedValueOnce(subscription({ updatedAt: new Date('2026-09-01T12:00:00Z') }));

    const result = await processOccurrence({ tenantId: 't-1' }, 'sub-1', '2026-09-02T00:00:00Z');

    expect(createOrder).not.toHaveBeenCalled();
    expect(result.orderId).toBeNull();
    expect(result.held).toBeUndefined();
  });

  it('keeps the cheapest delivery as the new choice when the chosen one is gone', async () => {
    quoteForLines.mockResolvedValue([EXPRESS, POST]);
    tx.subscription.findFirst.mockResolvedValue(
      subscription({
        shippingChoice: { providerSlug: 'sparx-manual', rateRef: 'manual:gone', description: 'x' },
      })
    );

    await processOccurrence({ tenantId: 't-1' }, 'sub-1', '2026-09-02T00:00:00Z');

    expect(createOrder.mock.calls[0]?.[1]).toMatchObject({ shippingTotal: 9 });
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        shippingChoice: {
          providerSlug: 'sparx-manual',
          rateRef: 'manual:post',
          description: 'Standard Post',
        },
      },
    });
  });
});
