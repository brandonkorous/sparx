import { describe, expect, it, vi } from 'vitest';

import { coreTermsForLine, recomputeCartTotals } from './cart-service';

/**
 * A REBUILT PART'S CORE DEPOSIT IS PAID, NOT SOLD (sparx persona issue 051).
 *
 * Two Bosch injectors at $580.15 with a $150.00 core deposit each, and a 10% off
 * code. The saving comes off the parts and never the deposits, which go back in
 * full. A gift card is money and may pay a deposit like anything else.
 */
function fakeTx(opts: { giftCardAppliedCents?: number; discountCents?: number } = {}) {
  const update = vi.fn().mockResolvedValue({});
  return {
    update,
    tx: {
      cartItem: {
        findMany: vi.fn().mockResolvedValue([
          { subtotalCents: 116_030, quantity: 2, coreChargeCents: 15_000 },
          { subtotalCents: 432, quantity: 1, coreChargeCents: null },
        ]),
      },
      cartDiscount: {
        findMany: vi.fn().mockResolvedValue(
          opts.discountCents
            ? [
                {
                  id: 'cd-1',
                  appliedCents: opts.discountCents,
                  discountId: 'd-1',
                  discount: {
                    status: 'active',
                    startAt: null,
                    endAt: null,
                    deletedAt: null,
                    perCustomerLimit: null,
                    totalUsageLimit: null,
                    usageCount: 0,
                  },
                },
              ]
            : []
        ),
      },
      cart: {
        findUnique: vi.fn().mockResolvedValue({ customerId: null }),
        findFirstOrThrow: vi.fn().mockResolvedValue({
          giftCardAppliedCents: opts.giftCardAppliedCents ?? 0,
          accountCreditAppliedCents: 0,
          shippingTotalCents: 0,
          taxTotalCents: 0,
        }),
        update,
      },
    },
  };
}

const CTX = { tenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0' };

async function totals(opts: Parameters<typeof fakeTx>[0] = {}) {
  const f = fakeTx(opts);
  await recomputeCartTotals(
    f.tx as unknown as Parameters<typeof recomputeCartTotals>[0],
    CTX,
    'cart-1'
  );
  return (f.update.mock.calls[0]?.[0] as { data: Record<string, number> }).data;
}

describe('a basket with core deposits', () => {
  it('keeps the deposits out of the subtotal and in the total', async () => {
    const data = await totals();
    expect(data.subtotalCents).toBe(116_462);
    expect(data.coreChargeTotalCents).toBe(30_000);
    expect(data.totalCents).toBe(146_462);
  });

  it('takes a saving off the parts, never off the deposits', async () => {
    const data = await totals({ discountCents: 11_646 });
    expect(data.discountTotalCents).toBe(11_646);
    expect(data.totalCents).toBe(116_462 - 11_646 + 30_000);
  });

  it('lets a gift card pay a deposit', async () => {
    // A card bigger than the parts still covers the deposits too.
    const data = await totals({ giftCardAppliedCents: 140_000 });
    expect(data.giftCardAppliedCents).toBe(140_000);
    expect(data.totalCents).toBe(146_462 - 140_000);
  });
});

/**
 * OR THE OLD PART COMES FIRST (sparx persona issue 057). The same injector bought
 * the other way carries no deposit at all, and a part that does not offer it
 * refuses it rather than quietly charging the deposit anyway.
 */
describe('a line bought by sending the old part first', () => {
  const offered = { coreChargeCents: 15_000, coreFirstOffered: true };

  it('carries no deposit', () => {
    expect(coreTermsForLine(offered, true)).toEqual({ coreFirst: true, coreChargeCents: null });
  });

  it('carries the deposit when the buyer pays it instead', () => {
    expect(coreTermsForLine(offered, false)).toEqual({ coreFirst: false, coreChargeCents: 15_000 });
  });

  it('is refused on a part that does not offer it', () => {
    expect(() => coreTermsForLine({ ...offered, coreFirstOffered: false }, true)).toThrow(
      /cannot be bought by sending the old part first/
    );
  });
});
