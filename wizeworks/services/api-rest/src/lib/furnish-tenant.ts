// Furnishing an ALREADY-PROVISIONED tenant — the second half of onboarding.
//
// `provisionTenant` / `signUpMerchant` make a tenant EXIST: the row, its primary
// site, a subdomain, the owner, the trial clock. This makes it USABLE: the
// modules switched on and seeded, the trade's config stamped, optionally a site
// look, and a body of realistic sample records so nothing opens empty.
//
// It is the furnishing half of `seedTenant` (which also CREATES the tenant, from
// a slug, for demos). Onboarding already has a real tenant and a real owner, so
// it needs this half only — and pulling it out is what stops the two paths
// drifting into two different definitions of "set up".
//
// ── WHY THIS RUNS IN API-REST AND NOT IN THE APP THAT ONBOARDS ──────────────
//
// Two reasons, and the first is a correctness bug rather than a preference.
//
// 1. `module.activated` travels on TWO buses that reach two different process
//    spaces (see lib/module-toggle.ts): the Pub/Sub topic, consumed by the
//    automation-worker in another process, AND the in-process platform bus,
//    whose subscribers are the ones that seed the CRM pipeline, segments and SLA
//    policies, commerce's tax + shipping + site-commerce defaults, scheduling's
//    defaults, the default transactional emails, finance's accounts, the
//    saved-view presets and invoicing's config. An app that publishes only to
//    the broker gets NONE of that — the flags go true, the topic gets a message,
//    and every one of those baselines silently never happens. Only a process
//    with the consumers registered can announce on both, and `applyModuleWrites`
//    is where that is already done correctly.
//
// 2. The starter installer and the blueprint installer live at this composition
//    root, because they resolve preset + marketplace registries assembled here.
//    They are not importable from an app without dragging the whole closure.
//
// ── THE ORDER IS LOAD-BEARING ───────────────────────────────────────────────
//
// modules → starter (CONFIG) → blueprint (LOOK) → sample data (ACTIVITY).
//
// Config before activity, for the reason `seedTenant` records: the CRM pipeline
// has to exist before sample deals land, and the catalog taxonomy before sample
// products do. `publishPlatformEvent` awaits every subscriber, so by the time
// `applyModuleWrites` returns, the baselines are committed — this sequence is
// deterministic in-process and needs no waiting or polling. Move a step and the
// symptom is silence, not an error: `applyDeals` finds no pipeline and returns
// having written nothing at all.

import { listEnabledModules, type ModuleSlug } from '@wizeworks/auth';
import {
  loadSampleData,
  prisma,
  resolveSamplePack,
  withTenant,
  type SampleDataCounts,
  type TenantContext,
} from '@wizeworks/db';
import type { FastifyBaseLogger } from 'fastify';

import { findInstall, installBlueprint } from './blueprint-installer.js';
import {
  installIndustryStarter,
  starterRegistry,
  type InstallStarterResult,
} from './industry-starters.js';
import { blueprintVisibleTo } from './marketplace/brand-scope.js';
import { resolveBlueprintManifest } from './marketplace/resolve.js';
import { applyModuleWrites, readModuleFlags } from './module-toggle.js';
import { tenantPlatformBrand } from './tenant-brand.js';

export interface FurnishTenantSpec {
  tenantId: string;
  /** Modules to switch on. Already-on modules are skipped, so this is a target
   *  state rather than a diff, and a re-run announces nothing twice. */
  modules: ModuleSlug[];
  /** The trade. Drives BOTH the industry starter and the sample pack — they
   *  share the vocabulary. Null means "not chosen": the starter is skipped and
   *  sample data falls back to the generic set. */
  industry: string | null;
  /** Marketplace blueprint key for the site's LOOK. Omit for no template. */
  blueprintKey?: string;
  /** Load the trade's sample records. Default true. */
  sampleData?: boolean;
  /** False when the caller's plan is FLAT — see ApplyModuleWritesOptions. */
  billPerModule?: boolean;
}

export type BlueprintOutcome =
  | { status: 'installed'; installId: string }
  | { status: 'already-installed' }
  | { status: 'skipped'; reason: string };

export interface FurnishTenantResult {
  tenantId: string;
  enabledModules: string[];
  starter: InstallStarterResult | { status: 'skipped'; reason: string };
  blueprint: BlueprintOutcome;
  sample: SampleDataCounts | null;
}

interface TenantIds {
  propertyId: string;
  ownerUserId: string;
}

/**
 * The owner + primary site, read INSIDE `withTenant`.
 *
 * Both tables are under FORCE row-level security, so a read without
 * `app.tenant_id` set matches zero rows and reports that as an empty result
 * rather than an error — which would look exactly like a tenant that has no
 * owner. Missing ids here are an invariant violation (every tenant gets both at
 * provisioning), so this throws rather than furnishing half a business.
 */
async function loadTenantIds(tenantId: string): Promise<TenantIds> {
  const ids = await withTenant({ tenantId }, async (tx) => {
    const [owner, property] = await Promise.all([
      tx.user.findFirst({ where: { role: 'owner' }, select: { id: true } }),
      tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }),
    ]);
    return { ownerUserId: owner?.id ?? null, propertyId: property?.id ?? null };
  });
  if (!ids.ownerUserId || !ids.propertyId) {
    throw new Error(
      `Cannot furnish tenant ${tenantId}: it has no ${
        ids.ownerUserId ? 'primary site' : 'owner user'
      }. Both are created at provisioning, so this tenant was built by a path that skips one.`
    );
  }
  return { ownerUserId: ids.ownerUserId, propertyId: ids.propertyId };
}

/** Switch on every module in the spec that is not already on, announcing each
 *  transition on BOTH buses. Returns the tenant's effective enabled set. */
async function enableModules(
  log: FastifyBaseLogger,
  spec: FurnishTenantSpec,
  actorId: string
): Promise<string[]> {
  const row = await prisma.tenant.findUnique({
    where: { id: spec.tenantId },
    select: { settings: true },
  });
  const before = readModuleFlags(row?.settings);

  // Only the modules that actually change. `applyModuleWrites` already announces
  // on derived-state transitions rather than raw writes, but handing it a write
  // for something already true makes a re-run look like a fresh activation in
  // the logs for no reason.
  const writes = new Map<ModuleSlug, boolean>();
  for (const slug of spec.modules) {
    if (!before[slug]) writes.set(slug, true);
  }

  await applyModuleWrites(log, spec.tenantId, actorId, row?.settings ?? null, writes, {
    billPerModule: spec.billPerModule ?? true,
  });
  return listEnabledModules(spec.tenantId);
}

/** Install the optional site look. 409-guarded, so a re-run is a no-op, and it
 *  skips with a stated reason rather than throwing when the key is absent or
 *  unknown — a missing template is not a reason to fail a signup. */
async function applyBlueprint(
  spec: FurnishTenantSpec,
  ids: TenantIds,
  logger: FastifyBaseLogger
): Promise<BlueprintOutcome> {
  if (!spec.blueprintKey) return { status: 'skipped', reason: 'no blueprintKey' };

  // The brand gate applies HERE TOO, and not because a caller is untrusted — the
  // token-holder is a first-party app. It applies because the key travels from a
  // BROWSER FORM through that app: whatever the picker offered, what arrives is
  // whatever was posted. Without this, one edited form field installs the other
  // brand's showcase, and the listing filter that hides it becomes decoration.
  const brand = await tenantPlatformBrand(spec.tenantId);
  if (!(await blueprintVisibleTo(spec.blueprintKey, brand))) {
    return {
      status: 'skipped',
      reason: `blueprint ${spec.blueprintKey} is not available to the ${brand} brand`,
    };
  }

  const blueprint = await resolveBlueprintManifest(spec.tenantId, spec.blueprintKey);
  if (!blueprint) {
    return {
      status: 'skipped',
      reason: `blueprint ${spec.blueprintKey} is not in the marketplace catalog`,
    };
  }
  const prior = await findInstall(spec.tenantId, ids.propertyId, blueprint.key);
  if (prior) return { status: 'already-installed' };
  const { installId } = await installBlueprint(
    {
      tenantId: spec.tenantId,
      userId: ids.ownerUserId,
      propertyId: ids.propertyId,
      logger,
    },
    blueprint
  );
  return { status: 'installed', installId };
}

/**
 * Furnish a tenant that already exists. Idempotent: modules already on are not
 * re-announced, the starter's presets are skip-if-present, the blueprint is
 * 409-guarded, and a sample load clears its own prior rows first.
 */
export async function furnishTenant(
  spec: FurnishTenantSpec,
  logger: FastifyBaseLogger
): Promise<FurnishTenantResult> {
  const ids = await loadTenantIds(spec.tenantId);
  const ctx: TenantContext = { tenantId: spec.tenantId, userId: ids.ownerUserId };

  const enabledModules = await enableModules(logger, spec, ids.ownerUserId);

  // Guarded on the REGISTRY, not just on `industry` being set. Not every trade
  // the sample-data engine has a pack for has a starter behind it — `generic` is
  // exactly that case, a real dataset with no vertical config to stamp — and
  // `installIndustryStarter` throws NOT_FOUND on an unknown slug. Calling it
  // unguarded would take down the whole furnish, and therefore the signup, for
  // anyone who picked the catch-all option.
  const starter = !spec.industry
    ? ({ status: 'skipped', reason: 'no industry chosen' } as const)
    : starterRegistry.get(spec.industry)
      ? await installIndustryStarter(ctx, spec.industry)
      : ({ status: 'skipped', reason: `no starter for industry ${spec.industry}` } as const);

  const blueprint = await applyBlueprint(spec, ids, logger);

  let sample: SampleDataCounts | null = null;
  if (spec.sampleData !== false) {
    const pack = resolveSamplePack(spec.industry);
    if (pack) sample = await loadSampleData(ctx, pack, enabledModules);
  }

  return { tenantId: spec.tenantId, enabledModules, starter, blueprint, sample };
}
