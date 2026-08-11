// Blueprint slice backfill — materialize an installed blueprint's per-module content
// when a tenant enables that module AFTER the install (theming-spine Phase 3, the
// "Template ⊥ modules" backfill). It is the companion to golden-blueprint-provisioning:
// golden installs onto every new tenant, but a new tenant has ZERO modules on, so the
// installer (which gates each slice on the enabled modules) writes almost nothing. When
// the tenant later turns commerce/cms/email/builder on, THIS wires the golden (or their
// chosen) blueprint's corresponding slice into the existing install.
//
// WHY NOT the blueprint UPDATER. `applyUpdate` is a three-way MERGE for artifacts that
// already have a live row. At install, the SKIPPED slices are still baseline-captured
// with `refId = null`, so the updater sees them as EXISTING (not "new upstream"), routes
// them through handlers that early-return on the null refId, and classifies every one as
// `tenant_deleted` — creating nothing. So the updater structurally cannot backfill; the
// only thing that can is re-running the installer's own slice logic. That is exactly what
// the extracted install*Slice helpers are for (blueprint-installer.ts).
//
// TWO mechanisms, same backfill (mirrors module-provisioning.ts):
//   · FORWARD: an in-process consumer of `module.activated` on getPlatformBus() — the
//     same bus the module route publishes on and AWAITS, so the slice lands before the
//     toggle returns. Errors are caught (a backfill failure must not fail the toggle; the
//     module IS enabled either way) and left to the reconcile.
//   · RECONCILE: an advisory-lock singleton that, per blueprint-relevant module, scans
//     its active tenants (the existing find_tenants_with_active_module) and backfills any
//     whose install hasn't materialized that slice — covering tenants that enabled a
//     module before this shipped and any dropped event. No new SQL function needed.
//
// The GATE is coarse + per-module: run a module's slice only if the install's stored
// id-map shows that module UN-materialized (no products / no content / no pages / no
// emails). That single check makes install and every backfill path mutually exclusive
// and idempotent — a re-activation or a blanket reconcile re-run is a no-op — without
// per-artifact dedup. After running, the stored `result` is persisted and the WHOLE
// baseline set re-captured, so the just-materialized rows carry real refIds (not the
// install-time nulls) and a future blueprint UPDATE can three-way-merge them.

import type { FastifyBaseLogger } from 'fastify';
import type { Blueprint } from '@sparx/blueprints';
import type { ModuleSlug } from '@sparx/auth';
import { getPlatformBus, type PlatformEvent } from '@sparx/crm';
import { ADVISORY_LOCKS, prisma, withAdvisoryTickLock, withTenant } from '@sparx/db';
import type { Prisma } from '@sparx/db';

import { captureBaselines, resolveBlueprintArtifacts } from './blueprint-baseline.js';
import {
  installCommerceSlice,
  installContentSlice,
  installEmailSlice,
  installSchedulingSlice,
  installSiteSlice,
  type InstallResult,
  type SliceEnv,
} from './blueprint-installer.js';
import { resolveBlueprintManifest } from './marketplace/resolve.js';
import { resolvePrimaryPropertyId } from './property.js';

/** The blueprint-bearing modules and, per module, whether the install already
 *  materialized its slice + the slice helper to run. crm/b2b/inventory/etc. carry no
 *  blueprint content (their template-agnostic defaults seed in module-provisioning.ts),
 *  so they are absent here and backfill is a no-op for them. */
interface SliceSpec {
  isMaterialized(result: InstallResult): boolean;
  run(env: SliceEnv): Promise<void>;
}
const MODULE_SLICE: Partial<Record<ModuleSlug, SliceSpec>> = {
  commerce: {
    isMaterialized: (r) =>
      r.products.length > 0 ||
      Object.keys(r.categories).length > 0 ||
      Object.keys(r.collections).length > 0,
    run: installCommerceSlice,
  },
  cms: { isMaterialized: (r) => r.content.length > 0, run: installContentSlice },
  builder: { isMaterialized: (r) => r.pages.length > 0, run: installSiteSlice },
  email: { isMaterialized: (r) => r.emails.length > 0, run: installEmailSlice },
  scheduling: {
    isMaterialized: (r) => (r.scheduling?.services.length ?? 0) > 0,
    run: installSchedulingSlice,
  },
};
const BACKFILL_MODULES = Object.keys(MODULE_SLICE) as ModuleSlug[];

/** Build the slice env from a STORED install's id-map. The assetMap is seeded from
 *  `result.assets` (assets install unconditionally at golden time, so they already
 *  exist), which is what lets the slice's `asset()` resolve without re-running the
 *  assets slice. Runs as the system actor (userId null). */
function buildEnv(
  tenantId: string,
  propertyId: string,
  blueprint: Blueprint,
  result: InstallResult
): SliceEnv {
  const assetMap = new Map<string, string>(Object.entries(result.assets ?? {}));
  return {
    ctx: { tenantId, userId: undefined },
    propCtx: { tenantId, userId: undefined, propertyId },
    tenantId,
    userId: null,
    propertyId,
    blueprint,
    result,
    assetMap,
    asset: (id?: string) => (id ? assetMap.get(id) : undefined),
  };
}

export type BackfillOutcome =
  | { backfilled: true; installId: string }
  | {
      backfilled: false;
      reason: 'not-a-content-module' | 'no-install' | 'already-materialized';
    };

/**
 * Materialize `module`'s blueprint slice on a tenant's primary-property install, unless
 * it is already there. Shared by the forward consumer and the reconcile pass.
 *
 * Throws (for redelivery / reconcile retry) only when the catalog can't yet resolve the
 * installed blueprint — the boot window before selfRegisterFirstPartyCatalog, same as
 * golden-blueprint-provisioning.
 */
export async function backfillInstallForModule(
  tenantId: string,
  module: ModuleSlug,
  logger: FastifyBaseLogger
): Promise<BackfillOutcome> {
  const spec = MODULE_SLICE[module];
  if (!spec) return { backfilled: false, reason: 'not-a-content-module' };

  const propertyId = await resolvePrimaryPropertyId(tenantId);
  const install = await withTenant({ tenantId }, (tx) =>
    tx.tenantBlueprintInstall.findFirst({
      where: { propertyId, status: { in: ['installed', 'live'] } },
      select: { id: true, blueprintKey: true, blueprintVersion: true, result: true },
    })
  );
  // No install yet → nothing to backfill; golden-blueprint-provisioning installs first,
  // and its own event/reconcile will have run the newly-enabled slice at install time.
  if (!install) return { backfilled: false, reason: 'no-install' };

  const result = install.result as unknown as InstallResult;
  if (spec.isMaterialized(result)) return { backfilled: false, reason: 'already-materialized' };

  const blueprint = await resolveBlueprintManifest(tenantId, install.blueprintKey);
  if (!blueprint) {
    throw new Error(
      `blueprint-backfill: catalog has no "${install.blueprintKey}" blueprint for tenant ${tenantId}`
    );
  }

  const env = buildEnv(tenantId, propertyId, blueprint, result);
  await spec.run(env);

  // Persist the merged id-map, then re-capture the WHOLE artifact baseline set: the
  // just-materialized module's rows now carry real refIds (they were null at install),
  // which is what lets a future blueprint UPDATE three-way-merge instead of false-
  // conflicting. Other modules' rows re-capture to the same null they held — harmless.
  await withTenant(env.ctx, (tx) =>
    tx.tenantBlueprintInstall.update({
      where: { id: install.id },
      data: { result: env.result as unknown as Prisma.InputJsonValue },
    })
  );
  await captureBaselines(
    env.ctx,
    install.id,
    install.blueprintVersion,
    resolveBlueprintArtifacts(blueprint, env.result, env.assetMap)
  );

  logger.info(
    { tenantId, propertyId, module, installId: install.id },
    'blueprint-backfill: materialized module slice'
  );
  return { backfilled: true, installId: install.id };
}

/** Subscribe to `module.activated` on the in-process platform bus and backfill the
 *  install's slice for the activated module. Errors are caught + logged, never rethrown:
 *  a backfill failure must not fail the module toggle (the module is enabled regardless),
 *  and the reconcile retries. Returns the unsubscribe handle. */
export function registerBlueprintBackfillConsumer(logger: FastifyBaseLogger): () => void {
  const bus = getPlatformBus();
  return bus.subscribe('module.activated', async (event: PlatformEvent) => {
    const slug = (event.payload as { module?: string } | null)?.module;
    if (!slug || !(slug in MODULE_SLICE)) return;
    try {
      await backfillInstallForModule(event.tenantId, slug as ModuleSlug, logger);
    } catch (err) {
      logger.error(
        { err, tenantId: event.tenantId, module: slug },
        'blueprint-backfill: forward failed — reconcile will retry'
      );
    }
  });
}

// ─── reconcile (self-heal) ───────────────────────────────────────────────────────

const RECONCILE_LOCK_KEY = ADVISORY_LOCKS.BLUEPRINT_BACKFILL_RECONCILE;
const RECONCILE_INTERVAL_MS = 6 * 60 * 60_000; // every 6h — the forward consumer covers the common path

export interface BlueprintBackfillReconcileResult {
  acquired: boolean;
  backfilled: number;
}

/**
 * Back-fill every blueprint-relevant module's slice for every tenant on which that module
 * is active but the install hasn't materialized it. Discovers active tenants via the SAME
 * find_tenants_with_active_module scan the module/email reconciles use — no new SQL.
 * Singleton across pods via a Postgres advisory lock. Per-tenant failures are logged and
 * skipped so one tenant never aborts the fleet pass.
 */
export async function reconcileBlueprintBackfill(
  logger: FastifyBaseLogger
): Promise<BlueprintBackfillReconcileResult> {
  const SKIPPED: BlueprintBackfillReconcileResult = { acquired: false, backfilled: 0 };
  return withAdvisoryTickLock(RECONCILE_LOCK_KEY, SKIPPED, async () => {
    let backfilled = 0;
    for (const module of BACKFILL_MODULES) {
      const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
        SELECT tenant_id FROM find_tenants_with_active_module(${module})
      `;
      for (const { tenant_id } of rows) {
        try {
          const outcome = await backfillInstallForModule(tenant_id, module, logger);
          if (outcome.backfilled) backfilled += 1;
        } catch (err) {
          logger.error(
            { err, tenantId: tenant_id, module },
            'blueprint-backfill-reconcile: tenant failed'
          );
        }
      }
    }
    return { acquired: true, backfilled };
  });
}

/** Drive reconcileBlueprintBackfill on an interval. Mirrors the module/email provisioning
 *  loops (self-rescheduling setTimeout, stop handle). First pass fires one interval after
 *  boot — the forward consumer covers the common path. */
export function startBlueprintBackfillReconcileLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = RECONCILE_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await reconcileBlueprintBackfill(logger);
    } catch (err) {
      logger.error({ err }, 'blueprint-backfill-reconcile: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'blueprint-backfill-reconcile: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('blueprint-backfill-reconcile: loop stopped');
  };
}
