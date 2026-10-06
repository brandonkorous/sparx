// The link a "published product / article" automation drafts into a social post
// (sparx persona issue 064).
//
// It used to be its own copy of "what is this site's address", with no answer for a
// site whose domain row was missing (the drafted post then had no link) and a link
// on the primary for a product the primary does not show. These drive the real
// resolver and the shared site resolver over a faked transaction.

import { beforeEach, describe, expect, it } from 'vitest';
import { resolveFields, type TenantCtx } from '@wizeworks/automation';

import { installEntityResolvers } from './resolvers.js';

const PRIMARY = { id: 'site-parts', slug: 'primary', isPrimary: true };
const DONUTS = { id: 'site-donuts', slug: 'donuts', isPrimary: false };
const SITES = new Map([
  [PRIMARY.id, PRIMARY],
  [DONUTS.id, DONUTS],
]);

let links: string[] = [];
let canonical = new Map<string, string>();

const tx = {
  tenant: { findUnique: () => Promise.resolve({ slug: 'bobs', settings: {} }) },
  property: {
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(SITES.get(where.id) ?? null),
    findFirst: () => Promise.resolve(PRIMARY),
  },
  domain: {
    findFirst: ({ where }: { where: { propertyId: string } }) => {
      const host = canonical.get(where.propertyId);
      return Promise.resolve(host ? { host } : null);
    },
    findMany: () => Promise.resolve([{ host: 'bobs.sparx.zone', property: { isPrimary: true } }]),
  },
  product: {
    findUnique: () =>
      Promise.resolve({
        id: 'prod-1',
        title: 'Glazed ring',
        handle: 'glazed-ring',
        status: 'active',
        description: null,
        ogImageId: null,
        images: [],
        propertyLinks: links.map((propertyId) => ({ propertyId })),
      }),
  },
};

const ctx = { tenantId: 'tenant-1', tx, deps: {}, causeDepth: 0 } as unknown as TenantCtx;

installEntityResolvers();

const announceUrl = async () =>
  (await resolveFields(ctx, 'product.published', { productId: 'prod-1' }))['announce.url'];

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  links = [];
  canonical = new Map();
});

describe('the link a published product drafts into a post', () => {
  it('is absolute even when the site has only the subdomain it was minted on', async () => {
    expect(await announceUrl()).toBe('https://bobs.sparx.zone/products/glazed-ring');
  });

  it('opens on the site the product is scoped to, at its own domain', async () => {
    links = [DONUTS.id];
    canonical.set(DONUTS.id, 'savorydonuts.example');
    expect(await announceUrl()).toBe('https://savorydonuts.example/products/glazed-ring');
  });

  it('opens on a site that shows it when it is scoped to several', async () => {
    links = [DONUTS.id, 'site-other'];
    expect(await announceUrl()).toBe('https://donuts.bobs.sparx.zone/products/glazed-ring');
  });
});
