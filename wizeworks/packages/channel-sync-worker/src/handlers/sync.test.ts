// A catalog push builds the listing for each connection's OWN site (sparx persona
// issue 064, docs/131 §4). A channel connection belongs to one business, so the
// product link it is given has to open on that business's site; one listing built
// per tenant and pushed everywhere sends Savory Donuts's Etsy shoppers to Bob's Parts.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const state = vi.hoisted(() => ({
  connections: [] as { id: string; channel: string; propertyId: string | null }[],
  pushed: [] as { connection: string; productUrl: string }[],
  built: [] as (string | null)[],
}));

vi.mock('@wizeworks/db', () => {
  const tx = {
    channelConnection: {
      findMany: () =>
        Promise.resolve(
          state.connections.map((c) => ({
            ...c,
            externalId: null,
            accessTokenEnc: null,
            refreshTokenEnc: null,
            tokenExpiresAt: null,
            metadata: null,
          }))
        ),
      update: () => Promise.resolve({}),
    },
    channelProductMapping: { upsert: () => Promise.resolve({}) },
  };
  return { withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
});

vi.mock('@wizeworks/channels', () => ({
  getChannel: (slug: string) => ({
    pushProduct: (auth: { connection: string }, product: { productUrl: string }) => {
      state.pushed.push({ connection: auth.connection, productUrl: product.productUrl });
      return Promise.resolve({ externalProductId: 'x', variants: [] });
    },
    slug,
  }),
}));

vi.mock('../lib/auth.js', () => ({
  resolveChannelAuth: (_tenant: string, t: { id: string }) => Promise.resolve({ connection: t.id }),
}));

// The projection is the unit under test elsewhere (lib/projection.test.ts); here it
// reports which site it was asked to build for.
vi.mock('../lib/projection.js', () => ({
  buildChannelProduct: (_tenant: string, _product: string, siteId: string | null) => {
    state.built.push(siteId);
    return Promise.resolve({ productUrl: `https://${siteId ?? 'primary'}.example/products/p` });
  },
  sellableForVariant: () => Promise.resolve(null),
}));

import { handleCatalogSync } from './sync.js';

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger;

beforeEach(() => {
  state.connections = [];
  state.pushed = [];
  state.built = [];
});

describe('handleCatalogSync', () => {
  it("gives each connection the product's page on its own site", async () => {
    state.connections = [
      { id: 'etsy-donuts', channel: 'etsy', propertyId: 'donuts' },
      { id: 'etsy-parts', channel: 'etsy', propertyId: 'parts' },
      { id: 'google-all', channel: 'google_shopping', propertyId: null },
    ];
    await handleCatalogSync('prod-1', 'tenant-1', log);
    expect(state.pushed).toEqual([
      { connection: 'etsy-donuts', productUrl: 'https://donuts.example/products/p' },
      { connection: 'etsy-parts', productUrl: 'https://parts.example/products/p' },
      { connection: 'google-all', productUrl: 'https://primary.example/products/p' },
    ]);
  });

  it('builds the listing once per site, however many channels sell it', async () => {
    state.connections = [
      { id: 'etsy-donuts', channel: 'etsy', propertyId: 'donuts' },
      { id: 'meta-donuts', channel: 'meta', propertyId: 'donuts' },
    ];
    await handleCatalogSync('prod-1', 'tenant-1', log);
    expect(state.built).toEqual(['donuts']);
    expect(state.pushed).toHaveLength(2);
  });
});
