// Nightly template-provisioning reconcile (docs/90 §6, docs/91 §7). Proves the
// self-heal path: a tenant whose email module is active but that NEVER ran the
// activation provisioner (a dropped `module.activated`, or activation before this
// shipped) holds no default Builder emails — and the reconcile pass discovers it
// via find_tenants_with_active_module('email') and provisions the 13 defaults.
// Idempotent: a second pass adds nothing.
//
// The tenant is created with email enabled DIRECTLY in settings (not through the
// /v1/tenant/modules route), so the in-process provisioning consumer never fires —
// exactly the gap the reconcile closes.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import crypto from 'node:crypto';
import { prisma } from '@sparx/db';
import { reconcileEmailProvisioning } from '../../src/lib/email-provisioning.js';

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

/** A tenant with email active in settings but NO provisioning run (no route). */
async function makeEmailActiveTenant(): Promise<string> {
  const slug = `eprov-${crypto.randomBytes(5).toString('hex')}`;
  const tenant = await prisma.$transaction(async (tx) => {
    // Owner-context insert: createTestTenant isn't used because we must skip the
    // module route entirely. A direct create runs as the migration/owner role.
    return tx.tenant.create({
      data: {
        slug,
        name: slug,
        email: `${slug}@sparx.test`,
        plan: 'starter',
        status: 'active',
        settings: { modules: { email: { enabled: true } } },
      },
      select: { id: true },
    });
  });
  createdTenants.push(tenant.id);
  return tenant.id;
}

async function defaultKeyCount(tenantId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.builderEmail.count({ where: { propertyId: null, key: { not: null } } });
  });
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  for (const id of createdTenants) {
    await prisma.tenant.delete({ where: { id } }).catch(() => undefined);
  }
});

describe('email provisioning reconcile (backfill)', () => {
  it('provisions the 18 defaults for an email-active tenant that missed activation', async () => {
    const tenantId = await makeEmailActiveTenant();
    expect(await defaultKeyCount(tenantId)).toBe(0);

    const result = await reconcileEmailProvisioning(logger);
    expect(result.acquired).toBe(true);
    // The pass covered at least our tenant (the cross-tenant scan may also pick up
    // other suites' residue — assert a lower bound, not an exact fleet count).
    expect(result.tenants).toBeGreaterThanOrEqual(1);

    expect(await defaultKeyCount(tenantId)).toBe(18);
  });

  it('is idempotent — a second pass provisions nothing new', async () => {
    const tenantId = await makeEmailActiveTenant();
    await reconcileEmailProvisioning(logger);
    expect(await defaultKeyCount(tenantId)).toBe(18);

    await reconcileEmailProvisioning(logger);
    expect(await defaultKeyCount(tenantId)).toBe(18);
  });
});
