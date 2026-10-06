// The tier name on a wholesale account is the tier that prices it (sparx persona
// issue 086, finding 35). The legacy free-text column used to stand in whenever
// no tier was linked, so an account with "wholesale" typed beside it and no tier
// read "wholesale" in the accounts list while paying list price on every order.
// A REMOVED tier prices nothing either, so it is not the account's tier; the
// account screen still gets its name, to say plainly that it was removed.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: Record<string, unknown>[] = [];
const tierFindFirst = vi.fn((_args: unknown) => Promise.resolve(null));
const companyUpdate = vi.fn((args: { data: Record<string, unknown> }) =>
  Promise.resolve({ ...rows[0], ...args.data })
);

const tx = {
  company: {
    findMany: vi.fn(() => Promise.resolve(rows)),
    findFirst: vi.fn(() => Promise.resolve(rows[0] ?? null)),
    count: vi.fn(() => Promise.resolve(rows.length)),
    update: companyUpdate,
  },
  b2bPricingTier: { findFirst: tierFindFirst },
  crmObjectDef: { findUnique: vi.fn(() => Promise.resolve(null)) },
  // A save asks whether the account's set-up task can close; none waits here.
  task: { findMany: vi.fn(() => Promise.resolve([])) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { listAccounts, updateTradeConfig } = await import('./accounts');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', userId: 'user-1' };
const REMOVED = new Date('2026-10-03T08:00:00Z');
const FLEET = '6b85fdb0-7a3f-4e54-8a3c-b4f4660e74c1';

function account(
  name: string,
  tier: { id: string; name: string; deletedAt: Date | null } | null,
  text: string | null
) {
  return {
    id: name,
    companyName: name,
    taxId: null,
    website: null,
    pricingTier: text,
    pricingTierId: tier?.id ?? null,
    pricingTierFk: tier ? { ...tier, discountType: 'percentage', discountValue: 12 } : null,
    creditLimit: 0,
    creditUsed: 0,
    paymentTerms: null,
    discountPercent: 0,
    status: 'active',
    fleetSize: null,
    engineProfiles: [],
    notes: null,
    customProperties: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the tier a wholesale account is listed under', () => {
  it('is the linked tier, or none, never the leftover text', async () => {
    rows = [
      account('Wasatch Front', { id: FLEET, name: 'Fleet', deletedAt: null }, null),
      account('Harbor & Main Coffee', null, 'wholesale'),
    ];
    const { items } = await listAccounts(CTX, { take: 50, skip: 0 });
    expect(items.map((a) => [a.companyName, a.pricingTierName])).toEqual([
      ['Wasatch Front', 'Fleet'],
      ['Harbor & Main Coffee', null],
    ]);
  });

  it('is none for a removed tier, which is named only as removed', async () => {
    rows = [account('Wasatch Front', { id: FLEET, name: 'Fleet', deletedAt: REMOVED }, null)];
    const { items } = await listAccounts(CTX, { take: 50, skip: 0 });
    expect(items[0]).toMatchObject({
      pricingTierName: null,
      pricingTier: null,
      removedTierName: 'Fleet',
    });
  });
});

describe('saving an account still linked to a removed tier', () => {
  it('saves the other terms instead of refusing the tier it already had', async () => {
    rows = [account('Wasatch Front', { id: FLEET, name: 'Fleet', deletedAt: REMOVED }, null)];
    await updateTradeConfig(CTX, 'Wasatch Front', { pricingTierId: FLEET, fleetSize: 14 });
    expect(tierFindFirst).not.toHaveBeenCalled();
    expect(companyUpdate).toHaveBeenCalled();
  });

  it('still refuses moving them onto a tier that does not exist', async () => {
    rows = [account('Wasatch Front', null, null)];
    await expect(
      updateTradeConfig(CTX, 'Wasatch Front', {
        pricingTierId: '0d1e2f30-4a5b-4c6d-8e7f-901234567890',
      })
    ).rejects.toThrow();
    expect(companyUpdate).not.toHaveBeenCalled();
  });
});
