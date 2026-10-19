// The stored sparx Pay switch follows what Stripe says (sparx persona issue 326).
// The site and checkout read only the stored switch. An owner who finished
// Stripe's setup read "Active, taking payments" on Payment providers while her
// checkout said it could not take an order, because the read showed Stripe's
// live answer and saved nothing.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  gatewayId: string;
  isActive: boolean;
  onboardedAt: Date | null;
}

let row: Row;
let account: Record<string, unknown>;
const updates: Partial<Row>[] = [];
const published: unknown[] = [];

vi.mock('@wizeworks/db', () => {
  const tx = {
    tenantPaymentConfig: {
      findUnique: () => Promise.resolve({ ...row }),
      create: () => Promise.resolve({ ...row }),
      update: ({ data }: { data: Partial<Row> }) => {
        updates.push(data);
        row = { ...row, ...data };
        return Promise.resolve({ ...row });
      },
    },
  };
  return {
    prisma: {
      tenant: {
        findUnique: () => Promise.resolve({ id: TENANT, stripeAccountId: 'acct_test' }),
      },
    },
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => unknown) => fn(tx),
  };
});
vi.mock('@wizeworks/payments', () => ({
  getGatewayDescriptor: () => undefined,
  getPlatformStripe: () => ({ accounts: { retrieve: () => Promise.resolve(account) } }),
}));
vi.mock('@wizeworks/events', () => ({
  createPublisher: () => ({}),
  publishEvent: (_p: unknown, type: string) => {
    published.push(type);
    return Promise.resolve();
  },
}));
vi.mock('../env.js', () => ({ env: {} }));
vi.mock('./gateway-credentials.js', () => ({ hasActiveCredentials: () => Promise.resolve(false) }));

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const { getPaymentConfig, reconcileSparxPayAccount } = await import('./payments-onboarding.js');

const LIVE = {
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  requirements: { currently_due: [], past_due: [], pending_verification: [] },
};

beforeEach(() => {
  row = { gatewayId: 'sparx_pay', isActive: false, onboardedAt: null };
  account = LIVE;
  updates.length = 0;
  published.length = 0;
});

describe('getPaymentConfig', () => {
  it('saves a sparx Pay account Stripe now lets charge, and tells the site', async () => {
    const config = await getPaymentConfig(TENANT);
    expect(config.isActive).toBe(true);
    expect(config.onboardedAt).not.toBeNull();
    expect(row.isActive).toBe(true);
    expect(row.onboardedAt).toBeInstanceOf(Date);
    expect(published).toEqual(['site.updated']);
  });

  it('writes nothing when the stored switch already matches', async () => {
    row = { gatewayId: 'sparx_pay', isActive: true, onboardedAt: new Date() };
    await getPaymentConfig(TENANT);
    expect(updates).toEqual([]);
    expect(published).toEqual([]);
  });

  it('switches off a sparx Pay shop Stripe stopped letting charge', async () => {
    row = { gatewayId: 'sparx_pay', isActive: true, onboardedAt: new Date() };
    account = { ...LIVE, charges_enabled: false };
    const config = await getPaymentConfig(TENANT);
    expect(config.isActive).toBe(false);
    expect(row.isActive).toBe(false);
  });

  it('never touches the switch of a shop that takes payment another way', async () => {
    row = { gatewayId: 'stripe_direct', isActive: true, onboardedAt: new Date() };
    account = { ...LIVE, charges_enabled: false };
    const config = await getPaymentConfig(TENANT);
    expect(config.isActive).toBe(true);
    expect(updates).toEqual([]);
  });

  it('passes on what Stripe still needs, past due first, once each (issue 327)', async () => {
    account = {
      ...LIVE,
      charges_enabled: false,
      requirements: {
        past_due: ['individual.verification.document'],
        currently_due: ['individual.verification.document', 'external_account'],
        pending_verification: [],
      },
    };
    const config = await getPaymentConfig(TENANT);
    expect(config.sparxPay.due).toEqual(['individual.verification.document', 'external_account']);
    expect(config.sparxPay.checking).toBe(false);
  });

  it('says when Stripe is checking what it was given', async () => {
    account = {
      ...LIVE,
      charges_enabled: false,
      requirements: {
        currently_due: [],
        past_due: [],
        pending_verification: ['individual.dob.day'],
      },
    };
    expect((await getPaymentConfig(TENANT)).sparxPay.checking).toBe(true);
  });
});

describe('reconcileSparxPayAccount', () => {
  it('switches a sparx Pay shop on from account.updated', async () => {
    await reconcileSparxPayAccount({ id: 'acct_test', charges_enabled: true });
    expect(row.isActive).toBe(true);
  });

  it('leaves a shop on its own Stripe keys alone when an old sparx Pay account changes', async () => {
    row = { gatewayId: 'stripe_direct', isActive: true, onboardedAt: new Date() };
    await reconcileSparxPayAccount({ id: 'acct_test', charges_enabled: false });
    expect(row.isActive).toBe(true);
    expect(updates).toEqual([]);
  });
});
