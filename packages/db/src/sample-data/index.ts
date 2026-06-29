// Sample data — public API + pack registry (docs/104, Wave 5).
//
// One implementation, two callers: the dev/e2e seed (this package) and the
// production load/clear seam (services/api-rest/src/lib/sample-data.ts) both
// import these. A load runs in ONE tenant-scoped transaction (atomic), clears any
// prior sample rows first (idempotent), then applies every slice in dependency
// order — gated on the ENABLED module set the caller passes (invariant #2; a pack
// never writes settings.modules — invariant #1).

import { withTenant, type TenantContext } from '../tenant-context';

import { applyCatalog } from './engine/catalog';
import { applyProductImages } from './engine/media';
import { applyInventory } from './engine/inventory';
import { applyCustomers, applyOrders } from './engine/commerce-activity';
import { applyReviews } from './engine/reviews';
import { applyContent } from './engine/content';
import { applyScheduling } from './engine/scheduling';
import { applyQuotes, applyDeals } from './engine/sales';
import { applyBundlesAndConfigurator } from './engine/bundles';
import { applyAi } from './engine/ai';
import { clearSampleDataOnTx } from './engine/clear';
import { countsTotal, summarizeSampleDataOnTx } from './engine/summarize';
import { type ApplyCtx, emptyCounts } from './engine/context';
import type { SampleDataCounts, SampleDataPack, SampleDataStatus } from './types';

import { autoPartsPack } from './packs/auto-parts';
import { apparelPack } from './packs/apparel';
import { foodPack } from './packs/food';
import { electronicsPack } from './packs/electronics';
import { salonPack } from './packs/salon';
import { fitnessPack } from './packs/fitness';
import { professionalPack } from './packs/professional';
import { wholesalePack } from './packs/wholesale';
import { genericPack } from './packs/generic';

export * from './types';
export { countsTotal } from './engine/summarize';

/** Every industry pack, keyed by `settings.industry`. */
export const SAMPLE_DATA_PACKS: Record<string, SampleDataPack> = {
  [autoPartsPack.industry]: autoPartsPack,
  [apparelPack.industry]: apparelPack,
  [foodPack.industry]: foodPack,
  [electronicsPack.industry]: electronicsPack,
  [salonPack.industry]: salonPack,
  [fitnessPack.industry]: fitnessPack,
  [professionalPack.industry]: professionalPack,
  [wholesalePack.industry]: wholesalePack,
  [genericPack.industry]: genericPack,
};

export const GENERIC_INDUSTRY = 'generic';

/** The pack for an industry, or undefined if none authored yet. */
export function getSamplePack(industry: string | null | undefined): SampleDataPack | undefined {
  if (!industry) return undefined;
  return SAMPLE_DATA_PACKS[industry];
}

/** The pack to load for a tenant — its industry's pack, falling back to generic. */
export function resolveSamplePack(industry: string | null | undefined): SampleDataPack | undefined {
  return getSamplePack(industry) ?? SAMPLE_DATA_PACKS[GENERIC_INDUSTRY];
}

/** Which modules a pack provisions into (used to show "what loads" + filter to the
 *  tenant's enabled set). */
export function packModules(pack: SampleDataPack): string[] {
  const mods = new Set<string>();
  if (pack.products.length) mods.add('commerce');
  if (pack.warehouses?.length) mods.add('inventory');
  if (pack.personas.length) mods.add('crm');
  if (pack.articles?.length) mods.add('cms');
  if (pack.scheduling) mods.add('scheduling');
  if (pack.personas.some((p) => p.kind === 'b2b')) mods.add('b2b');
  return [...mods];
}

function buildCtx(
  tx: ApplyCtx['tx'],
  ctx: TenantContext,
  ownerUserId: string | null,
  propertyId: string | null,
  enabledModules: string[]
): ApplyCtx {
  const set = new Set(enabledModules);
  return {
    tx,
    tenantId: ctx.tenantId,
    userId: ctx.userId ?? null,
    ownerUserId,
    isOn: (m) => set.has(m),
    propertyId,
    now: Date.now(),
    productIdByKey: new Map(),
    variantsByKey: new Map(),
    variantOrder: [],
    warehouseIdByKey: new Map(),
    categoryIdByKey: new Map(),
    collectionIdByKey: new Map(),
    customerIdByPersona: new Map(),
    serviceIdByKey: new Map(),
    resourceIdByKey: new Map(),
    counts: emptyCounts(),
  };
}

async function applyPack(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  await applyCatalog(ctx, pack);
  await applyProductImages(ctx, pack);
  await applyInventory(ctx, pack);
  if (ctx.isOn('commerce') || ctx.isOn('crm') || ctx.isOn('scheduling') || ctx.isOn('b2b')) {
    await applyCustomers(ctx, pack);
  }
  await applyOrders(ctx, pack);
  await applyReviews(ctx, pack);
  await applyContent(ctx, pack);
  await applyScheduling(ctx, pack);
  await applyQuotes(ctx, pack);
  await applyDeals(ctx, pack);
  await applyBundlesAndConfigurator(ctx, pack);
  await applyAi(ctx, pack);
}

/**
 * Load a pack into a tenant. Clears prior sample rows first (idempotent), then
 * provisions into the enabled modules only. Returns the per-entity counts created.
 * Runs in one tenant-scoped transaction — a failure rolls the whole load back.
 */
export async function loadSampleData(
  ctx: TenantContext,
  pack: SampleDataPack,
  enabledModules: string[]
): Promise<SampleDataCounts> {
  return withTenant(ctx, async (tx) => {
    const [owner, property] = await Promise.all([
      tx.user.findFirst({ where: { role: 'owner' }, select: { id: true } }),
      tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }),
    ]);
    const applyCtx = buildCtx(tx, ctx, owner?.id ?? null, property?.id ?? null, enabledModules);
    await clearSampleDataOnTx(tx, ctx.tenantId);
    await applyPack(applyCtx, pack);
    return applyCtx.counts;
  });
}

/** Remove every sample row for a tenant. Returns the counts removed (snapshot
 *  taken before the delete) so the caller can report what was cleared. */
export async function clearSampleData(ctx: TenantContext): Promise<SampleDataCounts> {
  return withTenant(ctx, async (tx) => {
    const counts = await summarizeSampleDataOnTx(tx, ctx.tenantId);
    await clearSampleDataOnTx(tx, ctx.tenantId);
    return counts;
  });
}

/** The tenant's sample-data status: which pack applies, what's loaded, counts. */
export async function sampleDataStatus(
  ctx: TenantContext,
  industry: string | null,
  enabledModules: string[]
): Promise<SampleDataStatus> {
  const pack = resolveSamplePack(industry);
  const counts = await withTenant(ctx, (tx) => summarizeSampleDataOnTx(tx, ctx.tenantId));
  const set = new Set(enabledModules);
  return {
    industry: industry ?? null,
    packIndustry: pack?.industry ?? GENERIC_INDUSTRY,
    packLabel: pack?.label ?? 'Generic',
    packSummary: pack?.summary ?? '',
    modules: pack ? packModules(pack).filter((m) => set.has(m)) : [],
    loaded: countsTotal(counts) > 0,
    counts,
  };
}
