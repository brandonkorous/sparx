// seedTenant — the multi-tenant demo composer (docs/104, Wave 6).
//
// Stands up a fully-provisioned demo tenant by replaying the REAL paths a live
// signup + onboarding would take, never bespoke seed shortcuts:
//
//   1. provisionTenant()           — tenant + primary property + `<slug>.sparx.zone`
//      (+ owner user + credential)   subdomain + consent row + a Better-Auth owner
//                                     whose password verifies against live sign-in.
//   2. enable modules              — write settings.modules (the ONE thing that may,
//                                     since here we ARE the user flipping the
//                                     switchboard) + fire `module.activated` on the
//                                     in-process bus so every L2 baseline seeds
//                                     (CRM pipeline/segments, default emails, fallback
//                                     shipping/tax, warehouse, scheduling defaults…).
//   3. installIndustryStarter()    — the chosen vertical's cross-module CONFIG presets.
//   4. installBlueprint()          — an optional LOOK (brand/theme/pages/nav/emails).
//   5. loadSampleData()            — the industry's ACTIVITY pack (catalog, orders,
//                                     reviews, deals, bookings…), into enabled modules.
//
// Composed at the api-rest root because that's the only place that deps every
// module + the starter/blueprint installers (the same acyclic-deps reason
// module-provisioning.ts lives here). Idempotent: re-running finds the tenant by
// slug and re-applies the additive installs (starter = skip-if-present, blueprint
// = 409-guarded, sample data = clear-then-reload). The consumers must already be
// registered in this process (the runner does that) — publishPlatformEvent awaits
// every subscriber, so each module's baseline finishes before the next step.

import { randomUUID } from 'node:crypto';

import {
  auth,
  invalidateModuleCache,
  listEnabledModules,
  provisionTenant,
  type ModuleSlug,
} from '@sparx/auth';

import { publishPlatformEvent } from '@sparx/crm';
import {
  loadSampleData,
  prisma,
  resolveSamplePack,
  withTenant,
  type Prisma,
  type SampleDataCounts,
  type TenantContext,
} from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';

import { findInstall, installBlueprint } from './blueprint-installer.js';
import { installIndustryStarter, type InstallStarterResult } from './industry-starters.js';
import { resolveBlueprintManifest } from './marketplace/resolve.js';

export interface SeedTenantSpec {
  /** Stable, human-readable slug — the tenant is found-or-created by it, so a
   *  re-run is idempotent. Also the `<slug>.sparx.zone` subdomain host. */
  slug: string;
  /** Tenant display name = the primary site's customer-facing name (docs/49). */
  name: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  /** The capability switchboard — the modules this demo tenant runs. */
  modules: ModuleSlug[];
  /** Industry starter slug AND the sample-data pack key (they share the vocabulary). */
  industry: string;
  /** Optional blueprint key for the LOOK. Omit for a bare-chrome demo. */
  blueprintKey?: string;
  /** Load the industry's sample activity pack. Default true. */
  sampleData?: boolean;
}

export type BlueprintOutcome =
  | { status: 'installed'; installId: string }
  | { status: 'already-installed' }
  | { status: 'skipped'; reason: string };

export interface SeedTenantResult {
  slug: string;
  tenantId: string;
  /** false when the tenant already existed (only the additive installs re-ran). */
  created: boolean;
  enabledModules: string[];
  starter: InstallStarterResult;
  blueprint: BlueprintOutcome;
  sample: SampleDataCounts | null;
}

/** The module-flag JSON the live module switchboard writes (settings.modules.<slug>.enabled). */
function moduleFlags(modules: ModuleSlug[]): Record<string, { enabled: boolean }> {
  return Object.fromEntries(modules.map((m) => [m, { enabled: true }]));
}

interface ProvisionedTenant {
  tenantId: string;
  propertyId: string;
  ownerUserId: string;
  created: boolean;
}

/** Reload an already-provisioned demo tenant's ids (owner + primary property). Reads
 *  inside withTenant so the RLS GUC is set — otherwise users/properties (RLS-scoped)
 *  return zero rows and a re-run falsely reports the tenant as half-provisioned. */
async function loadExistingTenant(tenantId: string, slug: string): Promise<ProvisionedTenant> {
  const ids = await withTenant({ tenantId }, async (tx) => {
    const [owner, property] = await Promise.all([
      tx.user.findFirst({ where: { role: 'owner' }, select: { id: true } }),
      tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }),
    ]);
    return { ownerUserId: owner?.id ?? null, propertyId: property?.id ?? null };
  });
  if (!ids.ownerUserId || !ids.propertyId) {
    throw new Error(`Tenant ${slug} exists but is missing its owner/primary property`);
  }
  return {
    tenantId,
    propertyId: ids.propertyId,
    ownerUserId: ids.ownerUserId,
    created: false,
  };
}

/** Find the tenant by slug, or provision a fresh one (tenant + primary property +
 *  subdomain + owner user + credential) through the real signup path. */
async function findOrProvisionTenant(spec: SeedTenantSpec): Promise<ProvisionedTenant> {
  const existing = await prisma.tenant.findUnique({
    where: { slug: spec.slug },
    select: { id: true },
  });
  if (existing) return loadExistingTenant(existing.id, spec.slug);

  // Better Auth's own hasher (scrypt by default) — the exact function its sign-in
  // verifier uses, so the seeded credential logs in against the live flow.
  const authCtx = await auth.$context;
  const passwordHash = await authCtx.password.hash(spec.ownerPassword);

  return prisma.$transaction(async (tx) => {
    const { tenantId, propertyId } = await provisionTenant(tx, {
      slug: spec.slug,
      name: spec.name,
      email: spec.ownerEmail,
    });
    // provisionTenant set app.tenant_id (tx-local) for the FORCE-RLS property insert;
    // it's still set, so the users insert passes its WITH CHECK too.
    const user = await tx.user.create({
      data: {
        tenantId,
        email: spec.ownerEmail,
        name: spec.ownerName,
        role: 'owner',
        emailVerified: true,
      },
      select: { id: true },
    });
    // accounts RLS keys on user_id — set the GUC before the credential insert.
    await tx.$executeRaw`SELECT set_config('app.user_id', ${user.id}::text, true)`;
    await tx.account.create({
      data: {
        userId: user.id,
        providerId: 'credential',
        accountId: user.id,
        password: passwordHash,
      },
    });
    return { tenantId, propertyId, ownerUserId: user.id, created: true };
  });
}

/** Write settings.modules, drop the module cache, and fire `module.activated` on
 *  the in-process bus per module so every L2 baseline consumer seeds itself. */
async function enableModules(tenantId: string, modules: ModuleSlug[]): Promise<string[]> {
  // Read-modify-write settings.modules (jsonb_set no-ops on an absent parent path,
  // the F-01 footgun — see routes/v1/tenant.ts). Merge, never clobber other keys.
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings =
    row?.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};
  const currentModules =
    settings.modules && typeof settings.modules === 'object'
      ? (settings.modules as Record<string, unknown>)
      : {};
  const nextSettings = {
    ...settings,
    modules: { ...currentModules, ...moduleFlags(modules) },
  } as Prisma.InputJsonObject;
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: nextSettings } });
  invalidateModuleCache(tenantId);

  // Fire activation per module. The bundle graph (inventory/invoicing ride free with
  // commerce/b2b) is honored by the consumers via isModuleEnabled, so we announce
  // only the explicitly-written flags — same as the live switchboard.
  for (const slug of modules) {
    await publishPlatformEvent({
      id: randomUUID(),
      topic: 'module.activated',
      tenantId,
      occurredAt: new Date(),
      payload: { module: slug },
    });
  }
  return listEnabledModules(tenantId);
}

/** Install the optional blueprint look — 409-guarded so a re-run is a no-op. Skips
 *  cleanly (with a reason) when no key is given or the catalog has no such bundle. */
async function applyBlueprint(
  spec: SeedTenantSpec,
  tenantId: string,
  propertyId: string,
  ownerUserId: string,
  logger: FastifyBaseLogger
): Promise<BlueprintOutcome> {
  if (!spec.blueprintKey) return { status: 'skipped', reason: 'no blueprintKey' };
  const blueprint = await resolveBlueprintManifest(tenantId, spec.blueprintKey);
  if (!blueprint) {
    return {
      status: 'skipped',
      reason: `blueprint ${spec.blueprintKey} is not in the marketplace catalog`,
    };
  }
  const prior = await findInstall(tenantId, propertyId, blueprint.key);
  if (prior) return { status: 'already-installed' };
  const { installId } = await installBlueprint(
    { tenantId, userId: ownerUserId, propertyId, logger },
    blueprint
  );
  return { status: 'installed', installId };
}

/**
 * Provision a complete demo tenant from a spec. Idempotent by slug.
 */
export async function seedTenant(
  spec: SeedTenantSpec,
  logger: FastifyBaseLogger
): Promise<SeedTenantResult> {
  const { tenantId, propertyId, ownerUserId, created } = await findOrProvisionTenant(spec);
  const ctx: TenantContext = { tenantId, userId: ownerUserId };

  const enabledModules = await enableModules(tenantId, spec.modules);

  // Starter CONFIG first (categories/tax/fitment/pipelines…), then the LOOK, then
  // the ACTIVITY pack — config-before-activity so e.g. the CRM pipeline exists when
  // sample deals land, and the catalog taxonomy exists when sample products land.
  const starter = await installIndustryStarter(ctx, spec.industry);
  const blueprint = await applyBlueprint(spec, tenantId, propertyId, ownerUserId, logger);

  let sample: SampleDataCounts | null = null;
  if (spec.sampleData !== false) {
    const pack = resolveSamplePack(spec.industry);
    if (pack) sample = await loadSampleData(ctx, pack, enabledModules);
  }

  return { slug: spec.slug, tenantId, created, enabledModules, starter, blueprint, sample };
}
