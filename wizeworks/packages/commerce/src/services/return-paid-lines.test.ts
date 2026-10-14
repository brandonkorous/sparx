import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A return is worth what the buyer paid, tax and discount included (sparx
 * persona issue 231).
 *
 * MEASURED 2026-10-13 on Gillett Diesel: Brynn O'Hara-Løvdal's O-000033, two Bosch
 * injectors at $600.00 with $87.00 of Utah tax and a $150.00 core deposit each.
 * She sent one back; the refund was worked out from the $600.00 unit price, and
 * the $43.50 of tax she paid on it stayed with the shop.
 */

const INJECTORS = 'a1111111-1111-4111-8111-111111111111';
const FILTER = 'a2222222-2222-4222-8222-222222222222';

const items = [
  {
    id: INJECTORS,
    name: 'Bosch Remanufactured Fuel Injector (0986435621)',
    sku: '0986435621',
    quantity: 2,
    unitPrice: 600,
    lineSubtotal: 1200,
    discountAmount: 0,
    taxAmount: 87,
    quantityRefunded: 0,
    coreCharge: 150,
    coresReturned: 0,
    coresKept: 0,
  },
  {
    id: FILTER,
    name: 'AirDog Fuel Filter, 2 Micron (FF100-2)',
    sku: 'FF100-2',
    quantity: 1,
    unitPrice: 31,
    lineSubtotal: 31,
    discountAmount: 0,
    taxAmount: 0,
    quantityRefunded: 0,
    coreCharge: null,
    coresReturned: 0,
    coresKept: 0,
  },
];

let returnLines: { orderItemId: string; quantity: number; approvedQuantity: number }[] = [];

const tx = {
  order: {
    findUnique: vi.fn(() =>
      Promise.resolve({ fulfilledAt: new Date(), status: 'delivered', currency: 'USD', items })
    ),
    findFirst: vi.fn(() =>
      Promise.resolve({ customerId: 'c-brynn', orderNumber: 'O-000033', customer: null, items })
    ),
  },
  returnRequest: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        id: 'ret-1',
        orderId: 'order-33',
        status: 'received',
        preferredOutcome: 'refund',
        createdAt: new Date('2026-10-13T06:40:00Z'),
        items: returnLines.map((line, index) => ({
          id: `rli-${String(index)}`,
          reasonCode: 'no_longer_needed',
          customerNote: null,
          mediaAssetIds: [],
          ...line,
        })),
        inspections: [],
        labels: [],
      })
    ),
  },
  orderPayment: { findFirst: vi.fn(() => Promise.resolve(null)) },
  orderItem: {
    findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(items.filter((item) => where.id.in.includes(item.id)))
    ),
  },
  returnLineItem: { findMany: vi.fn(() => Promise.resolve(returnLines)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { get, refundShareByLine, returnability } = await import('./return-service');
const ctx = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };

beforeEach(() => {
  returnLines = [];
});

describe('what the return form is told a line cost', () => {
  it('is the goods after any discount, and the sales tax on them', async () => {
    const found = await returnability(ctx, 'order-33');
    expect(found.lines[0]).toMatchObject({ goodsPaidCents: 120_000, taxPaidCents: 8_700 });
    expect(found.lines[1]).toMatchObject({ goodsPaidCents: 3_100, taxPaidCents: 0 });
  });
});

describe('how a refund is shared across the lines', () => {
  it('follows what each line was paid, tax included', async () => {
    // One injector ($643.50 paid) and the filter ($31.00), refunded $674.50.
    returnLines = [
      { orderItemId: INJECTORS, quantity: 1, approvedQuantity: 1 },
      { orderItemId: FILTER, quantity: 1, approvedQuantity: 1 },
    ];
    const shares = await refundShareByLine(tx as never, 'ret-1', 67_450);
    expect(shares.map((share) => share.amount)).toEqual([643.5, 31]);
  });
});

describe('what the shop is told a returned line was paid', () => {
  it('is its share of the goods and of the tax, for the units accepted back', async () => {
    returnLines = [{ orderItemId: INJECTORS, quantity: 1, approvedQuantity: 1 }];
    const detail = await get(ctx, 'ret-1');
    expect(detail.items[0]).toMatchObject({ paidGoodsCents: 60_000, paidTaxCents: 4_350 });
  });
});
