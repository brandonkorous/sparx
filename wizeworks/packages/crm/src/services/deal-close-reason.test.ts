import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE REASON A DEAL WAS LOST SURVIVES THE SAVE THAT LOSES IT (sparx persona
 * issue 114).
 *
 * Doty moved "Dealer parts program for 4 Idaho shops" to Lost and typed why:
 * "Lars went with a regional distributor in Boise." Save wrote the fields (the
 * reason among them) and then moved the step, and the move set the reason to
 * whatever it was sent, which was nothing. "Deal saved", and the reason was gone.
 * A reason written while the deal was still open is now the reason it closed;
 * closing from a step that was already finished replaces the old outcome's.
 */

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const DEAL = 'fb68bac7-6aa5-4aa6-a3a8-2646b8849766';
const PIPELINE = 'e29154ed-1354-4441-b9a1-ce27e14561a4';
const QUOTE_SENT = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const WON = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const LOST = '3d4e5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7a';
const ctx = { tenantId: TENANT, userId: 'user-doty' };

const REASON = 'Lars went with a regional distributor in Boise.';

let before: Record<string, unknown>;

const stages: Record<
  string,
  { id: string; pipelineId: string; stageType: string; probability: number; name: string }
> = {
  [QUOTE_SENT]: {
    id: QUOTE_SENT,
    pipelineId: PIPELINE,
    stageType: 'open',
    probability: 50,
    name: 'Quote sent',
  },
  [WON]: { id: WON, pipelineId: PIPELINE, stageType: 'won', probability: 100, name: 'Won' },
  [LOST]: { id: LOST, pipelineId: PIPELINE, stageType: 'lost', probability: 0, name: 'Lost' },
};

const tx = {
  deal: {
    findUnique: vi.fn(() => Promise.resolve(before)),
    update: vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...before, ...args.data, id: DEAL })
    ),
  },
  pipelineStage: {
    findUnique: vi.fn((args: { where: { id: string } }) => Promise.resolve(stages[args.where.id])),
  },
  crmActivity: { create: vi.fn(() => Promise.resolve({})) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('../events', () => ({ publishCrmEvent: vi.fn(() => Promise.resolve()) }));
vi.mock('./task-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  closeWhenDealMovesOn: vi.fn(() => Promise.resolve()),
}));

const deals = await import('./deal-service');

const storedReason = (): unknown => {
  const call = tx.deal.update.mock.calls[0] as unknown as [{ data: { closedReason: unknown } }];
  return call[0].data.closedReason;
};

const deal = (stageId: string, closedReason: string | null) => ({
  id: DEAL,
  pipelineId: PIPELINE,
  stageId,
  stage: stages[stageId],
  closedReason,
  title: 'Dealer parts program for 4 Idaho shops',
  customerId: null,
  companyId: null,
  deletedAt: null,
  createdAt: new Date('2026-10-06T19:40:00Z'),
  updatedAt: new Date('2026-10-06T19:47:00Z'),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('closing a deal', () => {
  it('keeps the reason written while it was still open', async () => {
    before = deal(QUOTE_SENT, REASON);
    await deals.moveStage(ctx, DEAL, { toStageId: LOST });
    expect(storedReason()).toBe(REASON);
  });

  it('uses the reason sent with the move', async () => {
    before = deal(QUOTE_SENT, null);
    await deals.moveStage(ctx, DEAL, { toStageId: LOST, closedReason: REASON });
    expect(storedReason()).toBe(REASON);
  });

  it('drops the old outcome\u2019s reason when a won deal is moved to lost', async () => {
    before = deal(WON, 'Signed at the yard visit.');
    await deals.moveStage(ctx, DEAL, { toStageId: LOST });
    expect(storedReason()).toBeNull();
  });
});
