// The variant catalog's search, held as behavior rather than as a shape.
//
// The `where` is run against a handful of rows by a tiny evaluator that knows
// exactly the Prisma operators the builder uses (equality, `contains` with
// `mode: 'insensitive'`, `some`, `none`, `AND`, `OR`, and a nested relation).
// Asserting the object literal would pass a builder that searched the wrong
// column; running it says which rows a person at a counter would actually see.
//
// Sparx persona P01, issue 069: 693 versions, a 500-row window filtered in the
// browser, and every part after roughly the 500th alphabetically unfindable.

import { describe, expect, it } from 'vitest';
import { variantCatalogWhere, variantSearchClauses } from './variant-search.js';

type Row = Record<string, unknown>;

function matchesValue(value: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
    return value === condition;
  }
  const c = condition as Record<string, unknown>;
  if ('contains' in c) {
    if (typeof value !== 'string') return false;
    const term = String(c.contains);
    return c.mode === 'insensitive'
      ? value.toLowerCase().includes(term.toLowerCase())
      : value.includes(term);
  }
  if ('some' in c) {
    return Array.isArray(value) && value.some((item) => matchesWhere(item as Row, c.some as Row));
  }
  if ('none' in c) {
    return Array.isArray(value) && !value.some((item) => matchesWhere(item as Row, c.none as Row));
  }
  // A to-one relation: the nested object is a `where` over the related row.
  return value !== null && typeof value === 'object' && matchesWhere(value as Row, c);
}

function matchesWhere(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return (condition as Row[]).every((w) => matchesWhere(row, w));
    if (key === 'OR') return (condition as Row[]).some((w) => matchesWhere(row, w));
    return matchesValue(row[key], condition);
  });
}

const SITE = '11111111-1111-4111-8111-111111111111';
const OTHER_SITE = '22222222-2222-4222-8222-222222222222';

function variant(input: {
  id: string;
  productId: string;
  productTitle: string;
  sku: string;
  title?: string | null;
  options?: string[];
  sites?: string[];
  archived?: boolean;
}): Row {
  return {
    id: input.id,
    productId: input.productId,
    sku: input.sku,
    title: input.title ?? null,
    deletedAt: input.archived ? new Date('2026-09-01') : null,
    optionAssignments: (input.options ?? []).map((value) => ({ optionValue: { value } })),
    product: {
      title: input.productTitle,
      propertyLinks: (input.sites ?? []).map((propertyId) => ({ propertyId })),
    },
  };
}

const ROWS: Row[] = [
  variant({
    id: 'injector-s1',
    productId: 'injector',
    productTitle: 'Rebuilt fuel injector',
    sku: 'INJ-67-S1',
    options: ['6.7L', 'Stage 1'],
  }),
  variant({
    id: 'injector-s2',
    productId: 'injector',
    productTitle: 'Rebuilt fuel injector',
    sku: 'INJ-67-S2',
    options: ['6.7L', 'Stage 2'],
  }),
  variant({
    id: 'filter',
    productId: 'filter',
    productTitle: 'Oil filter',
    sku: 'FLT-0042',
    title: 'Heavy duty',
  }),
  variant({
    id: 'other-site-ring',
    productId: 'ring',
    productTitle: 'Signet ring',
    sku: 'RING-01',
    sites: [OTHER_SITE],
  }),
  variant({
    id: 'retired-injector',
    productId: 'injector',
    productTitle: 'Rebuilt fuel injector',
    sku: 'INJ-60-OLD',
    options: ['6.0L'],
    archived: true,
  }),
];

function found(filter: Parameters<typeof variantCatalogWhere>[0]): string[] {
  const where = variantCatalogWhere(filter) as Row;
  return ROWS.filter((row) => matchesWhere(row, where)).map((row) => String(row.id));
}

const ON_SITE = { includeArchived: false, propertyId: SITE } as const;

describe('variantCatalogWhere', () => {
  it('without a search, is the whole of what this site sells, archived left out', () => {
    expect(found({ ...ON_SITE })).toEqual(['injector-s1', 'injector-s2', 'filter']);
  });

  it('finds a version by its option value, which is how a person says which one', () => {
    expect(found({ ...ON_SITE, q: 'stage 2' })).toEqual(['injector-s2']);
  });

  it('lets each word land on a different place: product name in one, option in another', () => {
    expect(found({ ...ON_SITE, q: 'injector 6.7' })).toEqual(['injector-s1', 'injector-s2']);
    expect(found({ ...ON_SITE, q: '6.7 INJECTOR' })).toEqual(['injector-s1', 'injector-s2']);
  });

  it('finds by the code on the box, and by the version name, in any case', () => {
    expect(found({ ...ON_SITE, q: 'flt-0042' })).toEqual(['filter']);
    expect(found({ ...ON_SITE, q: 'heavy' })).toEqual(['filter']);
    expect(found({ ...ON_SITE, q: 'OIL' })).toEqual(['filter']);
  });

  it('needs every word to land somewhere, so typing more narrows', () => {
    expect(found({ ...ON_SITE, q: 'injector filter' })).toEqual([]);
  });

  it('keeps the site scope when searching: another business never reaches this counter', () => {
    expect(found({ ...ON_SITE, q: 'ring' })).toEqual([]);
    expect(found({ includeArchived: false, propertyId: OTHER_SITE, q: 'ring' })).toEqual([
      'other-site-ring',
    ]);
  });

  it('keeps archived versions out of a search unless asked for', () => {
    expect(found({ ...ON_SITE, q: '6.0' })).toEqual([]);
    expect(found({ includeArchived: true, propertyId: SITE, q: '6.0' })).toEqual([
      'retired-injector',
    ]);
  });

  it("narrows to one product's versions, search or not", () => {
    expect(found({ ...ON_SITE, productId: 'injector' })).toEqual(['injector-s1', 'injector-s2']);
    expect(found({ ...ON_SITE, productId: 'injector', q: 'stage 1' })).toEqual(['injector-s1']);
  });
});

describe('variantSearchClauses', () => {
  it('adds nothing for an empty or blank search', () => {
    expect(variantSearchClauses('')).toEqual([]);
    expect(variantSearchClauses('   ')).toEqual([]);
    expect(variantSearchClauses(undefined)).toEqual([]);
  });

  it('asks one group per word', () => {
    expect(variantSearchClauses('injector 6.7 stage')).toHaveLength(3);
  });
});
