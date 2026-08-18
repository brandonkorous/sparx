// Behaviour tests for the billing service's decision logic. The service is tightly
// coupled to Prisma + the platform Stripe client (true integration coverage needs a
// test DB and runs in CI), so here we mock `@wizeworks/db` and `./client` to exercise
// the logic that matters most locally: subscription item reconciliation (create,
// add/remove, cancel-on-empty) and webhook reconciliation of module flags.
// `@wizeworks/modules` (deriveModuleStates) and `./price-catalog` stay REAL.

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
      checkout: { sessions: { create: ReturnType<typeof vi.fn> } };
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

vi.mock('@wizeworks/db', () => ({
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

import { createCheckoutSession, reconcileFromSubscription, syncModuleItems } from './service';

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
    checkout: {
      sessions: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/pay/cs_1' }),
      },
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
  it('ensures the customer but does NOT create a subscription during the trial (born at checkout)', async () => {
    process.env.STRIPE_PRICE_COMMERCE_MONTHLY = 'price_commerce_m';
    h.tenantFindUnique.mockResolvedValue({
      id: 't1',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      billingInterval: 'monthly',
      trialEndsAt: null,
    });

    const r = await syncModuleItems({
      tenantId: 't1',
      email: 'a@b.co',
      enabledModules: ['commerce'],
    });

    expect(r.applied).toBe(true);
    expect(r.stripeCustomerId).toBe('cus_new');
    // The subscription is created AT CHECKOUT (createCheckoutSession), never eagerly
    // here — a card-less subscription can't carry a promotion code.
    expect(h.stub.value!.subscriptions.create).not.toHaveBeenCalled();
    // The customer is still lazily created + persisted so checkout can attach to it.
    expect(h.stub.value!.customers.create).toHaveBeenCalled();
    expect(h.tenantUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { stripeCustomerId: 'cus_new' },
    });
  });

  it('reuses an existing customer and still creates no subscription', async () => {
    process.env.STRIPE_PRICE_COMMERCE_MONTHLY = 'price_commerce_m';
    h.tenantFindUnique.mockResolvedValue({
      id: 't1',
      stripeCustomerId: 'cus_abc',
      stripeSubscriptionId: null,
      billingInterval: 'monthly',
      trialEndsAt: null,
    });

    const r = await syncModuleItems({
      tenantId: 't1',
      email: 'a@b.co',
      enabledModules: ['commerce'],
    });

    expect(r.applied).toBe(true);
    expect(r.stripeCustomerId).toBe('cus_abc');
    expect(h.stub.value!.customers.create).not.toHaveBeenCalled();
    expect(h.stub.value!.subscriptions.create).not.toHaveBeenCalled();
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

describe('createCheckoutSession', () => {
  const tenant = (over: Record<string, unknown>) => ({
    id: 't1',
    email: 'a@b.co',
    name: 'Acme',
    stripeCustomerId: 'cus_abc',
    stripeSubscriptionId: null,
    billingInterval: 'monthly',
    trialEndsAt: null,
    settings: { modules: { commerce: { enabled: true } } },
    ...over,
  });

  it('opens a subscription-mode session: a line item per module, promo box on, trial pinned', async () => {
    process.env.STRIPE_PRICE_COMMERCE_MONTHLY = 'price_commerce_m';
    const trialEndsAt = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000); // 12 days out
    h.tenantFindUnique.mockResolvedValue(tenant({ trialEndsAt }));

    const r = await createCheckoutSession('t1', {
      successUrl: 'https://s/ok',
      cancelUrl: 'https://s/no',
    });

    expect(r).toEqual({ url: 'https://checkout.stripe.test/pay/cs_1' });
    const arg = h.stub.value!.checkout.sessions.create.mock.calls[0]![0] as {
      mode: string;
      allow_promotion_codes: boolean;
      line_items: { price: string }[];
      subscription_data: {
        trial_end?: number;
        trial_settings?: { end_behavior?: { missing_payment_method?: string } };
      };
    };
    expect(arg.mode).toBe('subscription');
    // The whole point: Stripe renders the discount-code redemption box.
    expect(arg.allow_promotion_codes).toBe(true);
    expect(arg.line_items.map((i) => i.price)).toEqual(['price_commerce_m']);
    // Pinned to the signup clock (never a fresh 14 days), pauses at day 14 no-card.
    expect(arg.subscription_data.trial_end).toBe(Math.floor(trialEndsAt.getTime() / 1000));
    expect(arg.subscription_data.trial_settings?.end_behavior?.missing_payment_method).toBe(
      'pause'
    );
  });

  it('charges immediately (no trial) once the signup clock has lapsed', async () => {
    process.env.STRIPE_PRICE_COMMERCE_MONTHLY = 'price_commerce_m';
    h.tenantFindUnique.mockResolvedValue(tenant({ trialEndsAt: new Date(Date.now() - 1000) }));

    await createCheckoutSession('t1', { successUrl: 'https://s/ok', cancelUrl: 'https://s/no' });

    const arg = h.stub.value!.checkout.sessions.create.mock.calls[0]![0] as {
      subscription_data: { trial_end?: number; trial_settings?: unknown };
    };
    expect(arg.subscription_data.trial_end).toBeUndefined();
    expect(arg.subscription_data.trial_settings).toBeUndefined();
  });

  it('refuses when a subscription already exists (manage it in the portal instead)', async () => {
    h.tenantFindUnique.mockResolvedValue(tenant({ stripeSubscriptionId: 'sub_live' }));

    const r = await createCheckoutSession('t1', {
      successUrl: 'https://s/ok',
      cancelUrl: 'https://s/no',
    });

    expect(r).toEqual({ url: null, reason: 'already_active' });
    expect(h.stub.value!.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('refuses when no paid module is active (nothing to bill)', async () => {
    h.tenantFindUnique.mockResolvedValue(tenant({ settings: { modules: {} } }));

    const r = await createCheckoutSession('t1', {
      successUrl: 'https://s/ok',
      cancelUrl: 'https://s/no',
    });

    expect(r).toEqual({ url: null, reason: 'no_paid_modules' });
    expect(h.stub.value!.checkout.sessions.create).not.toHaveBeenCalled();
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
