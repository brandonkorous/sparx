// An invited person opens in the business they joined, not in the empty workspace
// sign-up made for them (sparx persona issue 124).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFind = vi.fn();
const tenantFind = vi.fn();
const memberFind = vi.fn();

vi.mock('./prisma', () => ({
  authPrisma: {
    user: { findUnique: userFind },
    tenant: { findUnique: tenantFind },
    member: { findMany: memberFind },
  },
}));

const { chooseStartingBusiness, startingBusinessFor } = await import('./starting-business');

const KENDRAS_WORKSPACE = 'd0ef9750-820d-4ad7-a1e0-02938b3ce8bf';
const GILLETT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const OTHER_SHOP = '11111111-2222-4333-8444-555555555555';

describe('chooseStartingBusiness', () => {
  it('opens an invited person in the business they joined', () => {
    expect(
      chooseStartingBusiness({
        homeIsSetUp: false,
        joined: [{ organizationId: GILLETT, joinedAt: new Date('2026-10-06T21:46:00Z') }],
      })
    ).toBe(GILLETT);
  });

  it('picks the most recent of two', () => {
    expect(
      chooseStartingBusiness({
        homeIsSetUp: false,
        joined: [
          { organizationId: OTHER_SHOP, joinedAt: new Date('2026-09-01T00:00:00Z') },
          { organizationId: GILLETT, joinedAt: new Date('2026-10-06T00:00:00Z') },
        ],
      })
    ).toBe(GILLETT);
  });

  it('opens at home for someone who runs their own business', () => {
    expect(
      chooseStartingBusiness({
        homeIsSetUp: true,
        joined: [{ organizationId: GILLETT, joinedAt: new Date() }],
      })
    ).toBeNull();
  });

  it('opens at home for someone who belongs nowhere else', () => {
    expect(chooseStartingBusiness({ homeIsSetUp: false, joined: [] })).toBeNull();
  });
});

describe('startingBusinessFor', () => {
  beforeEach(() => {
    userFind.mockReset();
    tenantFind.mockReset();
    memberFind.mockReset();
    userFind.mockResolvedValue({ tenantId: KENDRAS_WORKSPACE });
    memberFind.mockResolvedValue([
      { organizationId: GILLETT, createdAt: new Date('2026-10-06T21:46:00Z') },
    ]);
  });

  it('reads an unfinished home and the business joined', async () => {
    tenantFind.mockResolvedValue({ settings: {}, platformBrand: 'sparx' });
    expect(await startingBusinessFor('user-kendra')).toBe(GILLETT);
    // Only active memberships elsewhere, in the same product.
    expect(memberFind.mock.calls[0]?.[0]).toMatchObject({
      where: {
        userId: 'user-kendra',
        status: 'active',
        organizationId: { not: KENDRAS_WORKSPACE },
        organization: { platformBrand: 'sparx' },
      },
    });
  });

  it('keeps a finished home', async () => {
    tenantFind.mockResolvedValue({
      settings: { onboarding: { finishedAt: '2026-10-01T18:00:00Z' } },
      platformBrand: 'sparx',
    });
    expect(await startingBusinessFor('user-doty')).toBeNull();
  });
});
