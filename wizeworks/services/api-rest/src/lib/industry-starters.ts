// Industry starters — the cross-module provisioning tier (Wave 3). A starter
// names a vertical (apparel, food, salon, wholesale, …) and COMPOSES module
// presets: installing it stamps each referenced preset whose module is enabled,
// records `settings.industry`, and skips the slices for disabled modules — all in
// ONE tenant transaction so the kit commits atomically.
//
// Assembled at the composition root (like preset-registry.ts) so it can resolve
// every ref through the aggregated `presetRegistry` without a dependency cycle.
// The starter DEFINITIONS reference presets by slug only (no preset code), so a
// unit test asserts every ref resolves — a typo fails CI, not an install.
//
// Two invariants the seam enforces: it writes ONLY `settings.industry` (never
// `settings.modules` — invariant #1), and it provisions ONLY into enabled modules
// (invariant #2).

import {
  IndustryStarterRegistry,
  listEnabledModules,
  toIndustryStarterView,
  type IndustryStarter,
  type IndustryStarterPresetRef,
  type IndustryStarterView,
  type ModuleSlug,
} from '@wizeworks/auth';
import { prisma, withTenant, type Prisma, type TenantContext } from '@wizeworks/db';
import { notFound } from '@wizeworks/api-core/errors';

import { presetRegistry } from './preset-registry.js';

/** Terse authoring helper — one module's refs on one line. */
function refs(module: ModuleSlug, ...slugs: string[]): IndustryStarterPresetRef[] {
  return slugs.map((slug) => ({ module, slug }));
}

// ─── Starter definitions (data-as-code) ───────────────────────────────
// Every slug below is a real preset in `presetRegistry` (guarded by the test).
// Verticals are deliberately varied — retail, services, and B2B — so no single
// industry frames the platform.

const STARTERS: IndustryStarter[] = [
  {
    slug: 'apparel',
    name: 'Apparel & fashion',
    description:
      'A clothing store: size charts, an apparel catalog, US sales tax, tiered shipping, keystone markup, a VIP segment, and a newsletter + sale campaign.',
    iconKey: 'shirt',
    tags: ['clothing', 'fashion', 'retail', 'boutique'],
    presets: [
      ...refs(
        'commerce',
        'categories-apparel',
        'fitment-apparel-sizes',
        'tax-us-sales',
        'shipping-us-tiered',
        'collection-new-arrivals',
        'markup-keystone',
        'payments-stripe-byo'
      ),
      ...refs('crm', 'vip-customers', 'email-engaged'),
      ...refs('cms', 'content-testimonial', 'nav-starter'),
      ...refs('email', 'newsletter-campaign', 'promo-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
  {
    slug: 'food',
    name: 'Food & beverage',
    description:
      'A food or specialty-grocery shop: a food catalog, recipes content type, US sales tax, shipping, standard markup, and a monthly newsletter.',
    iconKey: 'utensils',
    tags: ['food', 'beverage', 'grocery', 'bakery', 'cafe'],
    presets: [
      ...refs(
        'commerce',
        'categories-food-beverage',
        'tax-us-sales',
        'shipping-us-tiered',
        'markup-standard-40',
        'payments-stripe-byo'
      ),
      ...refs('crm', 'vip-customers'),
      ...refs('cms', 'content-recipe', 'nav-starter'),
      ...refs('email', 'newsletter-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
  {
    slug: 'electronics',
    name: 'Electronics & tech',
    description:
      'A gadget store: an electronics catalog, device fitment, a support pipeline, an FAQ content type, tax, shipping, and a new-arrivals collection.',
    iconKey: 'cpu',
    tags: ['electronics', 'tech', 'gadgets', 'computers'],
    presets: [
      ...refs(
        'commerce',
        'categories-electronics',
        'fitment-device',
        'tax-us-sales',
        'shipping-us-tiered',
        'markup-standard-40',
        'collection-new-arrivals',
        'payments-stripe-byo'
      ),
      // No CRM ref: this used to install `crm:support`, a preset that no longer
      // exists. A support queue is not something a starter installs — the first
      // request a tenant files creates the real one, with a response promise
      // attached. See the note in wizeworks/packages/crm/src/presets/crm.ts.
      ...refs('cms', 'content-faq', 'nav-starter'),
      ...refs('email', 'newsletter-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
  {
    slug: 'auto-parts',
    name: 'Auto parts & accessories',
    description:
      'A parts store with vehicle fitment: year/make/model + tires & wheels lookups, a quote→invoice flow, an FAQ, tax, shipping, and keystone markup.',
    iconKey: 'car',
    tags: ['automotive', 'parts', 'accessories', 'powersports'],
    presets: [
      ...refs(
        'commerce',
        'fitment-vehicle',
        'fitment-tires-wheels',
        'tax-us-sales',
        'shipping-us-tiered',
        'markup-keystone',
        'payments-stripe-byo'
      ),
      // No CRM ref — same reason as electronics above.
      ...refs('invoicing', 'retail-quote'),
      ...refs('cms', 'content-faq', 'nav-starter'),
      ...refs('email', 'newsletter-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
  {
    slug: 'salon',
    name: 'Beauty & salon',
    description:
      'An appointment-based salon or spa: cut/color/manicure services with a cancellation policy, a VIP segment, testimonials, manual payments, and a promo email.',
    iconKey: 'scissors',
    tags: ['salon', 'spa', 'beauty', 'barber', 'appointments'],
    presets: [
      ...refs('scheduling', 'salon-spa'),
      ...refs('crm', 'vip-customers'),
      ...refs('cms', 'content-testimonial', 'nav-starter'),
      ...refs('commerce', 'tax-us-sales', 'payments-manual-offline'),
      ...refs('email', 'promo-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
  // Florist — retail and a calendar in one business, with stock that expires.
  // The only starter that pairs a commerce catalog with a class-based booking
  // setup, because it is the only vertical here where the same customer buys a
  // thing on Tuesday and a seat on Saturday.
  //
  // `retail-quote` earns its place: wedding work is quoted, not rung up, and a
  // florist without a quote surface has to do that half of the business in
  // email.
  {
    slug: 'florist',
    name: 'Florist & plants',
    description:
      'A flower shop: a bouquet and plant catalog, workshops sold by the seat with a 48-hour policy, wedding consultations that become quotes, US sales tax, tiered shipping, and a seasonal newsletter.',
    iconKey: 'flower',
    tags: ['florist', 'flowers', 'plants', 'garden', 'weddings', 'workshops'],
    presets: [
      ...refs(
        'commerce',
        'tax-us-sales',
        'shipping-us-tiered',
        'collection-new-arrivals',
        'markup-standard-40',
        'payments-stripe-byo'
      ),
      ...refs('scheduling', 'florist-workshops'),
      ...refs('invoicing', 'retail-quote'),
      ...refs('crm', 'vip-customers'),
      ...refs('cms', 'content-faq', 'nav-starter'),
      ...refs('email', 'newsletter-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
  {
    slug: 'fitness',
    name: 'Fitness & wellness',
    description:
      'A studio or gym: group classes and personal training with seats and a class policy, an email-engaged segment, manual payments, and a newsletter.',
    iconKey: 'dumbbell',
    tags: ['fitness', 'gym', 'studio', 'wellness', 'yoga'],
    presets: [
      ...refs('scheduling', 'fitness-classes'),
      ...refs('crm', 'email-engaged'),
      ...refs('cms', 'nav-starter'),
      ...refs('commerce', 'payments-manual-offline'),
      ...refs('email', 'newsletter-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
  {
    slug: 'professional',
    name: 'Professional services',
    description:
      'A consultancy or agency: consultation booking, quote and subscription invoicing with extra line types, a B2B sales pipeline, an FAQ, and a newsletter.',
    iconKey: 'briefcase',
    tags: ['consulting', 'agency', 'professional', 'services', 'retainer'],
    presets: [
      ...refs('scheduling', 'professional-consults'),
      ...refs('invoicing', 'retail-quote', 'subscription', 'retail-line-types'),
      ...refs('crm', 'b2b-sales'),
      ...refs('cms', 'content-faq', 'nav-starter'),
      ...refs('email', 'newsletter-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
  {
    slug: 'wholesale',
    name: 'Wholesale & distribution',
    description:
      'A B2B distributor: wholesale pricing tiers, purchase approval, a B2B sales pipeline, deposit/progress invoicing, free-over-threshold shipping, and net-terms-friendly defaults.',
    iconKey: 'warehouse',
    tags: ['wholesale', 'distribution', 'b2b', 'trade', 'supplier'],
    presets: [
      ...refs('b2b', 'wholesale-tiers', 'purchase-approval'),
      ...refs(
        'commerce',
        'tax-us-sales',
        'shipping-free-over-75',
        'markup-standard-40',
        'payments-stripe-byo'
      ),
      ...refs('crm', 'b2b-sales', 'vip-customers'),
      ...refs('invoicing', 'deposit-progress', 'retail-line-types'),
      ...refs('cms', 'nav-starter'),
      ...refs('email', 'newsletter-campaign'),
      ...refs('ai', 'ai-prompt-library-core'),
    ],
  },
];

/** Every industry starter, indexed by slug. */
export const starterRegistry = new IndustryStarterRegistry(STARTERS);

/** The tenant's chosen industry slug, or null. Reads the non-RLS `tenants` row. */
function readIndustry(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const value = (settings as Record<string, unknown>).industry;
  return typeof value === 'string' ? value : null;
}

/** List every starter, resolved against the tenant's enabled modules + current
 *  industry (which one is active, how many of its packs apply). */
export async function listIndustryStarters(ctx: TenantContext): Promise<IndustryStarterView[]> {
  const [enabled, tenant] = await Promise.all([
    listEnabledModules(ctx.tenantId),
    prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { settings: true } }),
  ]);
  const active = readIndustry(tenant?.settings);
  return starterRegistry.all().map((s) => toIndustryStarterView(s, enabled, s.slug === active));
}

export interface InstallStarterResult {
  slug: string;
  installed: IndustryStarterPresetRef[];
  alreadyInstalled: IndustryStarterPresetRef[];
  /** Skipped because the owning module is disabled (invariant #2). */
  skipped: IndustryStarterPresetRef[];
}

/**
 * Install a starter: stamp each preset whose module is enabled (skipping
 * disabled-module slices and already-present packs), then record the chosen
 * industry. ALL in one tenant transaction so a kit commits atomically. NOT_FOUND
 * for an unknown starter. Writes only `settings.industry` — never the module flags.
 */
export async function installIndustryStarter(
  ctx: TenantContext,
  slug: string
): Promise<InstallStarterResult> {
  const starter = starterRegistry.get(slug);
  if (!starter) throw notFound('IndustryStarter', slug);
  const enabled = new Set(await listEnabledModules(ctx.tenantId));

  return withTenant(ctx, async (tx) => {
    const sx: TenantContext = { tenantId: ctx.tenantId, userId: ctx.userId, tx };
    const installed: IndustryStarterPresetRef[] = [];
    const alreadyInstalled: IndustryStarterPresetRef[] = [];
    const skipped: IndustryStarterPresetRef[] = [];

    for (const ref of starter.presets) {
      const preset = enabled.has(ref.module) ? presetRegistry.get(ref.module, ref.slug) : undefined;
      if (!preset) {
        skipped.push(ref); // disabled module, or (test-guarded) unknown ref
        continue;
      }
      if (await preset.isInstalled(sx)) {
        alreadyInstalled.push(ref);
        continue;
      }
      await preset.install(sx);
      installed.push(ref);
    }

    await recordIndustry(tx, ctx, slug, installed.length, skipped.length);
    return { slug, installed, alreadyInstalled, skipped };
  });
}

/** Merge `settings.industry = slug` (preserving `settings.modules` + every other
 *  key) and append the audit row — inside the install transaction. */
async function recordIndustry(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  slug: string,
  installedCount: number,
  skippedCount: number
): Promise<void> {
  const tenant = await tx.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { settings: true },
  });
  const current =
    tenant?.settings && typeof tenant.settings === 'object'
      ? (tenant.settings as Record<string, unknown>)
      : {};
  await tx.tenant.update({
    where: { id: ctx.tenantId },
    data: { settings: { ...current, industry: slug } },
  });
  await tx.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'tenant.industry.installed',
      entityType: 'Tenant',
      entityId: ctx.tenantId,
      diff: { after: { industry: slug, installed: installedCount, skipped: skippedCount } },
    },
  });
}
