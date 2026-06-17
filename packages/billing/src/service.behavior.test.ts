// Behaviour tests for the billing service's decision logic. The service is tightly
// coupled to Prisma + the platform Stripe client (true integration coverage needs a
// test DB and runs in CI), so here we mock `@sparx/db` and `./client` to exercise
// the logic that matters most locally: subscription item reconciliation (create,
// add/remove, cancel-on-empty) and webhook reconciliation of module flags.
// `@sparx/modules` (deriveModuleStates) and `./price-catalog` stay REAL.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock holders (hoisted so the vi.mock factories can close over them) ──────────
const h = vi.hoisted(() => {
  const stub = {
    value: null as null | {
      customers: { create: ReturnType<typeof vi.fn> };
      subscriptions: { create: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };
      subscriptionItems: {
        list: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        del: ReturnType<typeof vi.fn>;
      };
    },
  };
  return {
    stub,
    tenantFindUnique: vi.fn(),
    tenantFindFirst: vi.fn(),
    tenantUpdate: vi.fn(),
    txItems: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
});

vi.mock('./client', () => ({
  getBillingStripe: () => h.stub.value,
  isBillingConfigured: () => Boolean(h.stub.value),
}));

vi.mock('@sparx/db', () => ({
  prisma: {
    tenant: {
      findUnique: h.tenantFindUnique,
      findFirst: h.tenantFindFirst,
      update: h.tenantUpdate,
      updateMany: vi.fn(),
    },
  },
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ billingSubscriptionItem: h.txItems }),
}));

import { reconcileFromSubscription, syncModuleItems } from './service';

type Subscription = Parameters<typeof reconcileFromSubscription>[0];

function freshStripeStub() {
  return {
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_new' }) },
    subscriptions: {
      create: vi.fn().mockResolvedValue({
        id: 'sub_new',
        status: 'trialing',
        trial_end: null,
        current_period_end: null,
        cancel_at_period_end: false,
        items: { data: [] },
      }),
      cancel: vi.fn().mockResolvedValue({ id: 'sub_old', status: 'canceled' }),
    },
    subscriptionItems: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: 'si_new' }),
      del: vi.fn().mockResolvedValue({}),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.stub.value = freshStripeStub();
  h.txItems.findMany.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.STRIPE_PRICE_COMMERCE_MONTHLY;
});

describe('syncModuleItems', () => {
  it('creates a subscription with one item per billable module (no transaction-fee line)', async () => {
    process.env.STRIPE_PRICE_COMMERCE_MONTHLY = 'price_commerce_m';
    h.tenantFindUnique.mockResolvedValue({
      id: 't1',
      stripeCustomerId: 'cus_abc',
      stripeSubscriptionId: null,
      billingInterval: 'monthly',
    });

    const r = await syncModuleItems({
      tenantId: 't1',
      email: 'a@b.co',
      enabledModules: ['commerce'],
    });

    expect(r.applied).toBe(true);
    const call = h.stub.value!.subscriptions.create.mock.calls[0];
    expect(call).toBeDefined();
    const createArg = call![0] as { items: { price: string }[] };
    // Exactly the module item — the sparx Pay 0.5% fee is collected at charge time
    // (application_fee_amount), never as a metered subscription line (docs/94 §8).
    expect(createArg.items.map((i) => i.price)).toEqual(['price_commerce_m']);
  });

  it('cancels the subscription when the last billable module is disabled', async () => {
    h.tenantFindUnique.mockResolvedValue({
      id: 't1',
      stripeCustomerId: 'cus_abc',
      stripeSubscriptionId: 'sub_old',
      billingInterval: 'monthly',
    });

    const r = await syncModuleItems({ tenantId: 't1', email: 'a@b.co', enabledModules: [] });

    expect(r.applied).toBe(true);
    expect(h.stub.value!.subscriptions.cancel).toHaveBeenCalledWith('sub_old');
    expect(h.txItems.deleteMany).toHaveBeenCalled();
    expect(h.tenantUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { stripeSubscriptionId: null },
    });
  });
});

describe('reconcileFromSubscription', () => {
  it('enables a billable module flag when its price is an item on the subscription', async () => {
    process.env.STRIPE_PRICE_COMMERCE_MONTHLY = 'price_commerce_m';
    h.tenantFindFirst.mockResolvedValue({ id: 't1', settings: { modules: {} } });

    await reconcileFromSubscription({
      id: 'sub_1',
      customer: 'cus_abc',
      status: 'active',
      trial_end: null,
      current_period_end: 1_000,
      cancel_at_period_end: false,
      items: { data: [{ id: 'si_1', price: { id: 'price_commerce_m' } }] },
    } as unknown as Subscription);

    // The final settings write turns commerce.enabled on.
    const writes = h.tenantUpdate.mock.calls.map((c) => c[0] as { data?: { settings?: unknown } });
    const settingsWrite = writes.find((w) => w.data?.settings);
    expect(settingsWrite).toBeTruthy();
    const modules = (
      settingsWrite!.data!.settings as { modules: Record<string, { enabled: boolean }> }
    ).modules;
    expect(modules.commerce?.enabled).toBe(true);
  });

  it('disables billable module flags when the subscription is canceled', async () => {
    process.env.STRIPE_PRICE_COMMERCE_MONTHLY = 'price_commerce_m';
    h.tenantFindFirst.mockResolvedValue({
      id: 't1',
      settings: { modules: { commerce: { enabled: true } } },
    });

    await reconcileFromSubscription({
      id: 'sub_1',
      customer: 'cus_abc',
      status: 'canceled',
      trial_end: null,
      current_period_end: 1_000,
      cancel_at_period_end: false,
      items: { data: [{ id: 'si_1', price: { id: 'price_commerce_m' } }] },
    } as unknown as Subscription);

    const writes = h.tenantUpdate.mock.calls.map((c) => c[0] as { data?: { settings?: unknown } });
    const settingsWrite = writes.find((w) => w.data?.settings);
    const modules = (
      settingsWrite!.data!.settings as { modules: Record<string, { enabled: boolean }> }
    ).modules;
    expect(modules.commerce?.enabled).toBe(false);
  });

  it('never clears a bundled capability’s standalone flag (it carries no Stripe item)', async () => {
    process.env.STRIPE_PRICE_COMMERCE_MONTHLY = 'price_commerce_m';
    // Commerce on (provider) + invoicing bought standalone. Invoicing is bundled
    // free, so it has NO Stripe item — the reconciler must leave its flag set, or
    // a later Commerce teardown would silently lose the tenant's invoicing.
    h.tenantFindFirst.mockResolvedValue({
      id: 't1',
      settings: { modules: { commerce: { enabled: true }, invoicing: { enabled: true } } },
    });

    await reconcileFromSubscription({
      id: 'sub_1',
      customer: 'cus_abc',
      status: 'active',
      trial_end: null,
      current_period_end: 1_000,
      cancel_at_period_end: false,
      items: { data: [{ id: 'si_1', price: { id: 'price_commerce_m' } }] }, // no invoicing item
    } as unknown as Subscription);

    // No settings write may turn invoicing off (edit leaves it untouched entirely).
    const settingsWrites = h.tenantUpdate.mock.calls
      .map(
        (c) => c[0] as { data?: { settings?: { modules?: Record<string, { enabled?: boolean }> } } }
      )
      .filter((w) => w.data?.settings);
    for (const w of settingsWrites) {
      expect(w.data!.settings!.modules!.invoicing?.enabled).not.toBe(false);
    }
  });
});
