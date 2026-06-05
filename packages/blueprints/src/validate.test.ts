import { describe, expect, it } from 'vitest';

import { retailStoreBlog } from './blueprints/retail-store-blog';
import { listBlueprints, listBlueprintSummaries } from './registry';
import { assetRef } from './refs';
import { parseBlueprint, safeParseBlueprint, validateBlueprintIntegrity } from './validate';

// A minimal blueprint that passes both Zod + integrity — the base every negative
// case below mutates. Built fresh per test via structuredClone.
function baseManifest(): Record<string, unknown> {
  return {
    key: 'mini',
    version: '1.0.0',
    name: 'Mini',
    summary: 'A minimal valid blueprint.',
    vertical: 'retail',
    requiresModules: ['builder', 'commerce', 'cms'],
    brand: {
      businessName: 'Mini Co.',
      colors: { primary: '#3F6212' },
      fonts: { heading: 'Inter', body: 'Inter' },
      logoLightAssetId: 'logo',
    },
    theme: { name: 'Mini theme', basePresetKey: 'market' },
    assets: [{ id: 'logo', url: 'https://cdn.example.com/logo.png' }],
    content: [
      {
        typeKey: 'blog_post',
        slug: 'hello',
        body: { title: 'Hello', excerpt: 'Hi', body: { type: 'doc' } },
      },
    ],
    commerce: {
      categories: [{ handle: 'things', name: 'Things' }],
      products: [
        {
          handle: 'widget',
          title: 'Widget',
          categoryHandles: ['things'],
          variants: [{ sku: 'WID-1', priceCents: 1000, isDefault: true }],
          images: [{ assetId: 'logo', isPrimary: true }],
        },
      ],
    },
    pages: [
      {
        name: 'Product',
        kind: 'collection',
        recordType: 'commerce.product',
        isDefault: true,
        tree: section(),
      },
    ],
  };
}

function section(): Record<string, unknown> {
  return {
    id: 'root',
    type: 'Section',
    box: {
      height: 'auto',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      surface: 'none',
      padding: 'lg',
      align: 'start',
      hiddenOn: [],
    },
    props: {},
  };
}

describe('parseBlueprint', () => {
  it('accepts a minimal valid blueprint and applies defaults', () => {
    const bp = parseBlueprint(baseManifest());
    expect(bp.key).toBe('mini');
    // defaults applied
    expect(bp.theme.apply).toBe(true);
    expect(bp.emails).toEqual([]);
    expect(bp.commerce?.products[0]?.status).toBe('draft');
    expect(bp.content[0]?.status).toBe('draft');
  });

  it('throws on a Zod-invalid manifest (bad semver)', () => {
    const m = baseManifest();
    m.version = 'v1';
    expect(() => parseBlueprint(m)).toThrow();
  });
});

describe('the shipped retail-store-blog flagship', () => {
  it('parses + passes integrity at module load', () => {
    expect(retailStoreBlog.key).toBe('retail-store-blog');
    expect(validateBlueprintIntegrity(retailStoreBlog)).toEqual([]);
  });

  it('ships its own named theme over a base preset', () => {
    expect(retailStoreBlog.theme.name).toBe('Driftwood');
    expect(retailStoreBlog.theme.basePresetKey).toBe('market');
    expect(retailStoreBlog.theme.apply).toBe(true);
  });

  it('exercises every module', () => {
    expect(retailStoreBlog.commerce?.products.length).toBeGreaterThan(0);
    expect(retailStoreBlog.content.length).toBeGreaterThan(0);
    expect(retailStoreBlog.emails.length).toBeGreaterThan(0);
    expect(retailStoreBlog.pages.length).toBeGreaterThan(0);
    expect(retailStoreBlog.components.length).toBeGreaterThan(0);
    expect(retailStoreBlog.layout).toBeDefined();
  });

  it('is registered and summarizable', () => {
    expect(listBlueprints().map((b) => b.key)).toContain('retail-store-blog');
    const summary = listBlueprintSummaries().find((s) => s.key === 'retail-store-blog');
    expect(summary?.requiresModules).toContain('commerce');
  });
});

describe('integrity checks', () => {
  it('flags an unknown asset reference', () => {
    const m = baseManifest();
    (m.brand as Record<string, unknown>).logoLightAssetId = 'missing';
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues.some((i) => /unknown asset/i.test(i.message))).toBe(true);
  });

  it('flags an unknown parent category', () => {
    const m = baseManifest();
    (m.commerce as { categories: Record<string, unknown>[] }).categories[0]!.parentHandle = 'ghost';
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
  });

  it('flags a product pointing at an unknown category', () => {
    const m = baseManifest();
    (m.commerce as { products: { categoryHandles: string[] }[] }).products[0]!.categoryHandles = [
      'nope',
    ];
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
  });

  it('flags a variant referencing an undeclared option value', () => {
    const m = baseManifest();
    const product = (m.commerce as { products: Record<string, unknown>[] }).products[0]!;
    product.options = [{ name: 'Color', values: [{ value: 'Red' }] }];
    product.variants = [
      { sku: 'WID-1', priceCents: 1000, isDefault: true, optionValues: { Color: 'Blue' } },
    ];
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues.some((i) => i.message.includes('no value "Blue"'))).toBe(true);
  });

  it('flags two default variants', () => {
    const m = baseManifest();
    const product = (m.commerce as { products: Record<string, unknown>[] }).products[0]!;
    product.variants = [
      { sku: 'A', priceCents: 1000, isDefault: true },
      { sku: 'B', priceCents: 1000, isDefault: true },
    ];
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues.some((i) => i.message.includes('isDefault'))).toBe(true);
  });

  it('flags content referencing an unknown content type', () => {
    const m = baseManifest();
    (m.content as Record<string, unknown>[])[0]!.typeKey = 'made_up_type';
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
  });

  it('flags an unknown asset referenced inside a content body', () => {
    const m = baseManifest();
    (m.content as Record<string, unknown>[])[0] = {
      typeKey: 'blog_post',
      slug: 'x',
      body: { title: 'X', excerpt: 'x', body: { type: 'doc' }, featuredImage: assetRef('nope') },
    };
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.issues.some((i) => i.message.includes('unknown asset "nope"'))).toBe(true);
  });

  it('flags requiresModules missing a module the content needs', () => {
    const m = baseManifest();
    m.requiresModules = ['builder', 'commerce']; // drops cms despite content[]
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues.some((i) => i.message.includes('cms'))).toBe(true);
  });

  it('flags a collection page with no recordType', () => {
    const m = baseManifest();
    (m.pages as Record<string, unknown>[])[0] = {
      name: 'Bad',
      kind: 'collection',
      tree: section(),
    };
    const r = safeParseBlueprint(m);
    expect(r.success).toBe(false);
  });
});
