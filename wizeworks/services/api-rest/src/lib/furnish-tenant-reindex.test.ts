// Signup's furnish asks for the search index to be rebuilt.
//
// Furnish lays down the starter, the chosen design and the trade's sample pack,
// all in bulk and none of it announced row by row. The console's own Load
// button already asked search to rebuild afterwards (sparx persona issue 086);
// this path, which every new business takes, did not. So a business three
// minutes old opened its search box on "101 products, 7 customers and 10 orders
// are not in this box yet" (Piggles persona issue 935).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const publish = vi.fn();
const loadSampleData = vi.fn();

vi.mock('@wizeworks/api-core/pubsub', () => ({ publish }));
vi.mock('@wizeworks/auth', () => ({ listEnabledModules: () => Promise.resolve(['commerce']) }));
vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      user: { findFirst: () => Promise.resolve({ id: 'owner-1' }) },
      property: { findFirst: () => Promise.resolve({ id: 'site-1' }) },
    }),
  prisma: { tenant: { findUnique: () => Promise.resolve({ settings: {} }) } },
  loadSampleData,
  resolveSamplePack: () => 'apparel',
}));
vi.mock('./module-toggle.js', () => ({
  applyModuleWrites: () => Promise.resolve(),
  readModuleFlags: () => ({}),
}));
vi.mock('./industry-starters.js', () => ({
  starterRegistry: new Map(),
  installIndustryStarter: vi.fn(),
}));
vi.mock('./blueprint-installer.js', () => ({ findInstall: vi.fn(), installBlueprint: vi.fn() }));
vi.mock('./marketplace/brand-scope.js', () => ({ blueprintVisibleTo: vi.fn() }));
vi.mock('./marketplace/resolve.js', () => ({ resolveBlueprintManifest: vi.fn() }));
vi.mock('./tenant-brand.js', () => ({ tenantPlatformBrand: vi.fn() }));

const { furnishTenant } = await import('./furnish-tenant.js');

const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() } as never;

beforeEach(() => {
  publish.mockReset().mockResolvedValue(undefined);
  loadSampleData.mockReset().mockResolvedValue({ customers: 7 });
});

describe('furnishing a new business and search', () => {
  it('asks for a rebuild once the sample records are down', async () => {
    await furnishTenant({ tenantId: TENANT, modules: [], industry: 'apparel' }, logger);
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      'search.reindex.requested',
      TENANT,
      'owner-1',
      expect.objectContaining({ dropStale: false })
    );
    expect(loadSampleData.mock.invocationCallOrder[0]).toBeLessThan(
      publish.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('still furnishes when the request cannot be sent', async () => {
    publish.mockRejectedValue(new Error('broker down'));
    const result = await furnishTenant(
      { tenantId: TENANT, modules: [], industry: 'apparel' },
      logger
    );
    expect(result.sample).toEqual({ customers: 7 });
  });
});
