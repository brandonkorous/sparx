// A company's price tier is the tier it points at, not the text left beside it
// (sparx persona issue 086, finding 35).
//
// `companies` has two tier columns. `pricing_tier_id` prices every order;
// `pricing_tier` is free text from before the tiers table, and nothing prices from
// it. Gillett's eight accounts are all on a real tier with the text empty, so the
// CRM account screen showed Wasatch Front with no tier while the Wholesale screen
// showed it on Fleet at 12% off, and a segment rule on "Price tier" matched nobody.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const FLEET = '6b85fdb0-7a3f-4e54-8a3c-b4f4660e74c1';
const RETIRED = '0d1e2f30-4a5b-4c6d-8e7f-901234567890';
const ACCOUNT = '11111111-2222-4333-8444-555555555555';

/** A row as the database holds it for Wasatch Front: on Fleet, with stale text
 *  that names a different tier. The text is what the old readers returned. */
function wasatch(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCOUNT,
    tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508',
    companyName: 'Wasatch Front Utility Contractors, LLC',
    pricingTier: 'wholesale',
    pricingTierId: FLEET,
    pricingTierFk: { name: 'Fleet', deletedAt: null as Date | null },
    deletedAt: null,
    customProperties: {},
    status: 'active',
    updatedAt: new Date('2026-10-02T12:00:00Z'),
    ...overrides,
  };
}

const companyFindUnique = vi.fn((_args: { include?: unknown }) => Promise.resolve(wasatch()));
const companyFindMany = vi.fn((_args: { include?: unknown }) => Promise.resolve([wasatch()]));
const companyUpdate = vi.fn((args: { data: Record<string, unknown>; include?: unknown }) =>
  Promise.resolve(wasatch(args.data))
);
const companyCreate = vi.fn((args: { data: Record<string, unknown>; include?: unknown }) =>
  Promise.resolve(wasatch({ ...args.data, pricingTierFk: null }))
);
const tierFindFirst = vi.fn((args: { where: { id: string } }) =>
  Promise.resolve(args.where.id === FLEET ? { id: FLEET } : null)
);
/** The employer the contact typed on their own record. Deliberately NOT the
 *  account's name, so a reader that takes one for the other is caught. */
const TYPED_EMPLOYER = 'Doty Excavating';

/**
 * A customer row as the REAL client returns it. `company` on a customer is the
 * computed employer string (packages/db/src/client.ts), and it shadows the
 * relation: asking for `include: { company: … }` still hands back the string.
 * An earlier version of this mock returned the account under `company`, which
 * the client never does, and so the test passed over a projection whose every
 * `b2bAccount.*` rule read undefined off a string.
 */
const customerFindUnique = vi.fn((_args: { include?: unknown; select?: unknown }) =>
  // Loose on purpose: a test overrides a column with null (`companyId: null`).
  Promise.resolve<Record<string, unknown>>({
    id: 'c1',
    type: 'b2b',
    lifecycleStage: 'customer',
    leadStatus: null,
    email: 'doty@wasatchfront.example',
    tags: [],
    companyName: TYPED_EMPLOYER,
    company: TYPED_EMPLOYER,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    totalSpent: 0,
    orderCount: 0,
    firstOrderAt: null,
    lastOrderAt: null,
    assignedRepId: null,
    doNotContact: false,
    companyId: ACCOUNT,
    gdprConsent: null,
    customProperties: {},
    deletedAt: null,
  })
);

/** Wasatch Front as the trade account the customer is linked to by id. */
function wasatchAccount(overrides: Record<string, unknown> = {}) {
  return wasatch({
    creditLimit: 20000,
    creditUsed: 5000,
    fleetSize: 12,
    status: 'credit_hold',
    paymentTerms: 'net30',
    customProperties: { industry: 'utilities' },
    ...overrides,
  });
}

const tx = {
  company: {
    findUnique: companyFindUnique,
    findMany: companyFindMany,
    count: vi.fn(() => Promise.resolve(1)),
    update: companyUpdate,
    create: companyCreate,
  },
  b2bPricingTier: { findFirst: tierFindFirst },
  crmObjectDef: { findUnique: vi.fn(() => Promise.resolve(null)) },
  customer: { findUnique: customerFindUnique },
  crmActivity: { count: vi.fn(() => Promise.resolve(0)) },
  // A save asks whether the account's set-up task can close; none waits here.
  task: { findMany: vi.fn(() => Promise.resolve([])) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../../src/audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('../../src/events', () => ({ publishCrmEvent: vi.fn(() => Promise.resolve()) }));

const companyService = await import('../../src/services/company-service');
const { buildSegmentRuleProjection } = await import('../../src/consumers/segment-projection');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reading a company', () => {
  it('names the tier it is really on, not the leftover text', async () => {
    const company = await companyService.get(CTX, ACCOUNT);
    expect(company.pricingTier).toBe('Fleet');
    expect(company.pricingTierId).toBe(FLEET);
    expect(companyFindUnique.mock.calls[0]?.[0].include).toMatchObject({
      pricingTierFk: { select: { name: true } },
    });
  });

  it('says no tier when it points at none, whatever the text says', async () => {
    companyFindMany.mockResolvedValueOnce([wasatch({ pricingTierId: null, pricingTierFk: null })]);
    const { items } = await companyService.list(CTX, {});
    expect(items[0]?.pricingTier).toBeNull();
  });

  it('pays normal prices on a removed tier, and names it only as removed', async () => {
    companyFindUnique.mockResolvedValueOnce(
      wasatch({ pricingTierFk: { name: 'Fleet', deletedAt: new Date('2026-10-03T08:00:00Z') } })
    );
    const company = await companyService.get(CTX, ACCOUNT);
    expect(company.pricingTier).toBeNull();
    expect(company).toMatchObject({ removedTierName: 'Fleet' });
    expect(companyFindUnique.mock.calls[0]?.[0].include).toMatchObject({
      pricingTierFk: { select: { deletedAt: true } },
    });
  });
});

describe('the tier rule every reader shares', () => {
  const removed = { deletedAt: new Date('2026-10-03T08:00:00Z') };
  const live = { deletedAt: null };
  it('a live tier is in effect, a removed one is not', () => {
    expect(companyService.tierInEffect(live)).toBe(live);
    expect(companyService.tierInEffect(removed)).toBeNull();
    expect(companyService.tierInEffect(null)).toBeNull();
    expect(companyService.removedTier(removed)).toBe(removed);
    expect(companyService.removedTier(live)).toBeNull();
  });
});

describe('writing a company', () => {
  it('stores the tier id and never the text', async () => {
    await companyService.update(CTX, ACCOUNT, { pricingTierId: null, pricingTier: 'Gold' });
    const data = companyUpdate.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ pricingTierId: null });
    expect(data).not.toHaveProperty('pricingTier');
  });

  it('refuses a tier this business does not have', async () => {
    companyFindUnique.mockResolvedValueOnce(wasatch({ pricingTierId: null }));
    await expect(companyService.update(CTX, ACCOUNT, { pricingTierId: RETIRED })).rejects.toThrow(
      'That price tier no longer exists'
    );
    expect(companyUpdate).not.toHaveBeenCalled();
  });

  it('creates on a real tier', async () => {
    await companyService.create(CTX, { companyName: 'Red Rock', pricingTierId: FLEET });
    const data = companyCreate.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ pricingTierId: FLEET });
    expect(data).not.toHaveProperty('pricingTier');
  });
});

describe('a segment rule on price tier', () => {
  it('sees the tier the account is on', async () => {
    companyFindUnique.mockResolvedValueOnce(wasatchAccount());
    const projection = await buildSegmentRuleProjection(CTX, 'c1');
    expect(projection.b2bAccount?.pricingTier).toBe('Fleet');
    expect(companyFindUnique.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ACCOUNT },
      include: { pricingTierFk: { select: { name: true, deletedAt: true } } },
    });
  });

  it('does not see a removed tier, which prices nothing', async () => {
    companyFindUnique.mockResolvedValueOnce(
      wasatchAccount({
        pricingTierFk: { name: 'Fleet', deletedAt: new Date('2026-10-03T08:00:00Z') },
      })
    );
    const projection = await buildSegmentRuleProjection(CTX, 'c1');
    expect(projection.b2bAccount?.pricingTier).toBeNull();
  });
});

describe('a segment rule on the trade account', () => {
  it('reads the account by its id, never the employer the contact typed', async () => {
    companyFindUnique.mockResolvedValueOnce(wasatchAccount());
    const projection = await buildSegmentRuleProjection(CTX, 'c1');

    expect(projection.b2bAccount).toEqual({
      pricingTier: 'Fleet',
      creditUtilization: 0.25,
      fleetSize: 12,
      status: 'credit_hold',
      paymentTerms: 'net30',
    });
    expect(projection.custom?.company).toEqual({ industry: 'utilities' });
    // The typed employer is still the contact's own `company` field.
    expect(projection.customer.company).toBe(TYPED_EMPLOYER);
    // And the account was not asked for under the shadowed name.
    const customerArgs = customerFindUnique.mock.calls[0]?.[0] ?? {};
    expect(JSON.stringify(customerArgs)).not.toContain('company');
  });

  it('has no account for a contact linked to none, and does not look for one', async () => {
    const base = await customerFindUnique({});
    customerFindUnique.mockClear();
    customerFindUnique.mockResolvedValueOnce({ ...base, companyId: null });
    const projection = await buildSegmentRuleProjection(CTX, 'c1');
    expect(projection.b2bAccount).toBeNull();
    expect(projection.custom?.company).toBeUndefined();
    expect(companyFindUnique).not.toHaveBeenCalled();
  });

  it('has no account when the one it points at was removed', async () => {
    companyFindUnique.mockResolvedValueOnce(
      wasatchAccount({ deletedAt: new Date('2026-10-03T08:00:00Z') })
    );
    const projection = await buildSegmentRuleProjection(CTX, 'c1');
    expect(projection.b2bAccount).toBeNull();
    expect(projection.custom?.company).toBeUndefined();
  });
});
