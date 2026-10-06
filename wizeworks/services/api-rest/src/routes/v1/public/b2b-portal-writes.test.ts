// A connected app signed in with a READ grant cannot change anything on a trade
// account (sparx persona issue 086).
//
// The customer app permissions have no B2B write permission: `b2b:read` is the
// only B2B grant there is, and it says read. Every portal route that changes
// something (sending or answering a quote, which can place an order; building a
// quote request; Order again and saved carts, which fill a cart) takes a
// signed-in website session, the same rule the fleet routes follow. A connected
// app can still read.

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACCOUNT = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const QUOTE = '6e1f4a0c-7d0b-4c55-8a4e-3b9f6f0c2a11';
const ORDER = 'f3d0a7c2-1b5e-4f8a-9c6d-2e7b8a9c0d12';
const SAVED = '3b4c5d6e-7f80-4a1b-8c2d-3e4f5a6b7c8d';
const CART = 'c0ffee00-0000-4000-8000-000000000001';

const state = vi.hoisted(() => ({
  role: 'buyer',
  scopes: null as ReadonlySet<string> | null,
}));

// The real session rule: a bearer must hold the route's scope; a website
// session holds every scope. These tests hand a bearer `b2b:read`, so the scope
// check passes and only the write rule can refuse it.
vi.mock('../../../lib/customer-session.js', () => {
  const resolve = (scope?: string) => {
    if (state.scopes !== null && (!scope || !state.scopes.has(scope))) {
      return Promise.reject(Object.assign(new Error('scope'), { statusCode: 403 }));
    }
    return Promise.resolve({ customerId: 'customer-1', userId: 'u1', scopes: state.scopes });
  };
  return {
    requireCustomer: (_r: unknown, _c: unknown, scope?: string) => resolve(scope),
    requireCustomerId: (_r: unknown, _c: unknown, scope?: string) =>
      resolve(scope).then((c) => c.customerId),
  };
});

vi.mock('../../../lib/public-commerce-context.js', () => ({
  resolveTenantId: () => Promise.resolve('tenant-1'),
  publicCommerceContext: () =>
    Promise.resolve({ tenantId: 'tenant-1', ctx: { tenantId: 'tenant-1' } }),
  assertCartTokenForWrite: () => Promise.resolve(),
}));
vi.mock('../../../lib/invoice-render.js', () => ({
  renderTenantInvoiceHtml: vi.fn(),
  resolveInvoiceBrand: vi.fn(),
}));

const crm = vi.hoisted(() => ({
  b2bQuoteRequestService: {
    getOpen: vi.fn(() => Promise.resolve(null)),
    addItem: vi.fn(() => Promise.resolve({ id: 'r1', lines: [] })),
    save: vi.fn(() => Promise.resolve({ id: 'r1', lines: [] })),
    discard: vi.fn(() => Promise.resolve()),
    submit: vi.fn(() => Promise.resolve({ id: QUOTE, number: 'Q-000044' })),
    createRequestedQuote: vi.fn(() => Promise.resolve({ id: QUOTE, number: 'Q-000044' })),
  },
  b2bQuoteService: {
    b2bQuoteStageByName: vi.fn(() => Promise.resolve({ id: 'stage' })),
  },
  billingDocumentStageService: {
    advance: vi.fn(() => Promise.resolve({ id: QUOTE, stageId: 'stage' })),
  },
  billingDocumentConversionService: {
    convertToOrder: vi.fn(() =>
      Promise.resolve({ order: { id: ORDER, orderNumber: 'SO-1' }, held: [] })
    ),
  },
  billingDocumentService: { update: vi.fn(() => Promise.resolve()) },
}));
vi.mock('@wizeworks/crm', () => ({
  ...crm,
  accountOrderGate: { accountStandingRefusal: () => null },
  billingRenderService: { buildRenderData: vi.fn() },
  CrmValidationError: class extends Error {},
  ISSUED_BILL_WHERE: {},
  taskService: { create: vi.fn() },
}));

const commerce = vi.hoisted(() => ({
  cartRefillService: { refillCart: vi.fn(() => Promise.resolve({ added: [], skipped: [] })) },
  cartService: { claim: vi.fn(() => Promise.resolve()) },
  savedCartService: {
    list: vi.fn(() => Promise.resolve([])),
    saveFromCart: vi.fn(() => Promise.resolve({ id: SAVED })),
    rename: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    linesFor: vi.fn(() => Promise.resolve([])),
    orderLinesFor: vi.fn(() => Promise.resolve([])),
  },
}));
vi.mock('@wizeworks/commerce', () => ({
  ...commerce,
  pricingService: { resolveForAccount: vi.fn() },
  CommerceNotFoundError: class extends Error {},
  commerceSiteService: { resolveSettingsRow: vi.fn() },
}));
vi.mock('@wizeworks/inventory', () => ({ inventoryService: {} }));
// The order page asks who a held order waits on (sparx persona issue 087); no
// order here is held.
vi.mock('@wizeworks/b2b', () => ({
  approvalService: { accountOrderSignOff: () => Promise.resolve(null) },
}));
vi.mock('@wizeworks/customer-auth', () => ({}));

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      b2bAccountContact: {
        findFirst: ({ where }: { where: { accountId: string } }) =>
          Promise.resolve(where.accountId === ACCOUNT ? { role: state.role } : null),
        findMany: () => Promise.resolve([{ customerId: 'customer-1', role: state.role }]),
      },
      billingDocument: { findFirst: () => Promise.resolve({ id: QUOTE }) },
      company: { findUnique: () => Promise.resolve({ status: 'active' }) },
      property: { findFirst: () => Promise.resolve({ name: 'Gillett Diesel' }) },
    }),
}));

import portalRoutes from './b2b-portal.js';
import buyingRoutes from './b2b-portal-buying.js';

async function app() {
  const a = Fastify();
  await a.register(portalRoutes);
  await a.register(buyingRoutes);
  return a;
}

const base = `/v1/public/b2b/portal/${ACCOUNT}`;
type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Every portal route that changes something, with a body it would accept, and
 *  the service call it would make. */
const WRITES: [string, Method, string, object, () => unknown][] = [
  [
    'send a quote request in one go',
    'POST',
    `${base}/quotes`,
    { lines: [{ description: 'Brake pads', quantity: 2 }] },
    () => crm.b2bQuoteRequestService.createRequestedQuote,
  ],
  [
    'accept a quote, which places an order',
    'POST',
    `${base}/quotes/${QUOTE}/accept`,
    {},
    () => crm.billingDocumentStageService.advance,
  ],
  [
    'decline a quote',
    'POST',
    `${base}/quotes/${QUOTE}/decline`,
    {},
    () => crm.billingDocumentStageService.advance,
  ],
  [
    'add to the quote request',
    'POST',
    `${base}/quote-request/items`,
    { variantId: ORDER, quantity: 1 },
    () => crm.b2bQuoteRequestService.addItem,
  ],
  [
    'save the quote request',
    'PUT',
    `${base}/quote-request`,
    { lines: [] },
    () => crm.b2bQuoteRequestService.save,
  ],
  [
    'throw the quote request away',
    'DELETE',
    `${base}/quote-request`,
    {},
    () => crm.b2bQuoteRequestService.discard,
  ],
  [
    'send the quote request',
    'POST',
    `${base}/quote-request/submit`,
    {},
    () => crm.b2bQuoteRequestService.submit,
  ],
  [
    'order again from the account',
    'POST',
    `${base}/orders/${ORDER}/reorder`,
    { cartId: CART },
    () => commerce.cartRefillService.refillCart,
  ],
  [
    'order again from their own orders',
    'POST',
    `/v1/public/account/orders/${ORDER}/reorder`,
    { cartId: CART },
    () => commerce.cartRefillService.refillCart,
  ],
  [
    'save a cart',
    'POST',
    `${base}/saved-carts`,
    { cartId: CART, name: 'Restock' },
    () => commerce.savedCartService.saveFromCart,
  ],
  [
    'rename a saved cart',
    'PATCH',
    `${base}/saved-carts/${SAVED}`,
    { name: 'Restock, October' },
    () => commerce.savedCartService.rename,
  ],
  [
    'delete a saved cart',
    'DELETE',
    `${base}/saved-carts/${SAVED}`,
    {},
    () => commerce.savedCartService.remove,
  ],
  [
    'put a saved cart into the cart',
    'POST',
    `${base}/saved-carts/${SAVED}/add-to-cart`,
    { cartId: CART },
    () => commerce.cartRefillService.refillCart,
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  state.role = 'buyer';
  state.scopes = null;
});

describe('a connected app with a read grant', () => {
  it.each(WRITES)('cannot %s', async (_what, method, url, payload, service) => {
    state.scopes = new Set(['b2b:read']);
    const a = await app();
    const res = await a.inject({ method, url: `${url}?tenant=t`, payload });
    expect(res.statusCode).toBe(403);
    expect(service()).not.toHaveBeenCalled();
    await a.close();
  });

  it('can still read the account’s quote request and saved carts', async () => {
    state.scopes = new Set(['b2b:read']);
    const a = await app();
    expect((await a.inject({ url: `${base}/quote-request?tenant=t` })).statusCode).toBe(200);
    expect((await a.inject({ url: `${base}/quotes?tenant=t` })).statusCode).not.toBe(403);
    await a.close();
  });
});

describe('a buyer signed in on the website', () => {
  it.each(WRITES)('can %s', async (_what, method, url, payload, service) => {
    const a = await app();
    const res = await a.inject({ method, url: `${url}?tenant=t`, payload });
    expect(res.statusCode).toBeLessThan(300);
    expect(service()).toHaveBeenCalled();
    await a.close();
  });
});

// Sparx persona issue 086: a sent request starts at the account's price, so both
// ways of sending one hand the quote-making path the account's price engine.
describe('sending a request prices it for the account', () => {
  it('in one go', async () => {
    const a = await app();
    await a.inject({
      method: 'POST',
      url: `${base}/quotes?tenant=t`,
      payload: { lines: [{ description: 'Brake pads', quantity: 2 }] },
    });
    const call = crm.b2bQuoteRequestService.createRequestedQuote.mock.calls[0] as unknown[];
    expect(typeof (call[2] as { accountPrice?: unknown }).accountPrice).toBe('function');
    await a.close();
  });

  it('built up from the catalog', async () => {
    const a = await app();
    await a.inject({ method: 'POST', url: `${base}/quote-request/submit?tenant=t`, payload: {} });
    const call = crm.b2bQuoteRequestService.submit.mock.calls[0] as unknown[];
    expect(typeof (call[2] as { accountPrice?: unknown }).accountPrice).toBe('function');
    await a.close();
  });
});
