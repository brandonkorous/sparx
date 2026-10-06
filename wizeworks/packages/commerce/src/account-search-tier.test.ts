// A wholesale account in the search box says which tier it is on (sparx persona
// issue 086, finding 35). The line under its name read the legacy free-text
// column, empty on every account put on a tier from the tiers screen, so all of
// Gillett's accounts showed "Active" and none showed Fleet, Contract or Dealer.

import { describe, expect, it, vi } from 'vitest';

let row: Record<string, unknown> | null = null;
const findFirst = vi.fn((_args: { include?: unknown }) => Promise.resolve(row));

const tx = { company: { findFirst } };

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { commerceUniversalProjectors } = await import('./universal-projection');

const projector = commerceUniversalProjectors.find((p) => p.entityType === 'b2b_account');

function account(tier: { name: string; deletedAt?: Date | null } | null, text: string | null) {
  return {
    id: 'acct-1',
    companyName: 'Wasatch Front Utility Contractors, LLC',
    taxId: null,
    website: null,
    tags: [],
    notes: null,
    status: 'active',
    pricingTier: text,
    pricingTierFk: tier,
    createdAt: new Date('2026-10-02T15:00:00Z'),
    updatedAt: new Date('2026-10-02T15:00:00Z'),
  };
}

describe('a wholesale account in search', () => {
  it('shows the tier it is on, and finds it by that name', async () => {
    row = account({ name: 'Fleet' }, null);
    const doc = await projector!.project({ tenantId: 't1' }, 'acct-1');
    expect(doc?.subtitle).toBe('Fleet');
    expect(doc?.keywords).toContain('Fleet');
    expect(findFirst.mock.calls.at(-1)?.[0].include).toMatchObject({
      pricingTierFk: { select: { name: true } },
    });
  });

  it('does not name a removed tier, which prices nothing', async () => {
    row = account({ name: 'Fleet', deletedAt: new Date('2026-10-03T08:00:00Z') }, null);
    const doc = await projector!.project({ tenantId: 't1' }, 'acct-1');
    expect(doc?.subtitle).not.toBe('Fleet');
    expect(doc?.keywords ?? []).not.toContain('Fleet');
    expect(findFirst.mock.calls.at(-1)?.[0].include).toMatchObject({
      pricingTierFk: { select: { deletedAt: true } },
    });
  });

  it('shows its standing, not leftover text, when it is on no tier', async () => {
    row = account(null, 'wholesale');
    const doc = await projector!.project({ tenantId: 't1' }, 'acct-1');
    expect(doc?.subtitle).not.toMatch(/wholesale/i);
  });
});
