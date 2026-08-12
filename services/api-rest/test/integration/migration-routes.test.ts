// Migration routes — moving a business off another platform (docs/147).
//
// What is worth locking down here is not "does it write a row". It is the four
// promises this feature makes, each of which is invisible in the happy path and
// expensive to break:
//
//   • The catalogue tells the truth. Every vendor the marketing site advertises is
//     served here, and an entity whose module is off is REPORTED as locked rather
//     than quietly missing — "your posts come when you switch the builder on" is
//     useful; a shorter list looks like we cannot do it.
//   • The order of import is a dependency order. Stock resolves a SKU that products
//     create; collections list products. A run that imports them in file order
//     half-works and looks like the importer is broken.
//   • A dry run writes NOTHING, and a real run writes only rows the tenant was shown
//     a count for. The count on screen and the count in the database are the same
//     number or the whole preview was a lie.
//   • One tenant's migration is invisible to another, by run id and by list.
//
// Real Postgres, real RLS, fixtures clean up through the tenant cascade — same shape
// as rls-isolation.test.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import { createApp } from '../../src/app.js';
import {
  type TestTenant,
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
} from '../helpers.js';

let app: FastifyInstance;
let tenant: TestTenant;
let other: TestTenant;
let token: string;
let otherToken: string;

/** `createTestTenant` provisions a tenant with NO modules, which is correct — a new
 *  tenant pays for what it turns on. Migration is gated per entity, so a tenant with
 *  nothing on can import nothing, and every assertion below would pass vacuously. */
async function enableModules(tenantId: string, modules: string[]): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        modules: Object.fromEntries(modules.map((module) => [module, { enabled: true }])),
      },
    },
  });
}

function post(url: string, payload: Record<string, unknown>, as = token) {
  return app.inject({ method: 'POST', url, headers: authHeader(as), payload });
}

function get(url: string, as = token) {
  return app.inject({ method: 'GET', url, headers: authHeader(as) });
}

/** import_jobs has FORCE RLS, so a bare prisma read returns nothing at all — which
 *  would make a "nothing was written" assertion pass for entirely the wrong reason. */
function asTenant<T>(run: (tx: Parameters<Parameters<typeof withTenant>[1]>[0]) => Promise<T>) {
  return withTenant({ tenantId: tenant.tenantId }, run);
}

beforeAll(async () => {
  app = await createApp();
  tenant = await createTestTenant('owner');
  other = await createTestTenant('owner');
  token = signToken(app, tenant);
  otherToken = signToken(app, other);
  await enableModules(tenant.tenantId, ['commerce', 'inventory', 'crm']);
});

afterAll(async () => {
  await app.close();
  await dropTestTenant(tenant.tenantId);
  await dropTestTenant(other.tenantId);
});

// ── The catalogue ────────────────────────────────────────────────────────────

describe('GET /v1/migration/vendors', () => {
  it('serves the whole roster, not a subset', async () => {
    const res = await get('/v1/migration/vendors');
    expect(res.statusCode).toBe(200);

    const vendors = res.json().data.vendors as { slug: string }[];
    // The five the request that started this named by hand, plus the ones a page
    // exists for. If an adapter is removed, a marketing page 404s — so this list
    // failing is the early warning for that.
    for (const slug of ['shopify', 'squarespace', 'wix', 'webflow', 'wordpress', 'hubspot']) {
      expect(vendors.map((vendor) => vendor.slug)).toContain(slug);
    }
    expect(vendors.length).toBeGreaterThanOrEqual(20);
  });

  it('marks an entity locked, with the module that unlocks it', async () => {
    const res = await get('/v1/migration/vendors');
    const vendors = res.json().data.vendors as {
      slug: string;
      entities: { entity: string; module: string | null; available: boolean }[];
    }[];

    const wordpress = vendors.find((vendor) => vendor.slug === 'wordpress');
    expect(wordpress).toBeDefined();

    // This tenant has commerce, inventory and crm on — but not cms. Its posts are
    // therefore reported, and reported as locked, rather than dropped from the list.
    const content = wordpress?.entities.find((entity) => entity.entity === 'content');
    expect(content).toMatchObject({ module: 'cms', available: false });

    const products = vendors
      .find((vendor) => vendor.slug === 'shopify')
      ?.entities.find((entity) => entity.entity === 'products');
    expect(products).toMatchObject({ module: 'commerce', available: true });
  });

  it('carries the credential form for the three platforms with a live connection', async () => {
    const res = await get('/v1/migration/vendors');
    const vendors = res.json().data.vendors as {
      slug: string;
      hasConnector: boolean;
      connector: { slug: string; fields: { key: string; secret: boolean }[] } | null;
    }[];

    const shopify = vendors.find((vendor) => vendor.slug === 'shopify');
    expect(shopify?.hasConnector).toBe(true);
    expect(shopify?.connector?.slug).toBe('shopify');
    // The form is rendered from this, so a missing field is a field the tenant
    // cannot fill in.
    expect(shopify?.connector?.fields.map((field) => field.key)).toEqual(['shop', 'accessToken']);
    expect(shopify?.connector?.fields.find((field) => field.key === 'accessToken')?.secret).toBe(
      true
    );

    // WooCommerce and WordPress share one connector, because underneath they are
    // one site with one REST API.
    expect(vendors.find((vendor) => vendor.slug === 'woocommerce')?.connector?.slug).toBe(
      'wordpress'
    );

    const wix = vendors.find((vendor) => vendor.slug === 'wix');
    expect(wix?.hasConnector).toBe(false);
    expect(wix?.connector).toBeNull();
  });

  it('needs a login', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/migration/vendors' });
    expect(res.statusCode).toBe(401);
  });
});

// ── Checking rows before anything is written ─────────────────────────────────

describe('POST /v1/migration/preview', () => {
  it('reports what is wrong without writing anything', async () => {
    const before = await asTenant((tx) => tx.importJob.count());

    const res = await post('/v1/migration/preview', {
      entity: 'products',
      rows: [
        { handle: 'mug', title: 'Stoneware mug', sku: 'MUG', price: '22.00' },
        { handle: 'nameless', sku: 'X' },
      ],
    });

    expect(res.statusCode).toBe(200);
    const report = res.json().data.report as {
      okCount: number;
      errorCount: number;
      errorRows: number[];
    };
    expect(report.okCount).toBe(1);
    expect(report.errorCount).toBeGreaterThan(0);
    // Row two has no title, which products require.
    expect(report.errorRows).toContain(1);

    expect(await asTenant((tx) => tx.importJob.count())).toBe(before);
  });

  it('refuses an entity that does not exist rather than guessing', async () => {
    const res = await post('/v1/migration/preview', {
      entity: 'unicorns',
      rows: [{ name: 'Sparkle' }],
    });
    expect(res.statusCode).toBe(422);
  });
});

// ── Starting a run ───────────────────────────────────────────────────────────

describe('POST /v1/migration/runs', () => {
  it('creates one job per entity, in dependency order, and reports what it skipped', async () => {
    const res = await post('/v1/migration/runs', {
      vendor: 'shopify',
      fileName: 'products_export.csv',
      dryRun: true,
      entities: [
        // Deliberately the wrong way round: stock first, then the products whose
        // SKUs that stock has to resolve against.
        { entity: 'inventory_levels', rows: [{ sku: 'MUG', location: 'Studio', quantity: '6' }] },
        { entity: 'products', rows: [{ handle: 'mug', title: 'Stoneware mug', sku: 'MUG' }] },
        // cms is off for this tenant — reported, never a 403 on the whole run.
        { entity: 'content', rows: [{ title: 'About us', slug: 'about' }] },
      ],
    });

    expect(res.statusCode).toBe(202);
    const body = res.json().data as {
      runId: string;
      jobs: { entityType: string }[];
      skipped: { entity: string; module: string; rows: number }[];
    };

    expect(body.jobs.map((job) => job.entityType)).toEqual(['products', 'inventory_levels']);
    expect(body.skipped).toEqual([{ entity: 'content', module: 'cms', rows: 1 }]);

    const jobs = await asTenant((tx) => tx.importJob.findMany({ orderBy: { createdAt: 'asc' } }));
    const mine = jobs.filter(
      (job) => (job.options as { migrationRunId?: string }).migrationRunId === body.runId
    );
    expect(mine).toHaveLength(2);
    // A run has no table of its own — this shared id IS the run, which is what
    // keeps the whole feature off the migration pipeline.
    for (const job of mine) {
      expect((job.options as { dryRun?: boolean }).dryRun).toBe(true);
      expect((job.options as { vendor?: string }).vendor).toBe('shopify');
      expect(job.status).toBe('pending');
    }
  });

  it('sends only the rows the tenant was shown a count for', async () => {
    const res = await post('/v1/migration/runs', {
      vendor: 'shopify',
      dryRun: true,
      entities: [
        {
          entity: 'products',
          rows: [
            { handle: 'mug', title: 'Stoneware mug', sku: 'MUG' },
            { handle: 'broken', sku: 'NO-TITLE' },
            { handle: 'bowl', title: 'Serving bowl', sku: 'BOWL' },
          ],
        },
      ],
    });

    expect(res.statusCode).toBe(202);
    const runId = res.json().data.runId as string;

    const job = await asTenant((tx) =>
      tx.importJob.findFirstOrThrow({
        where: { options: { path: ['migrationRunId'], equals: runId } },
      })
    );
    // Two, not three. The failing row was dropped here rather than becoming an
    // error row later, so the number promised is the number that happens.
    expect(job.rowCount).toBe(2);
    expect((job.rawRows as { sku: string }[]).map((row) => row.sku)).toEqual(['MUG', 'BOWL']);
  });

  it('says so plainly when every module the file needs is switched off', async () => {
    const res = await post('/v1/migration/runs', {
      entities: [{ entity: 'content', rows: [{ title: 'About us', slug: 'about' }] }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/modules for those are turned off/i);
  });

  it('will not let a viewer start one', async () => {
    const viewer = signToken(app, tenant, 'viewer');
    const res = await post(
      '/v1/migration/runs',
      { entities: [{ entity: 'products', rows: [{ handle: 'x', title: 'X' }] }] },
      viewer
    );
    expect(res.statusCode).toBe(403);
  });
});

// ── Reading a run back ───────────────────────────────────────────────────────

describe('GET /v1/migration/runs', () => {
  it('rolls the jobs of one run up into one row, and keeps it out of the other tenant', async () => {
    const created = await post('/v1/migration/runs', {
      vendor: 'hubspot',
      fileName: 'hubspot-crm-exports-all-contacts.csv',
      dryRun: true,
      entities: [
        {
          entity: 'customers',
          rows: [
            { email: 'ada@example.com', first_name: 'Ada' },
            { email: 'sam@example.com', first_name: 'Sam' },
          ],
        },
      ],
    });
    const runId = created.json().data.runId as string;

    // An ordinary one-off import, which belongs to the surface that made it and has
    // no business in this list. It is here because the filter that excludes it is a
    // JSON-path filter Prisma will happily compile and then reject at the database —
    // this list 500'd on every call until a test asked it for something.
    await asTenant((tx) =>
      tx.importJob.create({
        data: {
          tenantId: tenant.tenantId,
          entityType: 'products',
          status: 'completed',
          rowCount: 1,
          options: { upsert: true },
          rawRows: [{ handle: 'not-a-migration', title: 'Not a migration' }],
        },
      })
    );

    const list = await get('/v1/migration/runs');
    expect(list.statusCode).toBe(200);
    const runs = list.json().data.runs as { runId: string; vendor: string; dryRun: boolean }[];
    const mine = runs.find((run) => run.runId === runId);
    expect(mine).toMatchObject({ vendor: 'hubspot', dryRun: true });
    expect(runs.every((run) => typeof run.runId === 'string' && run.runId !== '')).toBe(true);

    const detail = await get(`/v1/migration/runs/${runId}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.run.entities).toEqual([
      expect.objectContaining({ entity: 'customers', rowCount: 2 }),
    ]);

    // The other tenant has never heard of it, by id or in their list.
    const theirs = await get(`/v1/migration/runs/${runId}`, otherToken);
    expect(theirs.statusCode).toBe(404);
    const theirList = await get('/v1/migration/runs', otherToken);
    expect(
      (theirList.json().data.runs as { runId: string }[]).map((run) => run.runId)
    ).not.toContain(runId);
  });

  it('404s a run that was never started', async () => {
    const res = await get('/v1/migration/runs/not-a-real-run');
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /v1/migration/runs/:runId/cancel', () => {
  it('stops what has not started and says how much that was', async () => {
    const created = await post('/v1/migration/runs', {
      vendor: 'shopify',
      dryRun: true,
      entities: [{ entity: 'products', rows: [{ handle: 'jug', title: 'Water jug', sku: 'JUG' }] }],
    });
    const runId = created.json().data.runId as string;

    const res = await post(`/v1/migration/runs/${runId}/cancel`, {});
    expect(res.statusCode).toBe(200);
    expect(res.json().data.cancelled).toBe(1);

    // Cancelling twice is not an error — it is a person clicking again.
    const again = await post(`/v1/migration/runs/${runId}/cancel`, {});
    expect(again.json().data.cancelled).toBe(0);
    expect(again.json().data.note).toMatch(/already started/i);
  });
});

// ── Live connections ─────────────────────────────────────────────────────────
//
// These prove the ROUTE's own contract — who may call it, what it refuses, and that
// it never reaches the network on a request it should have rejected. The connectors
// themselves are tested against a stubbed fetch in @sparx/migration, which is where
// that belongs; a test here that talked to Shopify would be a test of Shopify.

describe('POST /v1/migration/connect', () => {
  it('refuses a vendor that has no live connection, and points at the file path', async () => {
    const res = await post('/v1/migration/connect', {
      vendor: 'wix',
      credentials: { accessToken: 'anything' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/no live connection/i);
    expect(res.json().error.message).toMatch(/files/i);
  });

  it('turns a missing credential into a sentence rather than a stack trace', async () => {
    const res = await post('/v1/migration/connect', { vendor: 'shopify', credentials: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/store address/i);
  });

  it('refuses to fetch a private address, whoever asks', async () => {
    // The whole reason the guard exists: this route makes our server fetch an
    // address a tenant typed. Left open it is a read of anything on the cluster.
    const res = await post('/v1/migration/connect', {
      vendor: 'wordpress',
      credentials: { siteUrl: 'http://169.254.169.254/latest/meta-data/' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/private network/i);
  });

  it('will not let a viewer connect', async () => {
    const viewer = signToken(app, tenant, 'viewer');
    const res = await post(
      '/v1/migration/connect',
      { vendor: 'shopify', credentials: { shop: 'x' } },
      viewer
    );
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /v1/migration/pull', () => {
  it('refuses an entity that connector does not read', async () => {
    const res = await post('/v1/migration/pull', {
      vendor: 'hubspot',
      entity: 'products',
      credentials: { accessToken: 'pat-na1-test' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/do not read/i);
  });

  it('refuses an entity whose module is switched off, before touching the network', async () => {
    const res = await post('/v1/migration/pull', {
      vendor: 'wordpress',
      entity: 'content',
      credentials: { siteUrl: 'https://example.com' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/cms module/i);
  });

  it('refuses a private address here too, not only on connect', async () => {
    const res = await post('/v1/migration/pull', {
      vendor: 'wordpress',
      entity: 'media',
      credentials: { siteUrl: 'http://10.0.0.5/' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/private network/i);
  });
});
