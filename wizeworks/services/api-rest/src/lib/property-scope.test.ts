import { describe, expect, it, vi } from 'vitest';

import {
  productSiteVisibilityWhere,
  collectionSiteVisibilityWhere,
  categorySiteVisibilityWhere,
  mediaSiteVisibilityWhere,
  defaultPropertyIdsToActiveSite,
} from './property.js';

const PROP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Model B (docs/49 §3): "empty pins = all sites, one-or-more = only those". The
// three catalog entities share ONE where-shape so a scoped item never leaks onto a
// site it wasn't pinned to. This locks that shape — the OR that a bad edit (dropping
// the `none: {}` arm) would break, silently hiding every global item.
describe('site-visibility where fragments', () => {
  const expected = {
    AND: [
      { OR: [{ propertyLinks: { none: {} } }, { propertyLinks: { some: { propertyId: PROP } } }] },
    ],
  };

  it('product / collection / category all produce the empty-OR-pinned shape', () => {
    expect(productSiteVisibilityWhere(PROP)).toEqual(expected);
    expect(collectionSiteVisibilityWhere(PROP)).toEqual(expected);
    expect(categorySiteVisibilityWhere(PROP)).toEqual(expected);
  });

  it('keeps the "no pins = visible" arm — the default that must never be dropped', () => {
    // A global item (zero pins) is matched by `propertyLinks: { none: {} }`. If a
    // refactor kept only the `some` arm, every unscoped collection/category/product
    // would vanish from every site at once.
    const and = collectionSiteVisibilityWhere(PROP).AND as { OR: unknown[] }[];
    expect(and[0]!.OR).toContainEqual({ propertyLinks: { none: {} } });
  });
});

// Media uses a DIFFERENT shape from the catalog Model-B entities above: a direct
// nullable `property_id` (like SocialConnection), not a propertyLinks join. So its
// visibility is "this site OR shared (property_id IS NULL)". This locks that the
// NULL/shared arm is present — dropping it would hide every shared asset AND every
// legacy asset (all NULL) from every picker at once, the same class of silent
// data-hiding bug the Model-B test guards against.
describe('mediaSiteVisibilityWhere — direct-column (this site OR shared)', () => {
  it('produces the "this site OR NULL/shared" shape', () => {
    expect(mediaSiteVisibilityWhere(PROP)).toEqual({
      AND: [{ OR: [{ propertyId: PROP }, { propertyId: null }] }],
    });
  });

  it('keeps the shared arm — the default that must never be dropped', () => {
    const and = mediaSiteVisibilityWhere(PROP).AND as { OR: unknown[] }[];
    expect(and[0]!.OR).toContainEqual({ propertyId: null });
  });
});

describe('defaultPropertyIdsToActiveSite — new items default to the active site', () => {
  const resolveActive = () => Promise.resolve(PROP);

  it('single-site tenant: leaves the body untouched (no scope rows)', async () => {
    const body: Record<string, unknown> = {};
    await defaultPropertyIdsToActiveSite(body, () => Promise.resolve(1), resolveActive);
    expect('propertyIds' in body).toBe(false);
  });

  it('multi-site tenant with no explicit scope: pins to the active site', async () => {
    const body: Record<string, unknown> = {};
    await defaultPropertyIdsToActiveSite(body, () => Promise.resolve(3), resolveActive);
    expect(body.propertyIds).toEqual([PROP]);
  });

  it('an explicit propertyIds (incl. [] = all sites) is honored verbatim', async () => {
    const count = vi.fn(() => Promise.resolve(3));
    const resolve = vi.fn(resolveActive);
    const all: Record<string, unknown> = { propertyIds: [] };
    await defaultPropertyIdsToActiveSite(all, count, resolve);
    expect(all.propertyIds).toEqual([]);
    // Short-circuits before counting sites / resolving when the caller was explicit.
    expect(count).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();

    const specific: Record<string, unknown> = { propertyIds: ['x'] };
    await defaultPropertyIdsToActiveSite(specific, count, resolve);
    expect(specific.propertyIds).toEqual(['x']);
  });
});
