// The nightly segment recompute reads email engagement ONCE per tenant.
//
// It counted opens and clicks per customer inside its loop, two
// `CrmActivity.count` each: 74 on a 37-customer run, plus one
// `SegmentMember.findUnique` per customer per segment (219). The counts are
// now one grouped read handed to every customer's projection, and each
// customer's memberships one read. What must not change is who ends up in
// which group, so the numbers have to reach the right person.

import { beforeEach, describe, expect, it, vi } from 'vitest';

function customer(id: string) {
  return {
    id,
    type: 'individual',
    lifecycleStage: 'customer',
    leadStatus: null,
    email: `${id}@example.com`,
    tags: [],
    companyName: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    totalSpent: 0,
    orderCount: 0,
    firstOrderAt: null,
    lastOrderAt: null,
    assignedRepId: null,
    doNotContact: false,
    companyId: null,
    propertyId: null,
    gdprConsent: null,
    customProperties: {},
    deletedAt: null,
  };
}

const OPENED_SOMETHING = {
  kind: 'predicate' as const,
  field: 'email.openedLast30d',
  op: 'gte' as const,
  value: 1,
};
const CLICKED_SOMETHING = {
  kind: 'predicate' as const,
  field: 'email.clickedLast30d',
  op: 'gte' as const,
  value: 1,
};

const tx = {
  customer: {
    findMany: vi.fn(() => Promise.resolve([{ id: 'ana' }, { id: 'ben' }, { id: 'cal' }])),
    findUnique: vi.fn((args: { where: { id: string } }) =>
      Promise.resolve(customer(args.where.id))
    ),
  },
  company: { findUnique: vi.fn(() => Promise.resolve(null)) },
  // Ana opened three emails, Ben clicked two, Cal did neither.
  crmActivity: {
    groupBy: vi.fn(() =>
      Promise.resolve([
        { customerId: 'ana', type: 'email.opened', _count: { _all: 3 } },
        { customerId: 'ben', type: 'email.clicked', _count: { _all: 2 } },
      ])
    ),
    count: vi.fn(() => Promise.resolve(0)),
  },
  segment: {
    findMany: vi.fn(() =>
      Promise.resolve([
        { id: 'openers', rules: OPENED_SOMETHING },
        { id: 'clickers', rules: CLICKED_SOMETHING },
      ])
    ),
  },
  segmentMember: {
    // Cal is still listed among the openers from an earlier run.
    findMany: vi.fn((args: { where: { customerId: string } }) =>
      Promise.resolve(args.where.customerId === 'cal' ? [{ segmentId: 'openers' }] : [])
    ),
    findUnique: vi.fn(() => Promise.resolve(null)),
    create: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve({})),
  },
  segmentMembershipEvent: { create: vi.fn(() => Promise.resolve({})) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../../src/events', () => ({ publishCrmEvent: vi.fn(() => Promise.resolve()) }));

const { recomputeFull } = await import('../../src/services/segment-evaluation');

beforeEach(() => vi.clearAllMocks());

describe('segment recompute', () => {
  it('reads every customer’s engagement in one grouped query, not two counts each', async () => {
    const result = await recomputeFull({ tenantId: 't1' });

    expect(result).toEqual({ scanned: 3, changed: 3 });
    expect(tx.crmActivity.groupBy).toHaveBeenCalledTimes(1);
    expect(tx.crmActivity.count).not.toHaveBeenCalled();
    // Tenant-wide: the recompute does not hand over a list of ids.
    expect(tx.crmActivity.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customerId: { not: null } }),
      })
    );
    // One membership read per customer, not one per customer per segment.
    expect(tx.segmentMember.findMany).toHaveBeenCalledTimes(3);
    expect(tx.segmentMember.findUnique).not.toHaveBeenCalled();
  });

  it('puts each person in the groups their own numbers earn', async () => {
    await recomputeFull({ tenantId: 't1' });

    const joined = tx.segmentMember.create.mock.calls.map(
      (call: unknown[]) => (call[0] as { data: { segmentId: string; customerId: string } }).data
    );
    expect(joined).toEqual([
      expect.objectContaining({ customerId: 'ana', segmentId: 'openers' }),
      expect.objectContaining({ customerId: 'ben', segmentId: 'clickers' }),
    ]);
    // Cal opened nothing this month, so the earlier run's membership ends.
    expect(tx.segmentMember.delete).toHaveBeenCalledTimes(1);
    expect(tx.segmentMember.delete).toHaveBeenCalledWith({
      where: { segmentId_customerId: { segmentId: 'openers', customerId: 'cal' } },
    });
  });
});
