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
  // Distinct owning modules across the catalog. A null-module (always-on) seed
  // would need an all-tenants scan — none exist today; warn loudly if one lands
  // so the gap is visible rather than silently skipped.
  const modules = new Set<string>();
  let hasAlwaysOn = false;
  for (const seed of SYSTEM_AUTOMATIONS) {
    if (seed.module === null) hasAlwaysOn = true;
    else modules.add(seed.module);
  }
  if (hasAlwaysOn) {
    logger?.warn(
      {},
      'reconcileSystemSeeds: an always-on (module:null) seed exists, but all-tenant backfill is not implemented — those tenants are seeded only on tenant.created'
    );
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

  return { modules: results, tenantsSeeded };
}
