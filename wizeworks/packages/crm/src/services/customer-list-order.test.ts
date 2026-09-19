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

// The real `nameSearchClauses`, not a stub: it is a pure function over a
// string, and the where clause it builds is half of what these assert.
vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
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

  // NOT on the required ones, and this assertion used to say the opposite.
  //
  // Prisma rejects the `{ sort, nulls }` object on a non-nullable column, so the
  // blanket version threw on every sort including the default — and this test
  // passed the whole time, because it asserts the query SHAPE against a mocked
  // client that validates nothing. The real client is what says no (issue 331).
  it('sorts the required fields plainly, because Prisma refuses nulls on them', async () => {
    for (const sortBy of [
      'score',
      'totalSpent',
      'totalOrdered',
      'updatedAt',
      'createdAt',
    ] as const) {
      findMany.mockClear();
      await list(CTX, { sortBy });
      expect(args().orderBy).toEqual({ [sortBy]: 'desc' });
    }
  });

  it('defaults to recently changed', async () => {
    await list(CTX, {});
    expect(args().orderBy).toEqual({ updatedAt: 'desc' });
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

// ─────────────────────────────────────────────────────────────────────────
// The SEARCH, and the filter it used to be able to eat
// ─────────────────────────────────────────────────────────────────────────

describe('customerService.list searching', () => {
  it('requires every typed word to land somewhere', async () => {
    // A name is two columns and one string, so asking whether "Jo Kim" is
    // inside either column found nobody. 635 of the platform's 651 customers
    // have both a first and a last name (issue 546).
    await list(CTX, { q: 'Jo Kim' });
    const and = (args().where as { AND: { OR: unknown[] }[] }).AND;
    expect(and).toHaveLength(2);
    expect(and[0]?.OR).toContainEqual({ firstName: { contains: 'Jo', mode: 'insensitive' } });
    expect(and[1]?.OR).toContainEqual({ lastName: { contains: 'Kim', mode: 'insensitive' } });
  });

  it('keeps the SITE filter when a search is also running', async () => {
    // Both wanted the `AND` key, and the second one written wins. The loser
    // here decides which rows a site is allowed to see at all, so a search box
    // would have quietly shown another site's customers.
    await list(CTX, { q: 'Jo Kim', propertyId: 'a3fd094d-c8fe-48fd-b8e7-d1e0dbb42586' });
    const and = (args().where as { AND: { OR: unknown[] }[] }).AND;
    expect(and).toHaveLength(3);
    expect(and[0]?.OR).toEqual([
      { propertyId: null },
      { propertyId: 'a3fd094d-c8fe-48fd-b8e7-d1e0dbb42586' },
    ]);
  });

  it('adds nothing at all when nothing was typed', async () => {
    await list(CTX, {});
    expect((args().where as { AND: unknown[] }).AND).toEqual([]);
  });
});
