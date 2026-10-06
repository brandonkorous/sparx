// The site a shopper's password-reset link opens on (sparx persona issue 064).
//
// It used to be its own copy of "what is this site's address": the primary-domain
// setting first, then ANY live domain row of any of the tenant's sites, so a reset
// link and the order emails could name two different addresses for one shop. It is
// now the shared resolver, run for the tenant's primary site.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface State {
  settings: Record<string, unknown>;
  canonical: Map<string, string>;
}

const state = vi.hoisted<State>(() => ({ settings: {}, canonical: new Map() }));

vi.mock('@wizeworks/db', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const tx = {
    tenant: { findUnique: () => Promise.resolve({ slug: 'bobs', settings: state.settings }) },
    property: {
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve({ id: 'site-parts', slug: 'primary', isPrimary: true }),
    },
    domain: {
      findFirst: ({ where }: { where: { propertyId: string } }) => {
        const host = state.canonical.get(where.propertyId);
        return Promise.resolve(host ? { host } : null);
      },
      findMany: () =>
        Promise.resolve([{ host: 'bobs.piggles.site', property: { isPrimary: true } }]),
    },
  };
  return {
    // The bare client too, sharing the same rows: the pre-fix resolver read through it,
    // so with it here a regression fails on what it ANSWERS, not on a missing mock.
    prisma: { tenant: tx.tenant, domain: tx.domain },
    tenantStore: actual.tenantStore,
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

import { tenantStore } from '@wizeworks/db';

import { resolveStoreBaseUrl } from './store-url';

const inTenant = () => tenantStore.run('tenant-1', () => resolveStoreBaseUrl());

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  state.settings = {};
  state.canonical = new Map();
});

describe('resolveStoreBaseUrl', () => {
  it("is the primary site's own domain once it works", async () => {
    state.canonical.set('site-parts', 'bobsparts.example');
    state.settings = { primaryDomain: 'old.example' };
    expect(await inTenant()).toBe('https://bobsparts.example');
  });

  it('mints the subdomain in the zone the business lives in, never a guessed one', async () => {
    expect(await inTenant()).toBe('https://bobs.piggles.site');
  });

  it('refuses to run outside a tenant', async () => {
    await expect(resolveStoreBaseUrl()).rejects.toThrow(/no tenant in context/);
  });
});
