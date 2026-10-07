import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A NEW DEAL TAKES ITS STEP'S CHANCE (sparx persona issue 113).
 *
 * Doty opened "Service plan for all 38 RAM 3500s, 2027" on Wasatch Front, on the
 * "Proposal sent" step (50%), and left Likelihood blank. The deal was stored at
 * 0%. The forecast already read 0 as "use the step's chance", but the deal page,
 * the deals list, reports and scoring read the stored 0, and moving a deal copies
 * the step's chance while creating one did not. A deal created with no estimate
 * now takes its step's chance; a typed estimate is kept; a finished step's chance
 * is fixed.
 */

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const PIPELINE = '92e6d287-f191-431e-97fb-ea287f671987';
const PROPOSAL = '3c8e1f2a-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const WON = '7d9f0a1b-2c3d-4e5f-9a6b-1c2d3e4f5a6b';
const ctx = { tenantId: TENANT, userId: 'user-doty' };

let step: { id: string; pipelineId: string; stageType: string; probability: number };

const tx = {
  pipelineStage: { findUnique: vi.fn(() => Promise.resolve(step)) },
  pipeline: {
    findUnique: vi.fn(() => Promise.resolve({ propertyId: null, objectKey: 'deal' })),
  },
  deal: {
    create: vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'deal-1',
        createdAt: new Date('2026-10-06T18:00:00Z'),
        value: { toString: () => '86400.00' },
        ...args.data,
      })
    ),
  },
  crmActivity: { create: vi.fn(() => Promise.resolve({})) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('../events', () => ({ publishCrmEvent: vi.fn(() => Promise.resolve()) }));
vi.mock('./association-service', () => ({ syncPrimaryFromColumn: vi.fn(() => Promise.resolve()) }));
vi.mock('./object-def-service', () => ({
  schemaFor: vi.fn(() => Promise.resolve({ fields: [] })),
}));

const deals = await import('./deal-service');

const input = (stageId: string, probability?: number) => ({
  pipelineId: PIPELINE,
  stageId,
  title: 'Service plan for all 38 RAM 3500s, 2027',
  value: 86400,
  ...(probability === undefined ? {} : { probability }),
});

const stored = (): unknown => {
  const call = tx.deal.create.mock.calls[0] as unknown as [{ data: { probability: unknown } }];
  return call[0].data.probability;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('creating a deal', () => {
  it('with no estimate takes the step\u2019s chance', async () => {
    step = { id: PROPOSAL, pipelineId: PIPELINE, stageType: 'open', probability: 50 };
    await deals.create(ctx, input(PROPOSAL));
    expect(Number(stored())).toBe(50);
  });

  it('keeps an estimate somebody typed', async () => {
    step = { id: PROPOSAL, pipelineId: PIPELINE, stageType: 'open', probability: 50 };
    await deals.create(ctx, input(PROPOSAL, 30));
    expect(Number(stored())).toBe(30);
  });

  it('on a Won step is 100% whatever was typed', async () => {
    step = { id: WON, pipelineId: PIPELINE, stageType: 'won', probability: 100 };
    await deals.create(ctx, input(WON, 40));
    expect(Number(stored())).toBe(100);
  });
});
