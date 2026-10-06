// The marketplace's "Visit their store" links (sparx persona issue 064).
//
// Both the merchant directory's store link and every listing's product link were
// `SPARX_SITE_BASE` with the tenant slug substituted, and null when it was unset,
// which it always was: no shopper on sparx.market was ever shown a way to the
// seller's own site. These drive the real projection writer and the real site
// resolver over a faked database, with the setting unset.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const MARKETED = 'site-donuts';
const PRIMARY = 'site-parts';

interface State {
  marketPropertyId: string | null;
  links: string[];
  canonical: Map<string, string>;
  listing: null | { productUrl: string | null };
  merchant: null | { siteUrl: string | null };
}

const state = vi.hoisted<State>(() => ({
  marketPropertyId: 'site-donuts',
  /** The product's site links; empty = shown on every site. */
  links: [],
  canonical: new Map(),
  listing: null,
  merchant: null,
}));

vi.mock('@wizeworks/db', () => {
  const sites = new Map([
    ['site-parts', { id: 'site-parts', slug: 'primary', isPrimary: true, name: "Bob's Parts" }],
    ['site-donuts', { id: 'site-donuts', slug: 'donuts', isPrimary: false, name: 'Savory Donuts' }],
  ]);
  const tx = {
    marketMerchantProfile: {
      findUnique: () =>
        Promise.resolve({
          enabled: true,
          defaultCategory: 'food',
          marketPropertyId: state.marketPropertyId,
          handle: 'savory-donuts',
          bannerMediaId: null,
          bio: null,
          location: null,
          headline: null,
        }),
    },
    product: {
      findFirst: () =>
        Promise.resolve({
          id: 'prod-1',
          title: 'Glazed ring',
          handle: 'glazed-ring',
          description: null,
          status: 'active',
          deletedAt: null,
          marketListed: true,
          marketCategory: null,
          marketFeatured: false,
          marketApproved: true,
          priceMinCents: 250,
          priceMaxCents: 250,
          inStock: true,
          averageRating: null,
          reviewCount: 0,
          bestSellerRank: null,
          publishedAt: null,
          propertyLinks: state.links.map((propertyId) => ({ propertyId })),
          images: [],
          variants: [{ currency: 'USD', inventoryLevels: [] }],
        }),
    },
    tenant: {
      findUnique: () => Promise.resolve({ slug: 'bobs', socials: [], settings: {} }),
    },
    property: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(sites.get(where.id) ?? null),
      findFirst: ({ where }: { where: { id?: string; isPrimary?: boolean } }) =>
        Promise.resolve(
          where.id ? (sites.get(where.id) ?? null) : (sites.get('site-parts') ?? null)
        ),
    },
    tenantBrand: { findUnique: () => Promise.resolve(null) },
    mediaAsset: { findFirst: () => Promise.resolve(null) },
    domain: {
      findFirst: ({ where }: { where: { propertyId: string } }) => {
        const host = state.canonical.get(where.propertyId);
        return Promise.resolve(host ? { host } : null);
      },
      findMany: () => Promise.resolve([{ host: 'bobs.sparx.zone', property: { isPrimary: true } }]),
    },
    marketListing: {
      findFirst: () => Promise.resolve(null),
      count: () => Promise.resolve(1),
      deleteMany: () => Promise.resolve({ count: 0 }),
      upsert: ({ create }: { create: { productUrl: string | null } }) => {
        state.listing = create;
        return Promise.resolve(create);
      },
    },
    marketMerchant: {
      deleteMany: () => Promise.resolve({ count: 0 }),
      upsert: ({ create }: { create: { siteUrl: string | null } }) => {
        state.merchant = create;
        return Promise.resolve(create);
      },
    },
    $queryRaw: () => Promise.resolve([{ rating: null, ratingCount: 0 }]),
  };
  return {
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

import { projectMarketListing } from './projection';

const ctx = { tenantId: 'tenant-1' };

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  state.marketPropertyId = MARKETED;
  state.links = [];
  state.canonical = new Map();
  state.listing = null;
  state.merchant = null;
});

describe('the "Visit their store" links on sparx.market', () => {
  it('are absolute with SPARX_SITE_BASE unset, on the marketed site', async () => {
    await projectMarketListing(ctx, 'prod-1');
    expect(state.listing?.productUrl).toBe('https://donuts.bobs.sparx.zone/products/glazed-ring');
    expect(state.merchant?.siteUrl).toBe('https://donuts.bobs.sparx.zone/');
  });

  it("use the marketed site's own domain once it has one", async () => {
    state.canonical.set(MARKETED, 'savorydonuts.example');
    await projectMarketListing(ctx, 'prod-1');
    expect(state.listing?.productUrl).toBe('https://savorydonuts.example/products/glazed-ring');
    expect(state.merchant?.siteUrl).toBe('https://savorydonuts.example/');
  });

  it("fall back to the tenant's primary site when no site is marketed yet", async () => {
    state.marketPropertyId = null;
    await projectMarketListing(ctx, 'prod-1');
    expect(state.listing?.productUrl).toBe('https://bobs.sparx.zone/products/glazed-ring');
    expect(state.merchant?.siteUrl).toBe('https://bobs.sparx.zone/');
  });

  it('send a product scoped to another site to the site that shows it', async () => {
    state.links = [PRIMARY];
    await projectMarketListing(ctx, 'prod-1');
    expect(state.listing?.productUrl).toBe('https://bobs.sparx.zone/products/glazed-ring');
  });
});
