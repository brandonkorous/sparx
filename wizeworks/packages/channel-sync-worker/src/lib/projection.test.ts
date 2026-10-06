// The product page a sales channel sends its shoppers to (sparx persona issue 064).
//
// Every feed needs an ABSOLUTE product URL. It was `SPARX_SITE_BASE` with the tenant
// slug substituted, and the push was skipped when that was unset, which it always
// was: no product ever reached Google Shopping, Meta, Pinterest or Faire. These
// drive the real projection and the real site resolver over a faked database, with
// the setting unset, and pin that the link is absolute and on the right site.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const PRIMARY = { id: 'site-parts', slug: 'primary', isPrimary: true };
const DONUTS = { id: 'site-donuts', slug: 'donuts', isPrimary: false };

const state = vi.hoisted(() => ({
  /** The product's site links; empty = shown on every site. */
  links: [] as string[],
  /** Canonical, working custom domains by site id. */
  canonical: new Map<string, string>(),
}));

vi.mock('@wizeworks/db', () => {
  const sites = new Map([
    ['site-parts', { id: 'site-parts', slug: 'primary', isPrimary: true }],
    ['site-donuts', { id: 'site-donuts', slug: 'donuts', isPrimary: false }],
  ]);
  const tx = {
    tenant: {
      findUnique: () => Promise.resolve({ slug: 'bobs', settings: {} }),
    },
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
      // The subdomain the tenant was minted on at signup: the zone its sites live in.
      findMany: () => Promise.resolve([{ host: 'bobs.sparx.zone', property: { isPrimary: true } }]),
    },
    product: {
      findFirst: () =>
        Promise.resolve({
          id: 'prod-1',
          title: 'Glazed ring',
          description: null,
          handle: 'glazed ring',
          productType: null,
          vendor: null,
          tags: [],
          propertyLinks: state.links.map((propertyId) => ({ propertyId })),
          variants: [
            {
              id: 'var-1',
              sku: 'GR-1',
              title: null,
              barcode: null,
              priceCents: 250,
              currency: 'USD',
              weightGrams: null,
              optionAssignments: [],
              inventoryLevels: [],
            },
          ],
          images: [],
        }),
    },
    mediaAsset: { findMany: () => Promise.resolve([]) },
  };
  return {
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

import { buildChannelProduct } from './projection.js';

const log = { debug: vi.fn(), warn: vi.fn(), info: vi.fn() } as unknown as Logger;

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  state.links = [];
  state.canonical = new Map();
});

const urlFor = async (channelSiteId: string | null) =>
  (await buildChannelProduct('tenant-1', 'prod-1', channelSiteId, log))?.productUrl ?? null;

describe('the product URL a channel is given', () => {
  it('is absolute with SPARX_SITE_BASE unset, instead of skipping the push', async () => {
    expect(await urlFor(null)).toBe('https://bobs.sparx.zone/products/glazed%20ring');
  });

  it("opens on the connection's own site", async () => {
    state.canonical.set(DONUTS.id, 'savorydonuts.example');
    expect(await urlFor(DONUTS.id)).toBe('https://savorydonuts.example/products/glazed%20ring');
    // The other business's shop links to its own site, never the sibling's.
    expect(await urlFor(PRIMARY.id)).toBe('https://bobs.sparx.zone/products/glazed%20ring');
  });

  it('mints a second site on its own subdomain when it has no domain yet', async () => {
    expect(await urlFor(DONUTS.id)).toBe('https://donuts.bobs.sparx.zone/products/glazed%20ring');
  });

  it('links a tenant-wide connection to a site that actually shows a scoped product', async () => {
    state.links = [DONUTS.id];
    state.canonical.set(DONUTS.id, 'savorydonuts.example');
    expect(await urlFor(null)).toBe('https://savorydonuts.example/products/glazed%20ring');
  });

  it("does not push another business's product to this shop", async () => {
    state.links = [DONUTS.id];
    expect(await buildChannelProduct('tenant-1', 'prod-1', PRIMARY.id, log)).toBeNull();
  });
});
