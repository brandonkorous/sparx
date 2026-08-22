// Module-activation provisioning — the in-process consumer + nightly reconcile
// that seed each module's TEMPLATE-AGNOSTIC defaults when it activates (docs/104
// L2). This is the sibling of email-provisioning.ts: it kept the dependency graph
// acyclic by living in api-rest (the composition root) rather than inside any one
// domain package, so it can call @wizeworks/commerce, @wizeworks/inventory, the chat lib,
// and the b2b default in one place.
//
// Coverage (the docs/104 §5.A gaps the established consumers didn't already fill —
// CRM pipeline/segments, default emails, system automations, and invoicing
// workflows/line-types each seed elsewhere):
//
//   commerce  → CommerceSiteSettings (primary site) + fallback shipping
//               zone/profile/rate + an inactive home tax-nexus zone (no rates),
//               + a default operating warehouse (inventory rides free with
//               commerce).
//   inventory → a default operating warehouse (standalone WMS path).
//   b2b       → a default (inactive) tenant-wide purchase-approval rule, + a
//               default warehouse (inventory rides free with b2b), + the
//               system b2b-quotes BillingDocument workflow (quotes are
//               BillingDocuments — the retired Quote model's consolidation).
//   chat      → a starter bank of quick replies.
//
// Separately, SAVED-VIEW PRESETS (docs/104 §5.A item 5) — a tenant-wide starter
// set of named list filters (e.g. "Overdue invoices", "Abandoned carts") — seed
// for every preset-bearing module the tenant has active on ANY activation, and in
// the reconcile. This is platform list-state (a sibling of saved-views.ts), not a
// per-module default, so it lives here at the composition root rather than in any
// one domain consumer. It is bundle-aware: `invoicing` presets seed for any
// Commerce/B2B tenant even though that tenant never writes the `invoicing` flag.
//
// Every bootstrap is find-or-create (a tenant's edits survive) and rows are kept
// on deactivate, so a re-activation or a redelivered event is a safe no-op
// (docs/104 R1–R4). The platform bus awaits every subscriber, so seeding finishes
// before the module-toggle route returns — no separate /bootstrap round-trip.

import { ADVISORY_LOCKS, withAdvisoryTickLock } from '@wizeworks/db';
import { isModuleEnabled, type ModuleSlug } from '@wizeworks/auth';
import { commerceSiteService, taxService } from '@wizeworks/commerce';
import {
  b2bQuoteService,
  documentLineTypeService,
  documentWorkflowService,
  getPlatformBus,
  type PlatformEvent,
} from '@wizeworks/crm';
import { prisma } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';
import { bootstrapSchedulingDefaults } from '@wizeworks/scheduling';
import type { FastifyBaseLogger } from 'fastify';

import { bootstrapDefaultApprovalRule } from './b2b-defaults.js';
import { quickReplyService } from './chat/index.js';
import { bootstrapSavedViewPresets, SAVED_VIEW_PRESET_MODULES } from './saved-view-presets.js';

/** The modules whose activation this provisioner seeds defaults for. */
const PROVISIONED_MODULES = ['commerce', 'inventory', 'b2b', 'chat', 'scheduling'] as const;
type ProvisionedModule = (typeof PROVISIONED_MODULES)[number];
const PROVISIONED_SET = new Set<string>(PROVISIONED_MODULES);

/** Modules that carry a saved-view preset catalog (a superset of PROVISIONED —
 *  e.g. crm/cms/invoicing have presets but no other L2 default seeder here). */
const PRESET_MODULE_SET = new Set<string>(SAVED_VIEW_PRESET_MODULES);

/** Seed the saved-view presets for every preset-bearing module a tenant currently
 *  has active. Bundle-aware via `isModuleEnabled` — so a Commerce/B2B tenant gets
 *  the `invoicing` presets even though its `invoicing` flag is never written. Each
 *  bootstrap is idempotent find-or-create, so running across all preset modules on
 *  every relevant activation (and in reconcile) is a safe, self-healing no-op. */
async function provisionSavedViewPresets(tenantId: string): Promise<void> {
  const ctx = { tenantId, userId: undefined };
  for (const module of SAVED_VIEW_PRESET_MODULES) {
    if (await isModuleEnabled(tenantId, module as ModuleSlug)) {
      await bootstrapSavedViewPresets(ctx, module);
    }
  }
}

/** Seed the invoicing document workflows + line-type registry for a tenant that has
 *  the `invoicing` module active. Bundle-aware via `isModuleEnabled` — invoicing
 *  rides free with Commerce/B2B, so those tenants never write the `invoicing` flag
 *  yet must still get a workflow to hang a BillingDocument on (docs/87 §3). Without
 *  this the CRM activation consumer only seeds it on EXPLICIT invoicing activation,
 *  leaving every bundled Commerce/B2B tenant with an empty, unusable invoicing
 *  surface. Both bootstraps are slug/key-keyed find-or-create, so re-running on
 *  every relevant activation (and in reconcile) is a safe, self-healing no-op. */
async function provisionInvoicingDefaults(tenantId: string): Promise<void> {
  if (!(await isModuleEnabled(tenantId, 'invoicing'))) return;
  const ctx = { tenantId, userId: undefined };
  await documentWorkflowService.bootstrapDefaultWorkflows(ctx);
  await documentLineTypeService.bootstrapDefaultLineTypes(ctx);
}

/** Run a single module's default seeders for one tenant. Shared by the forward
 *  consumer and the reconcile pass so both stay in lockstep. Each bootstrap is
 *  idempotent; the warehouse seeds whenever inventory is active (explicit OR
 *  bundled free with commerce/b2b — `isModuleEnabled` honors the bundle graph). */
async function provisionForModule(tenantId: string, slug: ProvisionedModule): Promise<void> {
  const ctx = { tenantId, userId: undefined };
  switch (slug) {
    case 'commerce': {
      if (await isModuleEnabled(tenantId, 'inventory')) {
        await inventoryService.bootstrapDefaultWarehouse(ctx);
      }
      await commerceSiteService.bootstrapDefaults(ctx);
      // NO shipping bootstrap. Seeding an "Everywhere" zone here bought a
      // working checkout by inventing a delivery the business had never
      // offered — worldwide postage, flat $5, for a bakery that sells over the
      // counter (issue #031). A tenant with no zones now quotes "collect in
      // person" instead, which is true of every shop and promises nothing.
      await taxService.bootstrapDefaults(ctx);
      break;
    }
    case 'inventory': {
      await inventoryService.bootstrapDefaultWarehouse(ctx);
      break;
    }
    case 'b2b': {
      if (await isModuleEnabled(tenantId, 'inventory')) {
        await inventoryService.bootstrapDefaultWarehouse(ctx);
      }
      await bootstrapDefaultApprovalRule(ctx);
      // Quotes are BillingDocuments on the system b2b-quotes workflow — a tenant
      // should see + be able to customize it immediately (unlike net-terms-ar,
      // which stays a hidden substrate).
      await b2bQuoteService.bootstrapB2bQuoteWorkflow(ctx);
      break;
    }
    case 'chat': {
      await quickReplyService.bootstrapDefaults(ctx);
      break;
    }
    case 'scheduling': {
      await bootstrapSchedulingDefaults(tenantId);
      break;
    }
  }
}

/** Subscribe the provisioner to `module.activated` on the in-process platform bus
 *  (the same bus the CRM + email activation consumers ride). Returns the
 *  unsubscribe handle. publishPlatformEvent awaits every subscriber, so the seed
 *  completes before the tenant-module route returns. */
export function registerModuleProvisioningConsumer(): () => void {
  const bus = getPlatformBus();
  return bus.subscribe('module.activated', async (event: PlatformEvent) => {
    const slug = (event.payload as { module?: string } | null)?.module;
    if (!slug) return;
    if (PROVISIONED_SET.has(slug)) {
      await provisionForModule(event.tenantId, slug as ProvisionedModule);
    }
    // Saved-view presets aren't a per-module default seeder — they're platform
    // list-state. Seed them whenever a preset-bearing module (or a bundler of
    // one, all of which are themselves preset modules) activates; the helper is
    // bundle-aware, so activating Commerce/B2B also seeds the invoicing presets.
    if (PRESET_MODULE_SET.has(slug)) {
      await provisionSavedViewPresets(event.tenantId);
      // Invoicing config (workflows + line types) rides the same bundle-aware
      // trigger — a Commerce/B2B activation must seed it even though the tenant
      // never writes the `invoicing` flag.
      await provisionInvoicingDefaults(event.tenantId);
    }
  });
}

// ─── nightly reconcile (docs/104 §5.A — mirrors email-provisioning) ──────────
//
// The consumer above seeds FORWARD, on `module.activated`. A tenant whose module
// was active before this shipped — or whose activation event was dropped — would
// hold none of these defaults. This pass self-heals that gap: it discovers each
// module's active tenants via the SAME `find_tenants_with_active_module` SECURITY
// DEFINER scan the email/automation reconciles use, and idempotently re-seeds.

const RECONCILE_LOCK_KEY = ADVISORY_LOCKS.MODULE_PROVISIONING_RECONCILE;
const RECONCILE_INTERVAL_MS = 6 * 60 * 60_000; // every 6h — activation covers the common path

export interface ModuleProvisioningReconcileResult {
  acquired: boolean;
  tenants: number;
}

/**
 * Back-fill every provisioned module's defaults for every tenant on which that
 * module is active. Singleton across pods via a Postgres advisory lock (distinct
 * key from the other api-rest ticks). Per-tenant failures are logged and skipped
 * so one tenant never aborts the fleet pass.
 */
export async function reconcileModuleProvisioning(
  logger: FastifyBaseLogger
): Promise<ModuleProvisioningReconcileResult> {
  const SKIPPED: ModuleProvisioningReconcileResult = { acquired: false, tenants: 0 };
  return withAdvisoryTickLock(RECONCILE_LOCK_KEY, SKIPPED, async () => {
    let tenantsTouched = 0;
    for (const slug of PROVISIONED_MODULES) {
      const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
        SELECT tenant_id FROM find_tenants_with_active_module(${slug})
      `;
      for (const { tenant_id } of rows) {
        try {
          await provisionForModule(tenant_id, slug);
          tenantsTouched += 1;
        } catch (err) {
          logger.error(
            { err, tenantId: tenant_id, slug },
            'module-provisioning-reconcile: tenant failed'
          );
        }
      }
    }

    // Saved-view presets self-heal: union every tenant with any preset-bearing
    // module active, then seed bundle-aware per tenant (one pass covers a tenant's
    // whole preset set, incl. invoicing on Commerce/B2B tenants whose `invoicing`
    // flag is never written, so the per-module scan can't see it directly).
    const presetTenants = new Set<string>();
    for (const slug of SAVED_VIEW_PRESET_MODULES) {
      const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
        SELECT tenant_id FROM find_tenants_with_active_module(${slug})
      `;
      for (const { tenant_id } of rows) presetTenants.add(tenant_id);
    }
    for (const tenantId of presetTenants) {
      try {
        await provisionSavedViewPresets(tenantId);
        await provisionInvoicingDefaults(tenantId);
      } catch (err) {
        logger.error({ err, tenantId }, 'module-provisioning-reconcile: preset/invoicing failed');
      }
    }

    return { acquired: true, tenants: tenantsTouched };
  });
}

/** Drive reconcileModuleProvisioning on an interval. Mirrors the email
 *  provisioning loop (self-rescheduling setTimeout, stop handle). The first pass
 *  fires one interval after boot — activation provisioning covers the common
 *  path. */
export function startModuleProvisioningReconcileLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = RECONCILE_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await reconcileModuleProvisioning(logger);
    } catch (err) {
      logger.error({ err }, 'module-provisioning-reconcile: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'module-provisioning-reconcile: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('module-provisioning-reconcile: loop stopped');
  };
}
