import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxClient } from '@wizeworks/db';
import type { PropertyContext } from '@wizeworks/builder';

const moduleStates = new Map<string, boolean>();

vi.mock('@wizeworks/auth', () => ({
  isModuleEnabled: (_tenantId: string, key: string) =>
    Promise.resolve(moduleStates.get(key) ?? false),
}));

const { imageWeights, linkTargets, silicaPagesOf, skippedPagesOf, storageKeysOf } =
  await import('./site-check.js');

const CTX: PropertyContext = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  propertyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: undefined,
};

/** A `tx` that answers only the four reads this file makes, and records that it was
 *  asked — so "the module was off, so we never looked" is provable rather than
 *  inferred from an empty result. */
function stubTx(rows: {
  products?: { handle: string }[];
  collections?: { handle: string }[];
  categories?: { handle: string }[];
  entries?: { slug: string | null; typeKey: string }[];
  services?: { id: string }[];
}) {
  const calls: string[] = [];
  const tx = {
    product: {
      findMany: () => {
        calls.push('product');
        return Promise.resolve(rows.products ?? []);
      },
    },
    productCollection: {
      findMany: () => {
        calls.push('productCollection');
        return Promise.resolve(rows.collections ?? []);
      },
    },
    productCategory: {
      findMany: () => {
        calls.push('productCategory');
        return Promise.resolve(rows.categories ?? []);
      },
    },
    contentEntry: {
      findMany: (args: { where: { typeKey: string } }) => {
        calls.push(`contentEntry:${args.where.typeKey}`);
        return Promise.resolve(
          (rows.entries ?? []).filter((e) => e.typeKey === args.where.typeKey)
        );
      },
    },
    schedulingService: {
      findMany: () => {
        calls.push('schedulingService');
        return Promise.resolve(rows.services ?? []);
      },
    },
  } as unknown as TxClient;
  return { tx, calls };
}

beforeEach(() => {
  moduleStates.clear();
});

describe('linkTargets', () => {
  it('gathers every roster when the modules are on', async () => {
    moduleStates.set('commerce', true);
    moduleStates.set('cms', true);
    moduleStates.set('scheduling', true);
    const { tx } = stubTx({
      products: [{ handle: 'brake-kit' }],
      collections: [{ handle: 'winter' }],
      categories: [{ handle: 'filters' }],
      entries: [
        { slug: 'warranty', typeKey: 'page' },
        { slug: 'first-post', typeKey: 'blog_post' },
      ],
      services: [{ id: 'svc-1' }],
    });

    const targets = await linkTargets(tx, CTX);
    expect(targets.paths).toEqual(['warranty']);
    expect(targets.productHandles).toEqual(['brake-kit']);
    expect(targets.collectionHandles).toEqual(['winter']);
    expect(targets.categoryHandles).toEqual(['filters']);
    expect(targets.postSlugs).toEqual(['first-post']);
    expect(targets.serviceIds).toEqual(['svc-1']);
  });

  it('leaves a disabled module UNDEFINED rather than empty, and never queries it', async () => {
    // The distinction is the whole contract with the engine: `[]` means "there are
    // none, so that link is broken" and `undefined` means "we did not look". Emitting
    // `[]` for a module that is switched off would report every product link on the
    // site as broken to a tenant who has simply not turned Commerce on.
    moduleStates.set('cms', true);
    const { tx, calls } = stubTx({ entries: [{ slug: 'warranty', typeKey: 'page' }] });

    const targets = await linkTargets(tx, CTX);
    expect(targets.productHandles).toBeUndefined();
    expect(targets.collectionHandles).toBeUndefined();
    expect(targets.categoryHandles).toBeUndefined();
    expect(targets.serviceIds).toBeUndefined();
    expect(calls).not.toContain('product');
    expect(calls).not.toContain('schedulingService');
  });

  it('still states the path roster when the CMS is off — an empty list is the truth', async () => {
    // With no CMS there are no page entries, so the builder's own pages ARE the whole
    // roster. Saying so (rather than omitting it) is what turns bare-path checking on.
    const { tx, calls } = stubTx({});
    const targets = await linkTargets(tx, CTX);
    expect(targets.paths).toEqual([]);
    expect(calls).not.toContain('contentEntry:page');
  });

  it('drops an entry with no slug rather than emitting an empty path', async () => {
    moduleStates.set('cms', true);
    const { tx } = stubTx({
      entries: [
        { slug: null, typeKey: 'page' },
        { slug: 'ok', typeKey: 'page' },
      ],
    });
    const targets = await linkTargets(tx, CTX);
    expect(targets.paths).toEqual(['ok']);
  });
});

describe('silicaPagesOf', () => {
  const base = {
    name: 'Home',
    slug: '/',
    kind: 'singleton',
    recordType: null,
    seoTitle: null,
    seoDescription: null,
    canonical: null,
    ogImage: null,
    noindex: false,
  };

  it('skips a page with no silica tree — a leftover from the retired builder', () => {
    const pages = silicaPagesOf([
      { ...base, id: 'p1', silicaDraftTree: { kind: 'element', tag: 'main' } },
      { ...base, id: 'p2', name: 'Legacy', silicaDraftTree: null },
    ]);
    expect(pages.map((p) => p.id)).toEqual(['p1']);
  });

  it('carries the page metadata the engine grades on', () => {
    const [page] = silicaPagesOf([
      {
        ...base,
        id: 'p1',
        kind: 'collection',
        recordType: 'commerce.product',
        seoTitle: 'T',
        seoDescription: 'D',
        noindex: true,
        silicaDraftTree: { kind: 'element', tag: 'main' },
      },
    ]);
    expect(page?.kind).toBe('collection');
    expect(page?.recordType).toBe('commerce.product');
    expect(page?.noindex).toBe(true);
    expect(page?.seoTitle).toBe('T');
  });

  it('normalizes a null slug to the root', () => {
    const [page] = silicaPagesOf([
      { ...base, id: 'p1', slug: null, silicaDraftTree: { kind: 'element', tag: 'main' } },
    ]);
    expect(page?.slug).toBe('/');
  });
});

describe('storageKeysOf', () => {
  // Every URL shape the platform emits, and the key each one has to resolve back to.
  // These four builders live in different packages and evolve independently, so this
  // is the test that fails loudly instead of every picture quietly reporting
  // "unknown size".
  const KEY = 'ten-1/variants/asset-9/w800.webp';

  it('recovers the key from the public variant route', () => {
    expect(storageKeysOf(`https://api.sparx.works/v1/public/media/variants/${KEY}`)).toContain(KEY);
  });

  it('recovers the key from the local-mode file route, host or not', () => {
    expect(storageKeysOf(`/v1/public/media/file/${KEY}`)).toContain(KEY);
    expect(storageKeysOf(`http://localhost:4000/v1/public/media/file/${KEY}`)).toContain(KEY);
  });

  it('recovers the key from the CDN base', () => {
    expect(storageKeysOf(`https://cdn.sparx.works/${KEY}`)).toContain(KEY);
  });

  it('recovers the key from the raw bucket URL, past the bucket segment', () => {
    expect(storageKeysOf(`https://storage.googleapis.com/sparx-media-public/${KEY}`)).toContain(
      KEY
    );
  });

  it('offers the URL itself, because a hot-linked asset stores one AS its key', () => {
    const url = 'https://images.example.com/hero.jpg';
    expect(storageKeysOf(url)).toContain(url);
  });

  it('recovers a key whose characters were encoded into the URL', () => {
    expect(storageKeysOf('/v1/public/media/file/ten-1/my%20photo.jpg')).toContain(
      'ten-1/my photo.jpg'
    );
  });

  it('never offers an empty key — it would match the wrong row', () => {
    expect(storageKeysOf('/')).not.toContain('');
  });
});

describe('pages the check could not open', () => {
  const rows = [
    { id: 'a', name: 'Home', silicaDraftTree: { kind: 'element', tag: 'div' } },
    { id: 'b', name: 'Thank you', silicaDraftTree: null },
    { id: 'c', name: 'Careers', silicaDraftTree: null },
  ];

  it('names them instead of dropping them', () => {
    // `silicaPagesOf` skips a page with no draft tree, because there is nothing to
    // walk. Skipping it SILENTLY is the defect: `pagesChecked` then counts only the
    // survivors, so an eleven-page site reported "Nothing to fix across 7 pages. It
    // reads well." and the owner had no way to learn four were never opened.
    expect(skippedPagesOf(rows)).toEqual([
      { id: 'b', name: 'Thank you' },
      { id: 'c', name: 'Careers' },
    ]);
  });

  it('is empty when every page could be walked', () => {
    expect(skippedPagesOf([rows[0]!])).toEqual([]);
  });

  it('agrees with what silicaPagesOf kept — every page is in exactly one', () => {
    const kept = silicaPagesOf(
      rows.map((r) => ({
        ...r,
        slug: null,
        kind: 'singleton',
        recordType: null,
        seoTitle: null,
        seoDescription: null,
        canonical: null,
        ogImage: null,
        noindex: false,
      }))
    );
    expect(kept.length + skippedPagesOf(rows).length).toBe(rows.length);
  });
});

// A picture nobody weighed must not be reported as weighing nothing.
//
// The weight budget exists to tell an owner her page is too heavy, and it reads
// `byteSize` off the media library. A REMOTE picture -- a media asset whose key is
// somebody else's URL -- is registered without ever being downloaded, so that
// column is 0. Not "small": unmeasured. 2,901 of the 3,109 assets in the dev
// database are in that state, so a site built out of hot-linked 1600px photographs
// was measuring as pure markup and passing the budget outright.
describe('imageWeights', () => {
  function weighTx(assets: { key: string; byteSize: number }[], variants: typeof assets = []) {
    return {
      mediaVariant: { findMany: vi.fn().mockResolvedValue(variants) },
      mediaAsset: { findMany: vi.fn().mockResolvedValue(assets) },
    } as unknown as TxClient;
  }

  it('reports a real file by its real size', async () => {
    const tx = weighTx([{ key: 'tenant/originals/x/ash-overshirt-bone.jpg', byteSize: 26395 }]);
    const weights = await imageWeights(tx, ['/media/tenant/originals/x/ash-overshirt-bone.jpg']);
    expect(Object.values(weights)[0]).toBe(26395);
  });

  it('leaves a picture stored as zero bytes OUT, so it counts as unsized', async () => {
    // The engine adds every weight it is handed and reports only what it was NOT
    // handed as unsized -- so entering a 0 here is a confident claim of free.
    const src = 'https://images.unsplash.com/photo-1778918006381?w=1600';
    const tx = weighTx([{ key: src, byteSize: 0 }]);
    expect(await imageWeights(tx, [src])).toEqual({});
  });

  it('does not let a zero-byte VARIANT overwrite a real original', async () => {
    // Variants win over originals on purpose -- a variant is what the page
    // downloads -- but winning with an unmeasured 0 would lose the one real number.
    const key = 'tenant/originals/x/hero.jpg';
    const tx = weighTx([{ key, byteSize: 900_000 }], [{ key, byteSize: 0 }]);
    expect(await imageWeights(tx, [`/media/${key}`])).toEqual({ [`/media/${key}`]: 900_000 });
  });

  it('still leaves a source that matches nothing out', async () => {
    expect(await imageWeights(weighTx([]), ['/media/tenant/originals/x/gone.jpg'])).toEqual({});
  });
});
