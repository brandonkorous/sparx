// "Recent order" listed every customer who has NEVER ordered ahead of every
// customer who has (issue 322).
//
// Postgres treats a null as the largest value, so `ORDER BY … DESC` is
// NULLS FIRST — and `lastOrderAt` is the only nullable sort field on this list
// (`score` and `totalSpent` default to 0; the timestamps are required). Juniper
// Row's one buyer sat at row 30 of 30, and the MCP win-back tool, which asked
// for a page of that same ordering and then discarded the nulls, threw its whole
// page away and returned nothing on every call.
//
// These assert the QUERY SHAPE rather than rows, because the shape is what
// regressed and it is invisible in any fixture that has no nulls in it.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn().mockResolvedValue([]);
const count = vi.fn().mockResolvedValue(0);

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn({ customer: { findMany, count } })),
}));

const { list } = await import('./customer-service');

const CTX = { tenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0' };
const args = (): Record<string, unknown> =>
  (findMany.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;

beforeEach(() => {
  findMany.mockClear();
  count.mockClear();
});

describe('customerService.list ordering', () => {
  it('puts customers with no order LAST when sorting by recent order', async () => {
    await list(CTX, { sortBy: 'lastOrderAt' });
    expect(args().orderBy).toEqual({ lastOrderAt: { sort: 'desc', nulls: 'last' } });
  });

  it('carries nulls-last on every sort, so a field that becomes nullable is safe', async () => {
    for (const sortBy of ['score', 'totalSpent', 'updatedAt', 'createdAt'] as const) {
      findMany.mockClear();
      await list(CTX, { sortBy });
      expect(args().orderBy).toEqual({ [sortBy]: { sort: 'desc', nulls: 'last' } });
    }
  });

  it('defaults to recently changed, unchanged by this fix', async () => {
    await list(CTX, {});
    expect(args().orderBy).toEqual({ updatedAt: { sort: 'desc', nulls: 'last' } });
  });
});

describe('customerService.list lastOrderBefore', () => {
  it('asks the database for lapsed buyers instead of filtering a page', async () => {
    const cutoff = new Date('2026-06-01T00:00:00.000Z');
    await list(CTX, { sortBy: 'lastOrderAt', lastOrderBefore: cutoff, take: 50 });
    const where = args().where as Record<string, unknown>;
    // `lt` never matches a null, so never-ordered customers are excluded by the
    // comparison itself — no second filter, and no page spent on them.
    expect(where.lastOrderAt).toEqual({ lt: cutoff });
    expect(args().take).toBe(50);
  });

  it('leaves the column unconstrained when no cutoff is given', async () => {
    await list(CTX, { sortBy: 'lastOrderAt' });
    expect((args().where as Record<string, unknown>).lastOrderAt).toBeUndefined();
  });
});
