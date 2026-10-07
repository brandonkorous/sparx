// Where a picture is used, counted from the rows that hold the references.
//
// The defect these pin (issue 381): `media_assets.usage_count` is a column
// NOTHING has ever written. It reported "not used anywhere" about 2,406 pictures
// that were on live product pages, and it was the input to both delete guards —
// so the console would let an owner delete a photograph off a live product page
// and say nothing. The old tests passed throughout because they mocked the
// count, which proves the guard works when the number is right and never that it
// is; these count instead.

import { describe, expect, it } from 'vitest';

import { countAssetUsage, countOneAssetUsage, describeUsage } from '../src/asset-usage.js';
import type { TxClient } from '@wizeworks/db';

/** A tx whose seven grouped counts return exactly what each test sets up. */
function txWith(
  rows: Partial<{
    content: { toAssetId: string; n: number }[];
    products: { mediaAssetId: string; n: number }[];
    avatars: { avatarMediaAssetId: string; n: number }[];
    customerDocs: { mediaAssetId: string; n: number }[];
    authors: { avatarAssetId: string; n: number }[];
    staffDocuments: { assetId: string; n: number }[];
    expenses: { assetId: string; n: number }[];
    /** What the one raw query over pages, layouts and id columns answers. */
    other: { kind: string; id: string; n: number }[];
  }> = {}
): TxClient {
  const shape = <T extends Record<string, unknown>>(list: (T & { n: number })[] | undefined) =>
    (list ?? []).map(({ n, ...rest }) => ({ ...rest, _count: { _all: n } }));
  const group = (list: unknown[]) => ({ groupBy: () => Promise.resolve(list) });
  return {
    contentReference: group(shape(rows.content)),
    variantImage: group(shape(rows.products)),
    customer: group(shape(rows.avatars)),
    customerDocument: group(shape(rows.customerDocs)),
    author: group(shape(rows.authors)),
    staffDocument: group(shape(rows.staffDocuments)),
    financeExpenseAttachment: group(shape(rows.expenses)),
    mediaAsset: {
      findMany: ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.map((id) => ({ id, key: `k/${id}`, tenantId: 't' }))),
    },
    $queryRaw: () => Promise.resolve(rows.other ?? []),
  } as unknown as TxClient;
}

const A = 'asset-a';
const B = 'asset-b';

describe('countAssetUsage', () => {
  it('asks nothing when asked about nothing', async () => {
    const usage = await countAssetUsage(txWith(), []);
    expect(usage.size).toBe(0);
  });

  it('counts a product photograph — the case that was reported as unused', async () => {
    const usage = await countAssetUsage(txWith({ products: [{ mediaAssetId: A, n: 1 }] }), [A]);
    expect(usage.get(A)?.products).toBe(1);
    expect(usage.get(A)?.total).toBe(1);
  });

  it('returns zeroes rather than nothing for an unused asset', async () => {
    // "not used" and "not asked about" must never look the same to a caller.
    const usage = await countAssetUsage(txWith(), [A]);
    expect(usage.has(A)).toBe(true);
    expect(usage.get(A)?.total).toBe(0);
  });

  it('adds up every source into one total', async () => {
    const usage = await countAssetUsage(
      txWith({
        products: [{ mediaAssetId: A, n: 3 }],
        content: [{ toAssetId: A, n: 2 }],
        authors: [{ avatarAssetId: A, n: 1 }],
        staffDocuments: [{ assetId: A, n: 1 }],
        expenses: [{ assetId: A, n: 1 }],
      }),
      [A]
    );
    expect(usage.get(A)).toMatchObject({ products: 3, content: 2, authors: 1, total: 8 });
  });

  it('folds a customer avatar and a customer document into one kind', async () => {
    const usage = await countAssetUsage(
      txWith({
        avatars: [{ avatarMediaAssetId: A, n: 1 }],
        customerDocs: [{ mediaAssetId: A, n: 2 }],
      }),
      [A]
    );
    expect(usage.get(A)?.customers).toBe(3);
    expect(usage.get(A)?.total).toBe(3);
  });

  it('keeps two assets apart', async () => {
    const usage = await countAssetUsage(
      txWith({
        products: [
          { mediaAssetId: A, n: 2 },
          { mediaAssetId: B, n: 5 },
        ],
      }),
      [A, B]
    );
    expect(usage.get(A)?.total).toBe(2);
    expect(usage.get(B)?.total).toBe(5);
  });

  it('ignores a count for an asset nobody asked about', async () => {
    const usage = await countAssetUsage(txWith({ products: [{ mediaAssetId: B, n: 9 }] }), [A]);
    expect(usage.get(A)?.total).toBe(0);
    expect(usage.has(B)).toBe(false);
  });

  it('asks about each id once even when given duplicates', async () => {
    const usage = await countAssetUsage(txWith({ products: [{ mediaAssetId: A, n: 1 }] }), [
      A,
      A,
      A,
    ]);
    expect(usage.size).toBe(1);
    expect(usage.get(A)?.total).toBe(1);
  });
});

describe('countOneAssetUsage', () => {
  it('answers for a single asset', async () => {
    const usage = await countOneAssetUsage(txWith({ content: [{ toAssetId: A, n: 4 }] }), A);
    expect(usage.content).toBe(4);
    expect(usage.total).toBe(4);
  });

  it('answers zero rather than undefined for an unused one', async () => {
    const usage = await countOneAssetUsage(txWith(), A);
    expect(usage.total).toBe(0);
  });
});

describe('describeUsage', () => {
  const usage = (over: Partial<Record<string, number>> = {}) => ({
    content: 0,
    products: 0,
    customers: 0,
    authors: 0,
    staffDocuments: 0,
    expenses: 0,
    sitePages: 0,
    siteLayouts: 0,
    branding: 0,
    catalog: 0,
    reviews: 0,
    socialPosts: 0,
    otherRecords: 0,
    total: 0,
    ...over,
  });

  it('names the kind, not just a number', () => {
    // "still referenced by 4 entries" tells an owner nothing about where to go.
    expect(describeUsage(usage({ products: 1 }))).toBe('1 product photo');
  });

  it('pluralizes each kind on its own', () => {
    expect(describeUsage(usage({ products: 3 }))).toBe('3 product photos');
    expect(describeUsage(usage({ content: 1 }))).toBe('1 page or article');
    expect(describeUsage(usage({ content: 2 }))).toBe('2 pages and articles');
  });

  it('joins two kinds with "and"', () => {
    expect(describeUsage(usage({ products: 2, content: 1 }))).toBe(
      '2 product photos and 1 page or article'
    );
  });

  it('joins three kinds with commas and a final "and"', () => {
    expect(describeUsage(usage({ products: 1, content: 1, authors: 1 }))).toBe(
      '1 product photo, 1 page or article and 1 author profile'
    );
  });

  it('says "nothing" rather than an empty string', () => {
    expect(describeUsage(usage())).toBe('nothing');
  });

  it('leaves out a kind that is zero', () => {
    expect(describeUsage(usage({ products: 1 }))).not.toContain('author');
  });
});

describe('the places a design or a brand holds a picture (issue 932)', () => {
  // A site page keeps a linked picture's ADDRESS in its design, not its id, so
  // counting by id found 1 of Juniper Row's 87 on her pages where there were 20.
  // A picture that only a page, the logo or a collection used read as unused,
  // and a deleted one is purged for good 30 days later.
  it('counts a picture on a site page', async () => {
    const usage = await countAssetUsage(txWith({ other: [{ kind: 'sitePages', id: A, n: 2 }] }), [
      A,
    ]);
    expect(usage.get(A)).toMatchObject({ sitePages: 2, total: 2 });
  });

  it('counts the logo, a collection picture and a social post', async () => {
    const usage = await countAssetUsage(
      txWith({
        other: [
          { kind: 'branding', id: A, n: 1 },
          { kind: 'catalog', id: A, n: 1 },
          { kind: 'socialPosts', id: B, n: 3 },
        ],
      }),
      [A, B]
    );
    expect(usage.get(A)).toMatchObject({ branding: 1, catalog: 1, total: 2 });
    expect(usage.get(B)).toMatchObject({ socialPosts: 3, total: 3 });
  });

  it('names them for a person', async () => {
    const counted = async (other: { kind: string; id: string; n: number }[]) =>
      (await countAssetUsage(txWith({ other }), [A])).get(A)!;
    expect(
      describeUsage(
        await counted([
          { kind: 'sitePages', id: A, n: 2 },
          { kind: 'branding', id: A, n: 1 },
        ])
      )
    ).toBe('2 site pages and 1 logo or site icon');
    expect(describeUsage(await counted([{ kind: 'siteLayouts', id: A, n: 1 }]))).toBe(
      '1 site header or footer'
    );
  });
});
