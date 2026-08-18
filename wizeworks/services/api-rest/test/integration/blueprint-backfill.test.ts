// Blueprint slice backfill (theming-spine Phase 3). Proves the GATE + dispatch that
// decides whether to materialize a module's slice, without depending on the marketplace
// catalog being seeded (so nothing here runs a real install):
//
//   - a module with no blueprint slice (crm) is a no-op ('not-a-content-module');
//   - a tenant with no install is a no-op ('no-install') — golden installs first;
//   - a module already materialized in the install's stored result is a no-op
//     ('already-materialized'), which is what makes install/backfill mutually exclusive
//     and the reconcile's blanket re-run idempotent.
//
// The actual slice re-run is the installer's own logic (covered by the install-route
// suites); here the point is the gate, which is what Phase 3 added.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { type Prisma, prisma } from '@wizeworks/db';
import { createTestTenant, dropTestTenant } from '../helpers.js';
import { backfillInstallForModule } from '../../src/lib/blueprint-backfill.js';

const noop = (): void => undefined;
const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  trace: noop,
  child: () => logger,
} as unknown as FastifyBaseLogger;

const createdTenants: string[] = [];

/** Plant an install row (owner-context; tenant_blueprint_installs is FORCE-RLS), with an
 *  optional stored id-map so a slice can read as materialized. */
async function plantInstall(
  tenantId: string,
  propertyId: string,
  result: Record<string, unknown>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.tenantBlueprintInstall.create({
      data: {
        tenantId,
        propertyId,
        blueprintKey: 'sparx',
        blueprintVersion: '1.1.0',
        status: 'installed',
        result: result as Prisma.InputJsonValue,
      },
    });
  });
}

const EMPTY_RESULT = {
  assets: {},
  categories: {},
  collections: {},
  products: [],
  theme: null,
  pages: [],
  emails: [],
  sequences: [],
  content: [],
  counts: {},
};

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  for (const id of createdTenants) {
    await dropTestTenant(id).catch(() => undefined);
  }
});

describe('blueprint backfill gate', () => {
  it('is a no-op for a module that carries no blueprint slice (crm)', async () => {
    const t = await createTestTenant('owner');
    createdTenants.push(t.tenantId);
    // No install even needed — a non-content module short-circuits first.
    const outcome = await backfillInstallForModule(t.tenantId, 'crm', logger);
    expect(outcome).toEqual({ backfilled: false, reason: 'not-a-content-module' });
  });

  it('is a no-op when the primary property has no install yet', async () => {
    const t = await createTestTenant('owner');
    createdTenants.push(t.tenantId);
    const outcome = await backfillInstallForModule(t.tenantId, 'commerce', logger);
    expect(outcome).toEqual({ backfilled: false, reason: 'no-install' });
  });

  it('is a no-op when the module slice is already materialized in the install', async () => {
    const t = await createTestTenant('owner');
    createdTenants.push(t.tenantId);
    // An install whose commerce slice is present (a product in the id-map).
    await plantInstall(t.tenantId, t.propertyId, {
      ...EMPTY_RESULT,
      products: [{ handle: 'demo', id: '00000000-0000-0000-0000-000000000001' }],
    });
    const outcome = await backfillInstallForModule(t.tenantId, 'commerce', logger);
    expect(outcome).toEqual({ backfilled: false, reason: 'already-materialized' });
  });
});
