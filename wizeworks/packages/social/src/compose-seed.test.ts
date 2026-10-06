// The link "Share this" puts in a draft post (sparx persona issue 064).
//
// It used to be its own copy of "what is this site's address", with no answer for a
// site whose domain row was missing (the draft then had no link) and the primary's
// address for a product the primary does not show. These drive the real seed
// builder and the shared site resolver over a faked database.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const PRIMARY = { id: 'site-parts', slug: 'primary', isPrimary: true };
const DONUTS = { id: 'site-donuts', slug: 'donuts', isPrimary: false };

const state = vi.hoisted(() => ({
  links: [] as string[],
  canonical: new Map<string, string>(),
}));

vi.mock('@wizeworks/db', () => {
  const sites = new Map([
    ['site-parts', { id: 'site-parts', slug: 'primary', isPrimary: true }],
    ['site-donuts', { id: 'site-donuts', slug: 'donuts', isPrimary: false }],
  ]);
  const tx = {
    tenant: { findUnique: () => Promise.resolve({ slug: 'bobs', settings: {} }) },
    property: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(sites.get(where.id) ?? null),
      findFirst: () => Promise.resolve(sites.get('site-parts')),
    },
    domain: {
      findFirst: ({ where }: { where: { propertyId: string } }) => {
        const host = state.canonical.get(where.propertyId);
        return Promise.resolve(host ? { host } : null);
      },
      findMany: () => Promise.resolve([{ host: 'bobs.sparx.zone', property: { isPrimary: true } }]),
    },
    product: {
      findFirst: () =>
        Promise.resolve({
          id: 'prod-1',
          title: 'Glazed ring',
          handle: 'glazed-ring',
          description: null,
          ogImageId: null,
          images: [],
          propertyLinks: state.links.map((propertyId) => ({ propertyId })),
        }),
    },
  };
  return {
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

import { buildComposeSeed } from './compose-seed.js';

const ctx = { tenantId: 'tenant-1', userId: 'user-1' };

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  state.links = [];
  state.canonical = new Map();
});

describe('the link in a "Share this" draft', () => {
  it('is absolute even when the site has only the subdomain it was minted on', async () => {
    const seed = await buildComposeSeed(ctx, 'product', 'prod-1');
    expect(seed?.link).toBe('https://bobs.sparx.zone/products/glazed-ring');
    expect(seed?.propertyId).toBe(PRIMARY.id);
  });

  it("opens on the product's own site, at its own domain", async () => {
    state.links = [DONUTS.id];
    state.canonical.set(DONUTS.id, 'savorydonuts.example');
    const seed = await buildComposeSeed(ctx, 'product', 'prod-1');
    expect(seed?.link).toBe('https://savorydonuts.example/products/glazed-ring');
    expect(seed?.propertyId).toBe(DONUTS.id);
  });
});
