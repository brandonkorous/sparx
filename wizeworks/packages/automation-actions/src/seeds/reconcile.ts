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
import { upsertSystemAutomation } from '@wizeworks/automation';

import { SYSTEM_AUTOMATIONS, seedSystemAutomations } from './index.js';

export interface ReconcileModuleResult {
  module: string;
  /** Tenants the discovery scan returned. */
  tenants: number;
  /** Automations installed across those tenants. */
  seeded: number;
  /** Tenants whose seeding threw and were stepped over. See the isolation note. */
  skipped: number;
}

export interface ReconcileSummary {
  modules: ReconcileModuleResult[];
  /** Tenants that completed seeding — NOT the number scanned. */
  tenantsSeeded: number;
  /** Tenants stepped over across every module. Non-zero means look at the warns. */
  tenantsSkipped: number;
}

interface ReconcileLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
}

/**
 * Back-fill system automations for every tenant whose owning module is already
 * active. `db` is used ONLY for the cross-tenant discovery scan (the SECURITY
 * DEFINER `find_tenants_with_active_module`); the per-tenant upsert rides
 * `seedSystemAutomations`' own `withTenant` on the default `@wizeworks/db` client
 * (sparx_app — the worker's identity), so every write stays RLS-scoped.
 * Idempotent (upsert by origin+name); safe to run on a daily cadence.
 *
 * ONE TENANT CANNOT SINK THE PASS. Discovery and seeding are separate steps, so a
 * tenant can be deleted in the gap between them — the write then fails on
 * `automations_tenant_id_fkey` and, unisolated, took the whole reconcile down with
 * it: every tenant after it in the scan silently lost its backfill and the CronJob
 * reported a 500. Each tenant is therefore sealed off; a failure is warned, counted
 * in `skipped`, and the pass continues. The count is returned rather than only
 * logged so a run that quietly stepped over half the estate cannot read as success.
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
  let tenantsSkipped = 0;

  for (const module of modules) {
    const rows = await db.$queryRaw<{ tenant_id: string }[]>`
      SELECT tenant_id FROM find_tenants_with_active_module(${module})
    `;
    let seeded = 0;
    let skipped = 0;
    for (const { tenant_id } of rows) {
      try {
        const installed = await seedSystemAutomations({ tenantId: tenant_id }, { module });
        seeded += installed.length;
        tenantsSeeded += 1;
      } catch (err) {
        skipped += 1;
        logger?.warn(
          { module, tenantId: tenant_id, err },
          'reconcile: skipped a tenant whose seeding failed'
        );
      }
    }
    tenantsSkipped += skipped;
    results.push({ module, tenants: rows.length, seeded, skipped });
    logger?.info(
      { module, tenants: rows.length, seeded, skipped },
      'reconciled system seeds for module'
    );
  }

  // Always-on seeds → every tenant. `tenants` is the app-readable dispatch table
  // (the same slug→id lookup the public routes use, no tenant GUC needed), so we can
  // enumerate directly. Idempotent upsert (origin+name), so re-running is a safe
  // no-op; module.activated already installs these forward, this is the backstop for
  // tenants with no seed-owning module active.
  if (alwaysOn.length > 0) {
    const tenants = await db.tenant.findMany({ select: { id: true } });
    let seeded = 0;
    let skipped = 0;
    for (const { id } of tenants) {
      // Sealed off per tenant for the same reason as the module loop above — and
      // this list is EVERY tenant, so it is the more likely of the two to meet one
      // that has just been deleted.
      try {
        for (const seed of alwaysOn) {
          await upsertSystemAutomation({ tenantId: id }, seed.spec);
          seeded += 1;
        }
      } catch (err) {
        skipped += 1;
        logger?.warn({ tenantId: id, err }, 'reconcile: skipped a tenant on the always-on pass');
      }
    }
    tenantsSkipped += skipped;
    results.push({ module: '(always-on)', tenants: tenants.length, seeded, skipped });
    logger?.info({ tenants: tenants.length, seeded, skipped }, 'reconciled always-on system seeds');
  }

  return { modules: results, tenantsSeeded, tenantsSkipped };
}
