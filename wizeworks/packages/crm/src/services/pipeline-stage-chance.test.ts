import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fixedStageChance } from '@wizeworks/crm-schemas';

/**
 * A FINISHED STEP HAS A FIXED CHANCE (sparx persona issue 110).
 *
 * Doty built a "Fleet accounts" pipeline. "Add a step" makes an open step at 0%,
 * and he turned the last two into Won and Lost. Won stayed at 0%, and moving a
 * deal copies the step's chance onto the deal, so every deal he won there would
 * have read "0% likely" on the deal, in reports and in scoring. Won is now 100%
 * and Lost 0% wherever a step is written, and deals already on a step that
 * becomes Won take 100% with it.
 */

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const PIPELINE = '92e6d287-f191-431e-97fb-ea287f671987';
const STAGE = 'b1f5c0de-2a3b-4c4d-8e5f-6a7b8c9d0e1f';
const ctx = { tenantId: TENANT, userId: 'user-doty' };

let stored: { id: string; name: string; stageType: string; probability: number };

const tx = {
  pipeline: {
    findUnique: vi.fn(() => Promise.resolve({ id: PIPELINE, objectKey: 'deal' })),
  },
  pipelineStage: {
    findUnique: vi.fn(() => Promise.resolve({ ...stored, pipeline: { objectKey: 'deal' } })),
    create: vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: STAGE, ...args.data })
    ),
    update: vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...stored, ...args.data })
    ),
  },
  deal: {
    findMany: vi.fn(() => Promise.resolve([{ id: 'deal-wasatch' }, { id: 'deal-red-rock' }])),
    updateMany: vi.fn(() => Promise.resolve({ count: 2 })),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('./task-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  closeWhenDealMovesOn: vi.fn(() => Promise.resolve()),
}));

const pipelines = await import('./pipeline-service');

beforeEach(() => {
  stored = { id: STAGE, name: 'Won', stageType: 'open', probability: 0 };
  vi.clearAllMocks();
});

const written = (): Record<string, unknown> => {
  const call = tx.pipelineStage.update.mock.calls[0] as unknown as [
    { data: Record<string, unknown> },
  ];
  return call[0].data;
};

describe('fixedStageChance', () => {
  it('is 100 for won, 0 for any other finished type, and null while open', () => {
    expect(fixedStageChance('won')).toBe(100);
    expect(fixedStageChance('lost')).toBe(0);
    expect(fixedStageChance('resolved')).toBe(0);
    expect(fixedStageChance('open')).toBeNull();
  });
});

describe('writing a step', () => {
  it('turning a step into Won makes it 100%, and the deals on it too', async () => {
    await pipelines.updateStage(ctx, STAGE, { stageType: 'won' });
    expect(written().probability).toBe(100);
    expect(tx.deal.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['deal-wasatch', 'deal-red-rock'] } },
      data: { probability: 100 },
    });
  });

  it('a chance typed on a Won step does not stick', async () => {
    stored = { ...stored, stageType: 'won', probability: 100 };
    await pipelines.updateStage(ctx, STAGE, { probability: 40 });
    expect(written().probability).toBe(100);
  });

  it('an open step keeps the chance the business typed', async () => {
    await pipelines.updateStage(ctx, STAGE, { probability: 75 });
    expect(written().probability).toBe(75);
  });

  it('a step created as Lost is 0%', async () => {
    await pipelines.createStage(ctx, PIPELINE, {
      name: 'Lost',
      sortOrder: 5,
      stageType: 'lost',
      probability: 30,
    });
    const call = tx.pipelineStage.create.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(call[0].data.probability).toBe(0);
  });
});
