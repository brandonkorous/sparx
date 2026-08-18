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
import { type Prisma, prisma } from '@wizeworks/db';
import { DEFAULT_EMAIL_TEMPLATES } from '@wizeworks/builder-schemas';
import { reconcileEmailProvisioning } from '../../src/lib/email-provisioning.js';
// The pre-redesign bodies (welcome-customer, order-confirmation), captured from the
// code they replaced — used to seed a "still the untouched old default" row and prove
// the reconcile re-designs it while leaving an edited row alone.
import oldBodies from './old-email-bodies.fixture.json';

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

// Derived from the catalog, never hardcoded: three templates were added and
// this suite sat red asserting 18 because the number lived in the test rather
// than coming from the thing under test.
const DEFAULT_COUNT = DEFAULT_EMAIL_TEMPLATES.length;

async function defaultKeyCount(tenantId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.builderEmail.count({ where: { propertyId: null, key: { not: null } } });
  });
}

/** Overwrite a tenant-wide default's silica draft+published documents (owner-context,
 *  RLS GUC set) — used to plant an OLD-design body a tenant is still holding. */
async function setSilicaDocs(tenantId: string, key: string, doc: unknown): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.builderEmail.updateMany({
      where: { key, propertyId: null },
      data: {
        silicaDraftDocument: doc as Prisma.InputJsonValue,
        silicaPublishedDocument: doc as Prisma.InputJsonValue,
      },
    });
  });
}

async function publishedDoc(tenantId: string, key: string): Promise<unknown> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const row = await tx.builderEmail.findFirst({
      where: { key, propertyId: null },
      select: { silicaPublishedDocument: true },
    });
    return row?.silicaPublishedDocument ?? null;
  });
}

/** The `align` of the first button node found anywhere in a stored document — the
 *  redesign centres the welcome CTA (`center`), the old default left-aligned it. */
function firstButtonAlign(doc: unknown): string | undefined {
  let found: string | undefined;
  const walk = (n: unknown): void => {
    if (found !== undefined) return;
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>;
      if (o.kind === 'button' && typeof o.align === 'string') {
        found = o.align;
        return;
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(doc);
  return found;
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
  it('provisions every keyed default for an email-active tenant that missed activation', async () => {
    const tenantId = await makeEmailActiveTenant();
    expect(await defaultKeyCount(tenantId)).toBe(0);

    const result = await reconcileEmailProvisioning(logger);
    expect(result.acquired).toBe(true);
    // The pass covered at least our tenant (the cross-tenant scan may also pick up
    // other suites' residue — assert a lower bound, not an exact fleet count).
    expect(result.tenants).toBeGreaterThanOrEqual(1);

    expect(await defaultKeyCount(tenantId)).toBe(DEFAULT_COUNT);
  });

  it('is idempotent — a second pass provisions nothing new', async () => {
    const tenantId = await makeEmailActiveTenant();
    await reconcileEmailProvisioning(logger);
    expect(await defaultKeyCount(tenantId)).toBe(DEFAULT_COUNT);

    await reconcileEmailProvisioning(logger);
    expect(await defaultKeyCount(tenantId)).toBe(DEFAULT_COUNT);
  });

  it('re-designs a still-pristine old default, but never an edited one', async () => {
    const tenantId = await makeEmailActiveTenant();
    await reconcileEmailProvisioning(logger); // provisions the CURRENT-design rows

    // Plant the OLD welcome body verbatim — a tenant provisioned before the redesign.
    await setSilicaDocs(tenantId, 'welcome-customer', oldBodies['welcome-customer']);
    // Plant an EDITED old order body — same base, but the tenant changed a word, so it
    // must be treated as theirs and left untouched.
    const editedOrder = JSON.parse(
      JSON.stringify(oldBodies['order-confirmation']).replace(
        'Your order is confirmed',
        'Your order is confirmed — EDITED-BY-TENANT'
      )
    );
    await setSilicaDocs(tenantId, 'order-confirmation', editedOrder);

    // Sanity: the planted welcome is the old, left-aligned CTA.
    expect(firstButtonAlign(await publishedDoc(tenantId, 'welcome-customer'))).toBe('left');

    await reconcileEmailProvisioning(logger);

    // The pristine old welcome is refreshed to the current design (centred CTA)…
    expect(firstButtonAlign(await publishedDoc(tenantId, 'welcome-customer'))).toBe('center');
    // …and the edited order keeps the tenant's words — never clobbered.
    expect(JSON.stringify(await publishedDoc(tenantId, 'order-confirmation'))).toContain(
      'EDITED-BY-TENANT'
    );
  });
});
