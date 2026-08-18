import type { CollectionRuleSet } from '@wizeworks/commerce-schemas';
import { describe, expect, it, vi } from 'vitest';

import { compileRuleSet } from './collection-rules';
import type { FitmentNodeResolver, RuleLogger } from './collection-rules';

// compileRuleSet turns a CANONICAL { match, predicates } rule set into a Prisma
// Product where-clause. This is the seam that silently broke: the old compiler
// read `ruleSet.conditions`/`ruleSet.operator`, so every real stored rule (which
// uses `predicates`/`match`) fell through to the empty branch and every smart
// collection projected to ZERO members. The regression test that would have
// caught it — a real stored { match, predicates } blob compiling to something
// OTHER than "match nothing" — is the last `describe` block below.
//
// The projection DB round-trip (RLS, manual-row preservation, the cap) is
// covered by the commerce-indexer integration path; this suite unit-tests the
// pure compiler by asserting the exact clause each predicate produces.

const MATCH_NOTHING = { id: { in: [] } };

function spyLogger() {
  return { warn: vi.fn<(meta: object, msg?: string) => void>() } satisfies RuleLogger;
}

/** Cast helper for authoring rule sets (and deliberately-drifted ones) inline. */
function ruleSet(rs: unknown): CollectionRuleSet {
  return rs as CollectionRuleSet;
}

describe('compileRuleSet — match mode', () => {
  it('match "all" wraps predicates in AND', async () => {
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [
          { field: 'vendor', op: 'equals', value: 'Bosch' },
          { field: 'product_type', op: 'equals', value: 'Filter' },
        ],
      })
    );
    expect(where).toEqual({ AND: [{ vendor: 'Bosch' }, { productType: 'Filter' }] });
  });

  it('match "any" wraps predicates in OR', async () => {
    const where = await compileRuleSet(
      ruleSet({
        match: 'any',
        predicates: [
          { field: 'vendor', op: 'equals', value: 'Bosch' },
          { field: 'product_type', op: 'equals', value: 'Filter' },
        ],
      })
    );
    expect(where).toEqual({ OR: [{ vendor: 'Bosch' }, { productType: 'Filter' }] });
  });

  it('empty predicates compile to match-nothing', async () => {
    const where = await compileRuleSet(ruleSet({ match: 'all', predicates: [] }));
    expect(where).toEqual(MATCH_NOTHING);
  });
});

describe('compileRuleSet — title', () => {
  const one = (op: string) =>
    compileRuleSet(ruleSet({ match: 'all', predicates: [{ field: 'title', op, value: 'Brake' }] }));

  it('contains → case-insensitive contains', async () => {
    expect(await one('contains')).toEqual({
      AND: [{ title: { contains: 'Brake', mode: 'insensitive' } }],
    });
  });
  it('equals → case-insensitive equals', async () => {
    expect(await one('equals')).toEqual({
      AND: [{ title: { equals: 'Brake', mode: 'insensitive' } }],
    });
  });
  it('starts_with → case-insensitive startsWith', async () => {
    expect(await one('starts_with')).toEqual({
      AND: [{ title: { startsWith: 'Brake', mode: 'insensitive' } }],
    });
  });
  it('ends_with → case-insensitive endsWith', async () => {
    expect(await one('ends_with')).toEqual({
      AND: [{ title: { endsWith: 'Brake', mode: 'insensitive' } }],
    });
  });
});

describe('compileRuleSet — vendor / product_type', () => {
  it('vendor equals → scalar equality', async () => {
    const where = await compileRuleSet(
      ruleSet({ match: 'all', predicates: [{ field: 'vendor', op: 'equals', value: 'Bosch' }] })
    );
    expect(where).toEqual({ AND: [{ vendor: 'Bosch' }] });
  });

  it('vendor in → { in: [...] }', async () => {
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'vendor', op: 'in', value: ['Bosch', 'Denso'] }],
      })
    );
    expect(where).toEqual({ AND: [{ vendor: { in: ['Bosch', 'Denso'] } }] });
  });

  it('product_type maps to the productType column', async () => {
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'product_type', op: 'in', value: ['Filter', 'Pump'] }],
      })
    );
    expect(where).toEqual({ AND: [{ productType: { in: ['Filter', 'Pump'] } }] });
  });
});

describe('compileRuleSet — tag', () => {
  it('equals → tags has (single membership)', async () => {
    const where = await compileRuleSet(
      ruleSet({ match: 'all', predicates: [{ field: 'tag', op: 'equals', value: 'sale' }] })
    );
    expect(where).toEqual({ AND: [{ tags: { has: 'sale' } }] });
  });

  it('any_of → tags hasSome', async () => {
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'tag', op: 'any_of', value: ['new', 'featured'] }],
      })
    );
    expect(where).toEqual({ AND: [{ tags: { hasSome: ['new', 'featured'] } }] });
  });

  it('all_of → tags hasEvery', async () => {
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'tag', op: 'all_of', value: ['waterproof', 'led'] }],
      })
    );
    expect(where).toEqual({ AND: [{ tags: { hasEvery: ['waterproof', 'led'] } }] });
  });

  it('none_of → NOT tags hasSome', async () => {
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'tag', op: 'none_of', value: ['clearance', 'discontinued'] }],
      })
    );
    expect(where).toEqual({ AND: [{ NOT: { tags: { hasSome: ['clearance', 'discontinued'] } } }] });
  });
});

describe('compileRuleSet — price (min/max envelope)', () => {
  const price = (op: string, value: unknown) =>
    compileRuleSet(ruleSet({ match: 'all', predicates: [{ field: 'price', op, value }] }));

  it('lt/lte bound the cheapest variant (priceMinCents)', async () => {
    expect(await price('lt', 5000)).toEqual({ AND: [{ priceMinCents: { lt: 5000 } }] });
    expect(await price('lte', 2500)).toEqual({ AND: [{ priceMinCents: { lte: 2500 } }] });
  });

  it('gt/gte bound the dearest variant (priceMaxCents)', async () => {
    expect(await price('gt', 10000)).toEqual({ AND: [{ priceMaxCents: { gt: 10000 } }] });
    expect(await price('gte', 20000)).toEqual({ AND: [{ priceMaxCents: { gte: 20000 } }] });
  });

  it('between → price range overlaps [lo,hi]', async () => {
    expect(await price('between', [1000, 5000])).toEqual({
      AND: [{ priceMinCents: { lte: 5000 }, priceMaxCents: { gte: 1000 } }],
    });
  });

  it('between with a non-tuple value is skipped with a warning', async () => {
    const logger = spyLogger();
    const where = await compileRuleSet(
      ruleSet({ match: 'all', predicates: [{ field: 'price', op: 'between', value: 1000 }] }),
      { logger }
    );
    expect(where).toEqual(MATCH_NOTHING);
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});

describe('compileRuleSet — inventory', () => {
  it('in_stock / out_of_stock → the denormalized inStock column', async () => {
    const inStock = await compileRuleSet(
      ruleSet({ match: 'all', predicates: [{ field: 'inventory', op: 'in_stock', value: true }] })
    );
    expect(inStock).toEqual({ AND: [{ inStock: true }] });

    const outOfStock = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'inventory', op: 'out_of_stock', value: true }],
      })
    );
    expect(outOfStock).toEqual({ AND: [{ inStock: false }] });
  });

  it('low_stock → the denormalized lowStock column', async () => {
    const logger = spyLogger();
    const where = await compileRuleSet(
      ruleSet({ match: 'all', predicates: [{ field: 'inventory', op: 'low_stock', value: true }] }),
      { logger }
    );
    expect(where).toEqual({ AND: [{ lowStock: true }] });
    // It is a real column filter now, not a logged gap.
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('compileRuleSet — fitment', () => {
  it('resolves ancestor-or-self ids + a range window (mirrors fitment lookup)', async () => {
    const resolve: FitmentNodeResolver = vi.fn((id: string) =>
      Promise.resolve(['ford', 'f250', id])
    );
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [
          {
            field: 'fitment',
            op: 'matches',
            value: { domainId: 'vehicle', variantId: '67L', rangeValue: 2018 },
          },
        ],
      }),
      { resolveFitmentNode: resolve }
    );
    expect(resolve).toHaveBeenCalledWith('67L');
    expect(where).toEqual({
      AND: [
        {
          fitments: {
            some: {
              domainId: 'vehicle',
              AND: [
                { OR: [{ nodeId: { in: ['ford', 'f250', '67L'] } }, { nodeId: null }] },
                {
                  OR: [
                    { ranges: { none: {} } },
                    {
                      ranges: {
                        some: {
                          AND: [
                            { OR: [{ min: { lte: 2018 } }, { min: null }] },
                            { OR: [{ max: { gte: 2018 } }, { max: null }] },
                          ],
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    });
  });

  it('domain-only fitment needs no resolver', async () => {
    const resolve = vi.fn();
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'fitment', op: 'matches', value: { domainId: 'vehicle' } }],
      }),
      { resolveFitmentNode: resolve as unknown as FitmentNodeResolver }
    );
    expect(where).toEqual({ AND: [{ fitments: { some: { domainId: 'vehicle' } } }] });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('a node-targeting fitment with no resolver is a logged no-match', async () => {
    const logger = spyLogger();
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'fitment', op: 'matches', value: { itemId: 'f250' } }],
      }),
      { logger }
    );
    expect(where).toEqual({ AND: [MATCH_NOTHING] });
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('an empty fitment value is a logged no-match', async () => {
    const logger = spyLogger();
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'fitment', op: 'matches', value: {} }],
      }),
      { logger }
    );
    expect(where).toEqual({ AND: [MATCH_NOTHING] });
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});

describe('compileRuleSet — drift resilience', () => {
  it('an unknown field is skipped with a warning (never a silent match-all)', async () => {
    const logger = spyLogger();
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'made_up_field', op: 'equals', value: 'x' }],
      }),
      { logger }
    );
    // Every predicate skipped ⇒ match nothing, NOT match everything.
    expect(where).toEqual(MATCH_NOTHING);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('an unknown op on a known field is skipped with a warning', async () => {
    const logger = spyLogger();
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [{ field: 'vendor', op: 'regex', value: 'Bo.*' }],
      }),
      { logger }
    );
    expect(where).toEqual(MATCH_NOTHING);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('drops only the unknown predicate, keeping the valid ones', async () => {
    const logger = spyLogger();
    const where = await compileRuleSet(
      ruleSet({
        match: 'all',
        predicates: [
          { field: 'vendor', op: 'equals', value: 'Bosch' },
          { field: 'made_up_field', op: 'equals', value: 'x' },
        ],
      }),
      { logger }
    );
    expect(where).toEqual({ AND: [{ vendor: 'Bosch' }] });
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});

// The regression guard: the THREE real shapes confirmed in the production DB
// (and shipped by the collection presets) MUST compile to a real, non-empty
// clause. Under the old compiler each of these hit the empty branch and
// projected zero members — this is the test that fails on that bug.
describe('compileRuleSet — real stored production shapes (regression)', () => {
  const REAL_SHAPES: { name: string; stored: unknown; expected: unknown }[] = [
    {
      name: 'New arrivals — tag/any_of, match any',
      stored: {
        match: 'any',
        predicates: [{ op: 'any_of', field: 'tag', value: ['new', 'just-in', 'featured'] }],
      },
      expected: { OR: [{ tags: { hasSome: ['new', 'just-in', 'featured'] } }] },
    },
    {
      name: 'Under $25 — price/lte, match all',
      stored: { match: 'all', predicates: [{ field: 'price', op: 'lte', value: 2500 }] },
      expected: { AND: [{ priceMinCents: { lte: 2500 } }] },
    },
    {
      name: 'Featured tags — tag/any_of, match any',
      stored: {
        match: 'any',
        predicates: [{ op: 'any_of', field: 'tag', value: ['featured', 'staff-pick'] }],
      },
      expected: { OR: [{ tags: { hasSome: ['featured', 'staff-pick'] } }] },
    },
  ];

  for (const shape of REAL_SHAPES) {
    it(`${shape.name} compiles to a non-empty clause`, async () => {
      const where = await compileRuleSet(ruleSet(shape.stored));
      expect(where).toEqual(shape.expected);
      // Explicitly assert it is NOT the "match nothing" clause the bug produced.
      expect(where).not.toEqual(MATCH_NOTHING);
      expect(where).not.toEqual({ AND: [MATCH_NOTHING] });
      expect(where).not.toEqual({ OR: [MATCH_NOTHING] });
    });
  }
});
