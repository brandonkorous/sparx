import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE GATES, NOT JUST THE RULES (sparx persona issue 086).
 *
 * The rules are worthless if the doors that take an order do not ask them. These
 * drive the real cart and checkout services, the same functions the public API
 * calls, so a view-only contact or a broken case pack cannot be talked past by
 * calling the API directly instead of using the website.
 *
 * The fake transaction answers the `where` it is given for contacts, the way the
 * database would, so the role and the account are read from the signed-in
 * customer and never from anything the caller sends.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const CART = '22222222-2222-4222-8222-222222222222';
const VARIANT = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';

interface Contact {
  customerId: string;
  role: string;
}

let contacts: Contact[] = [];
let cartCustomerId: string | null = 'renee';
let caseOf: number | null = null;
let minOrderCents = 0;
let cartQuantity = 24;
let subtotalCents = 60_000;
let sessionWrites: Record<string, unknown>[] = [];
let accountTerms: string | null = 'net30';

function contactMatches(c: Contact, where: Record<string, unknown>): boolean {
  if (where.accountId !== ACCOUNT || where.isActive !== true) return false;
  if (typeof where.customerId === 'string' && c.customerId !== where.customerId) return false;
  if (
    where.customerId &&
    typeof where.customerId === 'object' &&
    c.customerId === (where.customerId as { not: string }).not
  )
    return false;
  if (where.role && !(where.role as { in: string[] }).in.includes(c.role)) return false;
  return true;
}

const contactRow = (c: Contact) => ({
  id: `contact-${c.customerId}`,
  role: c.role,
  account: { companyName: 'Wasatch Fleet Services' },
  customer: { firstName: c.customerId === 'renee' ? 'Renée' : 'Dale', lastName: null },
});

const session = () => ({
  id: SESSION,
  cartId: CART,
  step: 'payment',
  channel: 'storefront',
  currency: 'USD',
  customerId: cartCustomerId,
  companyId: cartCustomerId ? ACCOUNT : null,
  customerEmail: 'renee@wasatch.example',
  totalCents: subtotalCents,
  expiresAt: new Date(Date.now() + 3_600_000),
});

const cartRow = () => ({
  id: CART,
  channel: 'storefront',
  currency: 'USD',
  customerId: cartCustomerId,
  propertyId: null,
  customer: cartCustomerId ? { companyId: ACCOUNT } : null,
  subtotalCents,
  discountTotalCents: 0,
  items: [
    {
      id: 'line-1',
      variantId: VARIANT,
      quantity: cartQuantity,
      variant: { title: null, product: { title: 'FPPF 90343' } },
    },
  ],
});

const tx = {
  // Not bought yet: no completed checkout (sparx persona issue 087).
  cart: {
    findFirst: vi.fn(() => Promise.resolve(cartRow())),
    count: vi.fn(() => Promise.resolve(0)),
  },
  cartItem: { findMany: vi.fn(() => Promise.resolve([])) },
  customer: {
    findFirst: vi.fn(() => Promise.resolve({ companyId: cartCustomerId ? ACCOUNT : null })),
  },
  b2bAccountContact: {
    findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(contacts.filter((c) => contactMatches(c, where)).map(contactRow)[0] ?? null)
    ),
    findMany: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(contacts.filter((c) => contactMatches(c, where)).map(contactRow))
    ),
  },
  b2bAccountProductOverride: {
    findMany: vi.fn(() =>
      Promise.resolve(
        caseOf === null
          ? []
          : [{ variantId: VARIANT, minOrderQty: null, maxOrderQty: null, orderMultiple: caseOf }]
      )
    ),
  },
  productVariant: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        sku: 'FPPF-90343',
        title: null,
        coreChargeCents: null,
        coreFirstOffered: false,
        product: { title: 'FPPF 90343' },
      })
    ),
  },
  company: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        paymentTerms: accountTerms,
        pricingTierFk: minOrderCents > 0 ? { minOrderCents, deletedAt: null } : null,
      })
    ),
  },
  checkoutSession: {
    findFirst: vi.fn(() => Promise.resolve(session())),
    create: vi.fn(() => Promise.resolve({ id: SESSION })),
    update: vi.fn(({ data }: { data: Record<string, unknown> }) => {
      sessionWrites.push(data);
      return Promise.resolve(session());
    }),
  },
  tenantPaymentConfig: {
    findUnique: vi.fn(() => Promise.resolve({ gatewayId: 'stripe', isActive: true })),
  },
};

const gatewayIntent = vi.fn();

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/payments', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    paymentService: { createPaymentIntent: gatewayIntent },
  };
});
vi.mock('../audit', () => ({ writeAuditLog: () => Promise.resolve() }));
vi.mock('../events', () => ({ publishCommerceEvent: () => Promise.resolve() }));
vi.mock('../inventory-gate', () => ({ isInventoryActive: () => Promise.resolve(false) }));
vi.mock('./made-to-order-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertWithinDailyLimits: () => Promise.resolve(),
  forCart: () => Promise.resolve({ dueNowCents: 1 }),
}));
vi.mock('./pricing-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolve: () => Promise.resolve({ unitPriceCents: 2_500, trace: [] }),
}));

const { addItem, updateItem } = await import('./cart-service');
const { createPaymentIntent, start, submitPayment } = await import('./checkout-service');

const ctx = { tenantId: '55555555-5555-4555-8555-555555555555' };

beforeEach(() => {
  contacts = [
    { customerId: 'renee', role: 'primary_contact' },
    { customerId: 'dale', role: 'viewer' },
  ];
  cartCustomerId = 'renee';
  caseOf = null;
  minOrderCents = 0;
  cartQuantity = 24;
  subtotalCents = 60_000;
  sessionWrites = [];
  accountTerms = 'net30';
  gatewayIntent.mockReset();
});

describe('the cart refuses what the account may not order', () => {
  it('refuses a view-only contact on the API itself, not just on the page', async () => {
    cartCustomerId = 'dale';
    await expect(addItem(ctx, { cartId: CART, variantId: VARIANT, quantity: 1 })).rejects.toThrow(
      'Your account lets you see invoices and orders. Ask Renée to place orders.'
    );
  });

  it('refuses 5 of a case-of-12 item with the amounts that would work', async () => {
    caseOf = 12;
    await expect(addItem(ctx, { cartId: CART, variantId: VARIANT, quantity: 5 })).rejects.toThrow(
      'Wasatch Fleet Services buys FPPF 90343 in cases of 12. Choose 12, 24 or 36.'
    );
  });

  it('refuses changing a line to an amount the case pack does not allow', async () => {
    caseOf = 12;
    tx.cartItem.findMany.mockResolvedValueOnce([]);
    const findItem = vi.fn(() =>
      Promise.resolve({
        id: 'line-1',
        cartId: CART,
        variantId: VARIANT,
        unitPriceCents: 2_500,
        quantity: 12,
        inventoryReservationId: null,
        variant: { dropshipSourceId: null, coreChargeCents: null, coreFirstOffered: false },
      })
    );
    Object.assign(tx.cartItem, { findFirst: findItem });
    await expect(
      updateItem(ctx, { cartItemId: '66666666-6666-4666-8666-666666666666', quantity: 13 })
    ).rejects.toThrow(/in cases of 12\. Choose 12 or 24\./);
  });
});

describe('checkout refuses before any money moves', () => {
  it('will not open checkout for a view-only contact', async () => {
    cartCustomerId = 'dale';
    await expect(
      start(ctx, { cartId: CART, channel: 'storefront', currency: 'USD' })
    ).rejects.toThrow(/Ask Renée to place orders/);
  });

  it('refuses to start a card payment on a basket under the account minimum', async () => {
    minOrderCents = 50_000;
    subtotalCents = 38_760;
    await expect(createPaymentIntent(ctx, { sessionId: SESSION })).rejects.toThrow(
      /^Add \$112\.40 more to reach your \$500\.00 minimum\./
    );
    expect(gatewayIntent).not.toHaveBeenCalled();
  });

  it('refuses to start a card payment when a line breaks a case pack', async () => {
    caseOf = 12;
    cartQuantity = 30;
    await expect(createPaymentIntent(ctx, { sessionId: SESSION })).rejects.toThrow(
      /Choose 24 or 36/
    );
    expect(gatewayIntent).not.toHaveBeenCalled();
  });
});

describe('a PO number for a trade buyer paying by card', () => {
  // A prepay account is exactly the trade buyer who pays by card, and the one the
  // PO number used to refuse: it was read as "bill this to my account".
  it('rides along on a card payment without turning it into an order on account', async () => {
    accountTerms = 'prepay';
    await submitPayment(ctx, {
      sessionId: SESSION,
      paymentProviderSlug: 'stripe',
      paymentRef: 'pi_123',
      poNumber: 'WAS-4471',
    });
    expect(sessionWrites.at(-1)).toMatchObject({
      paymentProviderSlug: 'stripe',
      paymentRef: 'pi_123',
      poNumber: 'WAS-4471',
      paymentTermsRequested: null,
    });
  });

  it('still bills to account when a PO number comes with no card', async () => {
    await submitPayment(ctx, { sessionId: SESSION, poNumber: 'WAS-4472' });
    expect(sessionWrites.at(-1)).toMatchObject({ poNumber: 'WAS-4472', paymentRef: undefined });
  });

  it('still refuses a PO number with no card on a prepay account', async () => {
    accountTerms = 'prepay';
    await expect(submitPayment(ctx, { sessionId: SESSION, poNumber: 'WAS-4473' })).rejects.toThrow(
      /set up for prepayment/
    );
  });
});
