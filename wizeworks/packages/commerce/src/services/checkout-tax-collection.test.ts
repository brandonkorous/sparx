import { describe, expect, it, vi } from 'vitest';

/**
 * A COUNTER PICKUP IS TAXED WHERE THE SHOP IS (sparx persona issue 137).
 *
 * MEASURED 2026-10-06 on Gillett Diesel: Utah sales tax switched on, 7.25%,
 * "Collecting". Wasatch Front's buyer chose "Collect in person" for two
 * injectors and the payment step showed no tax line at all. Tax was only ever
 * worked out from a delivery address, and a collection has none.
 */

const tx = {
  cart: {
    findFirst: vi.fn(() =>
      Promise.resolve({ id: 'cart-1', customerId: 'cust-1', channel: 'storefront' })
    ),
  },
  cartItem: {
    findMany: vi.fn(() =>
      Promise.resolve([
        {
          id: 'line-1',
          quantity: 1,
          unitPriceCents: 52_800,
          variantId: 'var-1',
          variant: { productId: 'prod-1', product: { taxClass: null } },
        },
      ])
    ),
  },
  cartDiscount: { findMany: vi.fn(() => Promise.resolve([])) },
  customer: { findFirst: vi.fn(() => Promise.resolve({ companyId: null })) },
  b2bAccountContact: { findFirst: vi.fn(() => Promise.resolve(null)) },
  taxExemption: { findMany: vi.fn(() => Promise.resolve([])) },
};

const calculate = vi.fn(() => Promise.resolve({ totalTaxCents: 3_828, lines: [] }));

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('./tax-service', () => ({ calculate }));
vi.mock('./shipping-request-resolver', () => ({
  resolveShipFromAddress: () =>
    Promise.resolve({
      line1: '14830 S Concord Park Dr',
      city: 'Bluffdale',
      region: 'UT',
      postalCode: '84065',
      country: 'US',
    }),
}));

const { quoteTaxForSession } = await import('./checkout-service');

describe('quoteTaxForSession for a collection', () => {
  it('prices the tax at the shop when there is no delivery address', async () => {
    const quote = await quoteTaxForSession(
      { tenantId: 't-1' },
      { cartId: 'cart-1', customerId: 'cust-1', shippingAmountCents: 0 }
    );
    expect(quote?.totalTaxCents).toBe(3_828);
    const request = (calculate.mock.calls.at(-1) as unknown[] | undefined)?.[1] as {
      shipTo: { city?: string; postalCode?: string };
    };
    expect(request.shipTo).toMatchObject({ city: 'Bluffdale', postalCode: '84065' });
  });
});
