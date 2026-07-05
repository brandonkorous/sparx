// System-automation seed RECONCILE / backfill (docs/84 Slice F2 backfill).
//
// Slice E seeds a module's system automations on the `module.activated` event —
// it fires FORWARD only. Tenants whose modules were already active before the
// engine shipped never got that event, so they hold no `automations` rows (their
// dunning ladder etc. is unprotected). This reconcile pass closes that gap and
// self-heals any dropped activation event: for each module that owns a system
// seed, it discovers the module-active tenants via the
// `find_tenants_with_active_module` SECURITY DEFINER scan and idempotently
// re-seeds each. The automation-worker drives it daily (Cloud Scheduler →
// POST /internal/cron/reconcile-seeds).

import type { PrismaClient } from '@prisma/client';
import { upsertSystemAutomation } from '@sparx/automation';

import { SYSTEM_AUTOMATIONS, seedSystemAutomations } from './index.js';

export interface ReconcileModuleResult {
  module: string;
  tenants: number;
  seeded: number;
}

export interface ReconcileSummary {
  modules: ReconcileModuleResult[];
  tenantsSeeded: number;
}

interface ReconcileLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
}

/**
 * Back-fill system automations for every tenant whose owning module is already
 * active. `db` is used ONLY for the cross-tenant discovery scan (the SECURITY
 * DEFINER `find_tenants_with_active_module`); the per-tenant upsert rides
 * `seedSystemAutomations`' own `withTenant` on the default `@sparx/db` client
 * (sparx_app — the worker's identity), so every write stays RLS-scoped.
 * Idempotent (upsert by origin+name); safe to run on a daily cadence.
 */
export async function reconcileSystemSeeds(
  db: PrismaClient,
  logger?: ReconcileLogger
): Promise<ReconcileSummary> {
  // Split the catalog into module-owned seeds (scanned per active module) and
  // always-on (module:null) seeds (installed for EVERY tenant — a form-handling
  // default isn't owned by a feature module).
  const modules = new Set<string>();
  const alwaysOn = SYSTEM_AUTOMATIONS.filter((s) => s.module === null);
  for (const seed of SYSTEM_AUTOMATIONS) {
    if (seed.module !== null) modules.add(seed.module);
  }

  const results: ReconcileModuleResult[] = [];
  let tenantsSeeded = 0;

  for (const module of modules) {
    const rows = await db.$queryRaw<{ tenant_id: string }[]>`
      SELECT tenant_id FROM find_tenants_with_active_module(${module})
    `;
    let seeded = 0;
    for (const { tenant_id } of rows) {
      const installed = await seedSystemAutomations({ tenantId: tenant_id }, { module });
      seeded += installed.length;
    }
    tenantsSeeded += rows.length;
    results.push({ module, tenants: rows.length, seeded });
    logger?.info({ module, tenants: rows.length, seeded }, 'reconciled system seeds for module');
  }

  // Always-on seeds → every tenant. `tenants` is the app-readable dispatch table
  // (the same slug→id lookup the public routes use, no tenant GUC needed), so we can
  // enumerate directly. Idempotent upsert (origin+name), so re-running is a safe
  // no-op; module.activated already installs these forward, this is the backstop for
  // tenants with no seed-owning module active.
  if (alwaysOn.length > 0) {
    const tenants = await db.tenant.findMany({ select: { id: true } });
    let seeded = 0;
    for (const { id } of tenants) {
      for (const seed of alwaysOn) {
        await upsertSystemAutomation({ tenantId: id }, seed.spec);
        seeded += 1;
      }
    }
    results.push({ module: '(always-on)', tenants: tenants.length, seeded });
    logger?.info({ tenants: tenants.length, seeded }, 'reconciled always-on system seeds');
  }

  return { modules: results, tenantsSeeded };
}
