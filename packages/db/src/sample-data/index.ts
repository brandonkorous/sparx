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
import { applyInvoicing } from './engine/invoicing';
import { applyBundlesAndConfigurator } from './engine/bundles';
import { applyAi } from './engine/ai';
import { applyRecordTypes } from './engine/record-types';
import { hasPhysicalGoods, withFallbacks } from './engine/fallbacks';
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
  if (pack.personas.length) mods.add('crm');
  if (pack.articles?.length) mods.add('cms');
  // Inventory: authored warehouses OR any physical goods (the engine falls back to a
  // default stock location). Services/digital-only packs have nothing to stock.
  if (pack.warehouses?.length || hasPhysicalGoods(pack)) mods.add('inventory');
  // Scheduling + B2B are module-complete via engine fallbacks — any tenant with the
  // module on gets a baseline dataset regardless of what the vertical authored.
  mods.add('scheduling');
  mods.add('b2b');
  // Invoicing rides free with commerce/b2b and seeds BillingDocuments off the
  // catalog + customers — surfaced whenever there's a commerce catalog to bill.
  if (pack.products.length) mods.add('invoicing');
  return [...mods];
}

function buildCtx(
  tx: ApplyCtx['tx'],
  ctx: TenantContext,
  ownerUserId: string | null,
  propertyId: string | null,
  /** Where billing documents are issued from — never null (docs/131 §3.6). */
  issuingPropertyId: string,
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
    issuingPropertyId,
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
  // Splice generic defaults into any section the vertical left blank for an enabled
  // module, so no enabled module renders empty (e.g. scheduling on an apparel pack).
  const eff = withFallbacks(pack, ctx.isOn, ctx.now);
  // FIRST, before anything writes a CRM row: a customer's authored properties
  // are only meaningful once the schema that names them exists, and the property
  // panel reads that schema to know what to render.
  await applyRecordTypes(ctx, eff);
  await applyCatalog(ctx, eff);
  await applyProductImages(ctx, eff);
  await applyInventory(ctx, eff);
  if (ctx.isOn('commerce') || ctx.isOn('crm') || ctx.isOn('scheduling') || ctx.isOn('b2b')) {
    await applyCustomers(ctx, eff);
  }
  await applyOrders(ctx, eff);
  await applyReviews(ctx, eff);
  await applyContent(ctx, eff);
  await applyScheduling(ctx, eff);
  await applyQuotes(ctx, eff);
  await applyDeals(ctx, eff);
  await applyInvoicing(ctx, eff);
  await applyBundlesAndConfigurator(ctx, eff);
  await applyAi(ctx, eff);
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
    // Sample invoices need a real issuer (docs/131 §3.6) — `property_id` is NOT
    // NULL on billing_documents, because a document nobody issued is the state
    // that migration removes. Every tenant has a primary site, seeded at
    // provisioning, so this is an invariant violation rather than a routine miss.
    if (!property) {
      throw new Error(
        `Cannot load sample data: tenant ${ctx.tenantId} has no primary site. ` +
          'Every tenant gets one at provisioning — this tenant was built by a ' +
          'fixture that skips it.'
      );
    }
    const applyCtx = buildCtx(tx, ctx, owner?.id ?? null, property.id, property.id, enabledModules);
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
