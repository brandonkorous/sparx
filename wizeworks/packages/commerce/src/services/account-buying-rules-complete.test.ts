import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Placing the order is the binding moment (sparx persona issue 086).
 *
 * The cart refuses a view-only contact and a broken case pack, and the card
 * form is never drawn for one, but a basket can change and an account's rules
 * can change while checkout is open. So `complete()` reads them again off the
 * settled basket, and these prove it refuses rather than writing the order.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const CART = '22222222-2222-4222-8222-222222222222';
const SESSION = '44444444-4444-4444-8444-444444444444';

let customerId = 'renee';
let roleOf: Record<string, string> = {};
let minOrderCents = 0;

const cart = () => ({
  id: CART,
  propertyId: 'site-1',
  customerId,
  currency: 'USD',
  subtotalCents: 20_000,
  discountTotalCents: 0,
  items: [
    {
      id: 'line-1',
      variantId: 'variant-1',
      quantity: 24,
      unitPriceCents: 833,
      coreChargeCents: null,
      coreFirst: false,
      repeatIntervalUnit: null,
      repeatIntervalCount: null,
      variant: {
        title: null,
        productId: 'product-1',
        sku: 'FPPF-90343',
        product: { title: 'FPPF 90343' },
      },
    },
  ],
  discounts: [],
});

const tx = {
  checkoutSession: {
    findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        'idempotencyKey' in where
          ? null
          : {
              id: SESSION,
              cartId: CART,
              step: 'review',
              channel: 'storefront',
              currency: 'USD',
              customerId,
              companyId: ACCOUNT,
              customerEmail: 'someone@wasatch.example',
              shippingAddress: { line1: '1 Depot Road' },
              shippingProviderSlug: 'flat',
              paymentProviderSlug: null,
              paymentTermsRequested: null,
              poNumber: null,
              totalCents: 20_000,
              subtotalCents: 20_000,
              discountTotalCents: 0,
              giftCardAppliedCents: 0,
              coreChargeTotalCents: 0,
              cart: cart(),
            }
      )
    ),
  },
  cart: { findFirst: vi.fn(() => Promise.resolve(cart())) },
  cartDiscount: { findMany: vi.fn(() => Promise.resolve([])) },
  customer: { findFirst: vi.fn(() => Promise.resolve({ companyId: ACCOUNT })) },
  b2bAccountContact: {
    findFirst: vi.fn(({ where }: { where: { customerId: unknown } }) => {
      const id = typeof where.customerId === 'string' ? where.customerId : null;
      const role = id ? roleOf[id] : undefined;
      return Promise.resolve(
        role
          ? { id: `c-${id ?? ''}`, role, account: { companyName: 'Wasatch Fleet Services' } }
          : null
      );
    }),
    findMany: vi.fn(() =>
      Promise.resolve([
        { role: 'primary_contact', customer: { firstName: 'Renée', lastName: null } },
      ])
    ),
  },
  b2bAccountProductOverride: { findMany: vi.fn(() => Promise.resolve([])) },
  company: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        pricingTierFk: minOrderCents > 0 ? { minOrderCents, deletedAt: null } : null,
      })
    ),
  },
  // Reaching past the rules is what a missing check looks like: the order would
  // be on its way to being written.
  order: { create: vi.fn(() => Promise.reject(new Error('the order was written'))) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../inventory-gate', () => ({ isInventoryActive: () => Promise.resolve(false) }));
vi.mock('./cart-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  recomputeCartTotals: () => Promise.resolve(),
}));

const { complete } = await import('./checkout-service');
const ctx = { tenantId: '55555555-5555-4555-8555-555555555555' };

beforeEach(() => {
  customerId = 'renee';
  roleOf = { renee: 'primary_contact', dale: 'viewer' };
  minOrderCents = 0;
});

describe('complete() keeps to the account rules', () => {
  it('refuses an order from a view-only contact', async () => {
    customerId = 'dale';
    await expect(
      complete(ctx, { sessionId: SESSION, idempotencyKey: 'order-key-1' })
    ).rejects.toThrow('Your account lets you see invoices and orders. Ask Renée to place orders.');
  });

  it('refuses an order under the account minimum', async () => {
    minOrderCents = 50_000;
    await expect(
      complete(ctx, { sessionId: SESSION, idempotencyKey: 'order-key-2' })
    ).rejects.toThrow(/^Add \$300\.00 more to reach your \$500\.00 minimum\./);
  });
});
