import { describe, expect, it, vi } from 'vitest';

/**
 * A REMOVED TIER IS NOT WHY THEY PAY WHAT THEY PAY (sparx persona issue 086,
 * finding 35).
 *
 * Removing a tier leaves the account linked to it. `resolve_b2b_price()` now
 * skips a removed tier (migration 20270530000012), so the price is the account's
 * own 5% off list. The sentence beside the price read the removed tier's name
 * and discount, could not make them add up, and fell back to "wholesale price".
 *
 * Wasatch Front, on Fleet (12% off, now removed), with 5% of its own; Bosch
 * injector, list $600.00, so it pays $570.00.
 */

const WASATCH = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const INJECTOR = '6f0cf3c9-2fc3-4294-a285-643eb5ef229d';
const FLEET = '6b85fdb0-7a3f-4e54-8a3c-b4f4660e74c1';

const tierOverrideLookup = vi.fn(() => Promise.resolve(null));

const tx = {
  productVariant: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        id: INJECTOR,
        priceCents: 60000,
        currency: 'USD',
        product: { bundlesAsWrapper: [] },
      })
    ),
  },
  company: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        id: WASATCH,
        discountPercent: 5,
        pricingTierId: FLEET,
        pricingTierFk: {
          name: 'Fleet',
          discountType: 'percentage',
          discountValue: 12,
          deletedAt: new Date('2026-10-03T08:00:00Z'),
        },
      })
    ),
  },
  contractPrice: { findFirst: vi.fn(() => Promise.resolve(null)) },
  $queryRaw: vi.fn(() => Promise.resolve([{ price: 57000 }])),
  priceList: { findFirst: vi.fn(() => Promise.resolve(null)) },
  priceListEntry: { findFirst: vi.fn(() => Promise.resolve(null)) },
  bulkPriceTier: { findFirst: vi.fn(() => Promise.resolve(null)) },
  b2bAccountProductOverride: { findFirst: vi.fn(() => Promise.resolve(null)) },
  b2bTierProductOverride: { findFirst: tierOverrideLookup },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));

const { resolveForAccount } = await import('./pricing-service');

describe('the price sentence for an account on a removed tier', () => {
  it('names their own discount, not the removed tier', async () => {
    const price = await resolveForAccount(
      { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' },
      { variantId: INJECTOR, accountId: WASATCH }
    );
    expect(price.effectivePriceCents).toBe(57000);
    expect(price.rule).toBe('account_discount');
    expect(price.words).not.toMatch(/Fleet/);
  });

  it("does not read the removed tier's product prices", async () => {
    tierOverrideLookup.mockClear();
    await resolveForAccount(
      { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' },
      { variantId: INJECTOR, accountId: WASATCH }
    );
    expect(tierOverrideLookup).not.toHaveBeenCalled();
  });
});
