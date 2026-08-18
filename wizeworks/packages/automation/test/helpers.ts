// Integration fixtures for @wizeworks/automation.
//
// The engine ticks scan cross-tenant, so they run on a sparx_owner (BYPASSRLS)
// connection — exactly the worker's prod role. We mirror that here with an
// owner client and seed/teardown through it (the `tenants` cascade tears a whole
// test tenant down in one delete).

import crypto from 'node:crypto';

import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import type { Publisher, SparxEvent } from '@wizeworks/events';

import type { EngineDeps, EngineLogger } from '../src/engine-types';
import { _resetTenantStateCache } from '../src/gates/tenant-state';

// Owner (BYPASSRLS locally) — used for SETUP + ASSERTIONS only: creating
// tenants/customers without a GUC, and reading runs/steps back cross-tenant.
export const ownerDb = new PrismaClient({
  datasourceUrl:
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public',
});

// App role (NOBYPASSRLS) — the worker's PROD identity. The ticks must drive
// through THIS so the suite exercises the real RLS boundary: cross-tenant
// discovery only via the SECURITY DEFINER scan helpers, all execution under
// withTenant. A plain cross-tenant findMany here would (correctly) return zero
// rows — which is exactly the prod failure mode the DEFINER functions exist to
// avoid. Local `sparx_owner` is a superuser, so running ticks on `ownerDb`
// would mask that bug; `appDb` does not.
export const appDb = new PrismaClient({
  datasourceUrl:
    process.env.DATABASE_URL ??
    'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public',
});

const noop = (): void => undefined;
export const silentLogger: EngineLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

/** Records emitted events in-memory instead of reaching for Pub/Sub. */
export class CapturingPublisher implements Publisher {
  readonly events: SparxEvent<Record<string, unknown>>[] = [];
  publish<T>(event: SparxEvent<T>): Promise<void> {
    this.events.push(event as unknown as SparxEvent<Record<string, unknown>>);
    return Promise.resolve();
  }
}

export function makeDeps(publisher: Publisher = new CapturingPublisher()): EngineDeps {
  return { publisher, logger: silentLogger };
}

export interface CreateTenantOpts {
  modules?: string[];
  status?: string;
  automationsDisabled?: boolean;
}

export async function createTenant(opts: CreateTenantOpts = {}): Promise<string> {
  const slug = `auto-test-${crypto.randomBytes(5).toString('hex')}`;
  const modules: Record<string, { enabled: boolean }> = {};
  for (const m of opts.modules ?? []) modules[m] = { enabled: true };
  const settings: Record<string, unknown> = { modules };
  if (opts.automationsDisabled) settings.automations = { disabled: true };

  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: `Auto Test ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: opts.status ?? 'active',
      settings: settings as Prisma.InputJsonValue,
    },
  });
  return tenant.id;
}

export async function dropTenant(tenantId: string): Promise<void> {
  _resetTenantStateCache();
  await ownerDb.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
}

/** A site under the tenant. Two of these is the whole point of docs/131 — one
 *  tenant, two unrelated businesses that must never see each other's records. */
export async function seedProperty(tenantId: string, name: string): Promise<string> {
  const p = await ownerDb.property.create({
    data: {
      tenantId,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`,
      name,
    },
    select: { id: true },
  });
  return p.id;
}

export interface SeedCustomerOpts {
  type?: string;
  email?: string;
  totalSpent?: number;
  orderCount?: number;
  lastOrderDaysAgo?: number;
  tags?: string[];
  /** Which site this customer belongs to; omitted = a tenant-level contact. */
  propertyId?: string;
}

/** Insert a customer (owner/BYPASSRLS, no GUC needed). Returns its id. */
export async function seedCustomer(tenantId: string, opts: SeedCustomerOpts = {}): Promise<string> {
  const lastOrderAt =
    opts.lastOrderDaysAgo !== undefined
      ? new Date(Date.now() - opts.lastOrderDaysAgo * 86_400_000)
      : null;
  const c = await ownerDb.customer.create({
    data: {
      tenantId,
      propertyId: opts.propertyId ?? null,
      type: opts.type ?? 'retail',
      email: opts.email ?? `cust-${crypto.randomBytes(3).toString('hex')}@sparx.test`,
      totalSpent: opts.totalSpent ?? 0,
      orderCount: opts.orderCount ?? 0,
      lastOrderAt,
      tags: opts.tags ?? [],
    },
    select: { id: true },
  });
  return c.id;
}

/** Read a run + its steps (owner) for assertions. */
export async function getRun(runId: string) {
  return ownerDb.automationRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { actionIndex: 'asc' } } },
  });
}

export async function runsFor(automationId: string) {
  return ownerDb.automationRun.findMany({
    where: { automationId },
    include: { steps: { orderBy: { actionIndex: 'asc' } } },
  });
}
