import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * WHAT A BUSINESS ON ACCOUNT IS QUOTED IS WHAT CHECKOUT CHARGES IT
 * (sparx persona issue 077).
 *
 * The trade price endpoint answered from `resolve_b2b_price()` alone, and that
 * SQL function never reads a signed agreement. So a business with an agreed
 * price was quoted its group discount while the website charged the agreement.
 * `resolveForAccount` goes through `resolve`, the engine checkout uses, and says
 * which rule set the price.
 *
 * The data is Gillett Diesel's, from the dev database on 2026-10-02:
 *   Bosch injector 0986435621, list $600.00; Wasatch Front on Fleet, 12% off.
 *   FPPF fuel treatment 90343, list $22.99; Salt Lake County on Contract, 15%
 *   off, with its own price of $19.25 set from the product's trade pricing.
 */

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const INJECTOR = '6f0cf3c9-2fc3-4294-a285-643eb5ef229d';
const FUEL_TREATMENT = 'a3b542c1-877f-4f5c-bec2-6c201bf22082';
const WASATCH = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const SALT_LAKE = 'b8476910-09a3-45ff-866d-6defc9c1aa8c';
const FLEET = '6b85fdb0-7a3f-4e54-8a3c-b4f4660e74c1';
const CONTRACT_TIER = '249b3cc0-9cb0-46b4-b69a-f526cc12beff';
const AGREEMENT = '0b9c7a52-6d0e-4f33-9a51-2c7d1e8f4a10';

const LIST: Record<string, number> = { [INJECTOR]: 60000, [FUEL_TREATMENT]: 2299 };
const ACCOUNTS: Record<
  string,
  { tierId: string; tier: { name: string; discountType: string; discountValue: number } }
> = {
  [WASATCH]: {
    tierId: FLEET,
    tier: { name: 'Fleet', discountType: 'percentage', discountValue: 12 },
  },
  [SALT_LAKE]: {
    tierId: CONTRACT_TIER,
    tier: { name: 'Contract', discountType: 'percentage', discountValue: 15 },
  },
};

/** What `resolve_b2b_price()` returns for the account in each case. */
let sqlPrice: number | null;
/** A signed agreement on the line, or none. */
let contract: { id: string; priceCents: number; validTo: Date | null } | null;
/** The account's own price for the version, or none. */
let accountOverride: { priceCents: number | null; discountPercentage: number | null } | null;

const tx = {
  productVariant: {
    findFirst: vi.fn((args: { where: { id: string }; select: Record<string, unknown> }) => {
      const price = LIST[args.where.id];
      if (price === undefined) return Promise.resolve(null);
      return Promise.resolve({
        id: args.where.id,
        priceCents: price,
        currency: 'USD',
        product: { bundlesAsWrapper: [] },
      });
    }),
  },
  company: {
    findFirst: vi.fn((args: { where: { id: string } }) => {
      const account = ACCOUNTS[args.where.id];
      if (!account) return Promise.resolve(null);
      return Promise.resolve({
        id: args.where.id,
        discountPercent: 0,
        pricingTierId: account.tierId,
        pricingTierFk: account.tier,
      });
    }),
  },
  contractPrice: {
    findFirst: vi.fn((args: { where: { id?: string } }) => {
      if (!contract) return Promise.resolve(null);
      if (args.where.id && args.where.id !== contract.id) return Promise.resolve(null);
      return Promise.resolve(contract);
    }),
  },
  $queryRaw: vi.fn(() => Promise.resolve([{ price: sqlPrice }])),
  priceList: { findFirst: vi.fn(() => Promise.resolve(null)) },
  priceListEntry: { findFirst: vi.fn(() => Promise.resolve(null)) },
  bulkPriceTier: { findFirst: vi.fn(() => Promise.resolve(null)) },
  b2bAccountProductOverride: { findFirst: vi.fn(() => Promise.resolve(accountOverride)) },
  b2bTierProductOverride: { findFirst: vi.fn(() => Promise.resolve(null)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));

const { resolveForAccount } = await import('./pricing-service');

const CTX = { tenantId: TENANT };

beforeEach(() => {
  sqlPrice = null;
  contract = null;
  accountOverride = null;
});

describe('resolveForAccount', () => {
  it('quotes Wasatch Front the Fleet price for the Bosch injector, and says so', async () => {
    sqlPrice = 52800;
    const price = await resolveForAccount(CTX, { variantId: INJECTOR, accountId: WASATCH });
    expect(price.effectivePriceCents).toBe(52800);
    expect(price.listPriceCents).toBe(60000);
    expect(price.rule).toBe('tier_discount');
    expect(price.words).toBe('Fleet price: 12% off $600.00');
  });

  it("quotes Salt Lake County its own price for the fuel treatment, not the group's", async () => {
    sqlPrice = 1925;
    accountOverride = { priceCents: 1925, discountPercentage: null };
    const price = await resolveForAccount(CTX, {
      variantId: FUEL_TREATMENT,
      accountId: SALT_LAKE,
    });
    expect(price.effectivePriceCents).toBe(1925);
    expect(price.rule).toBe('account_override');
    expect(price.words).toBe('Their own price, instead of $22.99');
  });

  it('charges a signed agreement over the group discount, as checkout does', async () => {
    // The group discount alone would say $528.00. The agreement says $495.00
    // until the end of the year, and the agreement is what the website charges.
    sqlPrice = 52800;
    contract = { id: AGREEMENT, priceCents: 49500, validTo: new Date('2026-12-31T00:00:00Z') };
    const price = await resolveForAccount(CTX, { variantId: INJECTOR, accountId: WASATCH });
    expect(price.effectivePriceCents).toBe(49500);
    expect(price.rule).toBe('contract');
    expect(price.words).toBe('Agreed price until Dec 31, 2026, instead of $600.00');
  });

  it('says nothing when the list price is what they pay', async () => {
    sqlPrice = 60000;
    const price = await resolveForAccount(CTX, { variantId: INJECTOR, accountId: WASATCH });
    expect(price.effectivePriceCents).toBe(60000);
    expect(price.rule).toBe('list');
    expect(price.words).toBeNull();
  });

  it('refuses an account that does not exist rather than quoting list price under it', async () => {
    await expect(
      resolveForAccount(CTX, {
        variantId: INJECTOR,
        accountId: '00000000-0000-4000-8000-000000000000',
      })
    ).rejects.toThrow();
  });
});
