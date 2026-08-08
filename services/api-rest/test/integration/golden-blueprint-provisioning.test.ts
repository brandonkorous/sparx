// Golden-blueprint provisioning (theming-spine Phase 3). Proves the two NEW pieces the
// default-site install rests on, without depending on the marketplace catalog being
// seeded in the test DB (so nothing here triggers a real fleet-wide install):
//
//   1. The SECURITY DEFINER scan find_tenants_without_primary_blueprint_install() — the
//      reconcile's discovery primitive. It must list a tenant PRIMARY property that has
//      no blueprint install, and drop it the moment ANY install exists.
//   2. The install GATE — installGoldenForTenant() must be a no-op when the primary
//      property already carries an install (e.g. an onboarding pick), so golden is the
//      default and never overwrites a chosen blueprint.
//
// The install MECHANICS (installBlueprint) are covered by the blueprint-install route
// suites; here the point is discovery + the gate, which is what Phase 3 added.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@sparx/db';
import { createTestTenant, dropTestTenant } from '../helpers.js';
import {
  installGoldenForTenant,
  type GoldenInstallOutcome,
} from '../../src/lib/golden-blueprint-provisioning.js';

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

async function scanRows(): Promise<{ tenant_id: string; property_id: string }[]> {
  return prisma.$queryRaw`
    SELECT tenant_id, property_id FROM find_tenants_without_primary_blueprint_install()
  `;
}

/** Plant an install row on a property, owner-context (tenant_blueprint_installs is
 *  FORCE-RLS, so the insert must run under a tenant session). */
async function plantInstall(tenantId: string, propertyId: string, key: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.tenantBlueprintInstall.create({
      data: {
        tenantId,
        propertyId,
        blueprintKey: key,
        blueprintVersion: '1.0.0',
        status: 'installed',
      },
    });
  });
}

async function installCount(tenantId: string, propertyId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.tenantBlueprintInstall.count({ where: { propertyId } });
  });
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  for (const id of createdTenants) {
    await dropTestTenant(id).catch(() => undefined);
  }
});

describe('golden-blueprint provisioning', () => {
  it('scan lists a primary property with no install, and drops it once one exists', async () => {
    const t = await createTestTenant('owner');
    createdTenants.push(t.tenantId);

    // A fresh tenant's primary property has no install → the scan finds it. (Other
    // suites' residue may also appear; assert on OUR pair, not the fleet count.)
    const before = await scanRows();
    expect(before.some((r) => r.tenant_id === t.tenantId && r.property_id === t.propertyId)).toBe(
      true
    );

    // Any install (a non-golden onboarding pick here) takes it out of scope.
    await plantInstall(t.tenantId, t.propertyId, 'onboarding-pick');
    const after = await scanRows();
    expect(after.some((r) => r.tenant_id === t.tenantId)).toBe(false);
  });

  it('installGoldenForTenant is a gated no-op when an install already exists', async () => {
    const t = await createTestTenant('owner');
    createdTenants.push(t.tenantId);
    await plantInstall(t.tenantId, t.propertyId, 'onboarding-pick');

    // Golden must NOT resolve the catalog or write a second row — the gate short-circuits
    // before either, so this never overwrites the tenant's chosen blueprint.
    const outcome: GoldenInstallOutcome = await installGoldenForTenant(t.tenantId, logger);
    expect(outcome).toEqual({ installed: false, reason: 'already-installed' });
    expect(await installCount(t.tenantId, t.propertyId)).toBe(1);
  });
});
