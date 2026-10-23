// The backfill gate's two production loops (2026-10-23), with the database and the
// installer mocked so only the decision is under test:
//
//   - an install on a design the catalog retired logged an ERROR for every tenant and
//     module, every 6 hours, on both pods, with nothing anyone could fix;
//   - a design with nothing for a module (no booking menu, no articles) ran that slice
//     every pass and logged "materialized module slice" for rows it never wrote.
//
// The gate's DB-backed half (no install, already materialized) is in
// test/integration/blueprint-backfill.test.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type { Blueprint } from '@wizeworks/blueprints';

const m = vi.hoisted(() => ({
  findInstall: vi.fn(),
  resolveManifest: vi.fn(),
  queryRaw: vi.fn(),
  installSchedulingSlice: vi.fn(),
  installContentSlice: vi.fn(),
}));

vi.mock('@wizeworks/db', () => ({
  ADVISORY_LOCKS: { BLUEPRINT_BACKFILL_RECONCILE: 1 },
  prisma: { $queryRaw: m.queryRaw },
  withAdvisoryTickLock: (_key: number, _held: unknown, fn: () => Promise<unknown>) => fn(),
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ tenantBlueprintInstall: { findFirst: m.findInstall, update: vi.fn() } }),
}));
vi.mock('@wizeworks/crm', () => ({ getPlatformBus: vi.fn() }));
vi.mock('./blueprint-baseline.js', () => ({
  captureBaselines: vi.fn(),
  resolveBlueprintArtifacts: vi.fn(() => []),
}));
vi.mock('./blueprint-installer.js', () => ({
  installCommerceSlice: vi.fn(),
  installContentSlice: m.installContentSlice,
  installEmailSlice: vi.fn(),
  installSchedulingSlice: m.installSchedulingSlice,
  installSiteSlice: vi.fn(),
}));
vi.mock('./marketplace/resolve.js', () => ({ resolveBlueprintManifest: m.resolveManifest }));
vi.mock('./property.js', () => ({ resolvePrimaryPropertyId: () => Promise.resolve('prop-1') }));

const { backfillInstallForModule, reconcileBlueprintBackfill } =
  await import('./blueprint-backfill.js');

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const logger = log as unknown as FastifyBaseLogger;

/** A design with nothing for any module; each test adds the part it needs. */
function design(extra: Record<string, unknown> = {}): Blueprint {
  return { content: [], emails: [], sequences: [], assets: [], ...extra } as unknown as Blueprint;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.findInstall.mockResolvedValue({
    id: 'install-1',
    blueprintKey: 'mosaic',
    blueprintVersion: '1.0.0',
    sampleData: true,
    result: {
      assets: {},
      categories: {},
      collections: {},
      products: [],
      pages: [],
      emails: [],
      content: [],
    },
  });
});

describe('backfillInstallForModule', () => {
  it('reports a retired design instead of throwing', async () => {
    m.resolveManifest.mockResolvedValue(null);
    await expect(backfillInstallForModule('t1', 'scheduling', logger)).resolves.toEqual({
      backfilled: false,
      reason: 'blueprint-missing',
    });
    expect(m.installSchedulingSlice).not.toHaveBeenCalled();
  });

  it('does not run a slice the design has nothing for', async () => {
    m.resolveManifest.mockResolvedValue(design());
    await expect(backfillInstallForModule('t1', 'scheduling', logger)).resolves.toEqual({
      backfilled: false,
      reason: 'nothing-to-bring',
    });
    expect(m.installSchedulingSlice).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it('runs and logs a slice the design does declare', async () => {
    m.resolveManifest.mockResolvedValue(design({ scheduling: { services: [{ handle: 'cut' }] } }));
    m.installSchedulingSlice.mockImplementation((env: { result: Record<string, unknown> }) => {
      env.result.scheduling = {
        locations: {},
        policies: {},
        resources: {},
        services: [{ handle: 'cut', id: 's1' }],
      };
    });
    await expect(backfillInstallForModule('t1', 'scheduling', logger)).resolves.toEqual({
      backfilled: true,
      installId: 'install-1',
    });
    expect(log.info).toHaveBeenCalledTimes(1);
  });

  it('does not claim a materialization when the slice wrote nothing', async () => {
    m.resolveManifest.mockResolvedValue(design({ content: [{ title: 'Hello' }] }));
    await expect(backfillInstallForModule('t1', 'cms', logger)).resolves.toEqual({
      backfilled: false,
      reason: 'nothing-to-bring',
    });
    expect(m.installContentSlice).toHaveBeenCalledTimes(1);
    expect(log.info).not.toHaveBeenCalled();
  });
});

describe('reconcileBlueprintBackfill', () => {
  it('logs a retired design once per pass, not as an error per module', async () => {
    m.queryRaw.mockResolvedValue([{ tenant_id: 't1' }]);
    m.resolveManifest.mockResolvedValue(null);
    await expect(reconcileBlueprintBackfill(logger)).resolves.toEqual({
      acquired: true,
      backfilled: 0,
    });
    expect(log.error).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith({ tenantIds: ['t1'] }, expect.any(String));
  });
});
