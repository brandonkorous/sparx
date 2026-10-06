// The console's wholesale account save (and the MCP `update_b2b_account_trade_config`
// tool, which calls the same function) closes the account's "Set up prices and
// terms" task the moment the save sets it up.
//
// Measured on Gillett: Wasatch Front Utility Contractors, LLC had the Fleet
// price tier, a $25,000 limit and Net 30, and its set-up task was still open.
// The account was set up on this screen, and this save never looked at tasks.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const FLEET = '6b85fdb0-7a3f-4e54-8a3c-b4f4660e74c1';
const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', userId: 'u-kim' };

let stored: Record<string, unknown>;
let tasks: { id: string; status: string; description: string | null; [k: string]: unknown }[];

const tx = {
  company: {
    findFirst: vi.fn(() => Promise.resolve(stored)),
    update: vi.fn((args: { data: Record<string, unknown> }) => {
      stored = { ...stored, ...args.data };
      return Promise.resolve(stored);
    }),
    // What the closer reads back once the save is written.
    findUnique: vi.fn(() =>
      Promise.resolve({
        ...stored,
        creditLimit: Number(stored.creditLimit),
        pricingTierFk: stored.pricingTierId ? { name: 'Fleet', deletedAt: null } : null,
      })
    ),
  },
  b2bPricingTier: { findFirst: vi.fn(() => Promise.resolve({ id: FLEET })) },
  crmObjectDef: { findUnique: vi.fn(() => Promise.resolve(null)) },
  task: {
    findMany: vi.fn(() => Promise.resolve(tasks.filter((t) => t.status === 'open'))),
    update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      tasks = tasks.map((t) => (t.id === where.id ? { ...t, ...data } : t));
      return Promise.resolve(tasks.find((t) => t.id === where.id));
    }),
  },
  user: {
    findUnique: vi.fn(() => Promise.resolve({ name: 'Kim Lee', email: 'kim@gillett.test' })),
  },
  tenantBusiness: { findFirst: vi.fn(() => Promise.resolve({ defaultCurrency: 'USD' })) },
  crmActivity: { create: vi.fn(() => Promise.resolve({})) },
  auditLog: { create: vi.fn(() => Promise.resolve({})) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { updateTradeConfig } = await import('./accounts');

beforeEach(() => {
  vi.clearAllMocks();
  stored = {
    id: 'co-wasatch',
    tenantId: CTX.tenantId,
    companyName: 'Wasatch Front Utility Contractors, LLC',
    taxId: null,
    website: null,
    pricingTier: null,
    pricingTierId: null,
    pricingTierFk: null,
    creditLimit: 0,
    creditUsed: 0,
    paymentTerms: null,
    discountPercent: 0,
    status: 'active',
    fleetSize: null,
    engineProfiles: [],
    notes: null,
    customProperties: {},
    deletedAt: null,
    createdAt: new Date('2026-10-02T16:50:14Z'),
    updatedAt: new Date('2026-10-02T16:50:14Z'),
  };
  tasks = [
    {
      id: 't-set-up',
      tenantId: CTX.tenantId,
      title: 'Set up prices and terms for Wasatch Front Utility Contractors, LLC',
      description: null,
      status: 'open',
      customerId: null,
      dealId: null,
      companyId: 'co-wasatch',
      closesWhenAccountSetUp: true,
    },
  ];
});

describe('saving a wholesale account', () => {
  it('closes its set-up task, done, once the save sets it up', async () => {
    await updateTradeConfig(CTX, 'co-wasatch', {
      pricingTierId: FLEET,
      paymentTerms: 'net30',
      creditLimitCents: 2_500_000,
    });
    expect(tasks[0]).toMatchObject({
      status: 'completed',
      completedByUserId: 'u-kim',
      description:
        'Kim Lee set up Wasatch Front Utility Contractors, LLC: the Fleet price tier, pay within 30 days, and a $25,000.00 credit limit.',
    });
  });

  it('leaves it open while the account is still on terms with nothing to order against', async () => {
    await updateTradeConfig(CTX, 'co-wasatch', { pricingTierId: FLEET, paymentTerms: 'net30' });
    expect(tasks[0]?.status).toBe('open');
  });
});
