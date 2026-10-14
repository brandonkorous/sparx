// Universal-search projectors for what an owner sets up and names in Selling
// (persona issue 261).
//
// Price lists, markup rules, delivery profiles and regions, compatibility lists,
// build templates, product types and wholesale price tiers each have a screen of
// their own and a name the owner typed. None of them could be found by it.
//
// Signalled from the commerce services (`indexCommerceEntity`) and the b2b tier
// service; reindex walks these like every other projector.

import { withTenant } from '@wizeworks/db';
import {
  type EntityProjector,
  type ProjectorContext,
  type UniversalSearchDocument,
  universalId,
} from '@wizeworks/search';

import { codeAsWords } from './search-words';
import {
  epoch,
  keywords,
  listWords,
  pickString,
  pickStrings,
  plainNumber,
  snippet,
} from './universal-projection-kit';

// ─── commerce: a price list ──────────────────────────────────────────────────

const CHANNEL_WORDS: Record<string, string> = {
  storefront: 'Prices on your site',
  b2b_portal: 'Prices for wholesale buyers',
  subscription: 'Prices for repeat orders',
};

const priceListProjector: EntityProjector = {
  entityType: 'price_list',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.priceList.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.priceList.findFirst({ where: { id, deletedAt: null } });
      if (!p) return null;
      const where = p.channel ? CHANNEL_WORDS[p.channel] : undefined;
      return {
        id: universalId(ctx.tenantId, 'price_list', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'price_list',
        module: 'commerce',
        record_id: p.id,
        title: p.name,
        subtitle: snippet(p.description, 120) ?? where ?? `Prices in ${p.currency.toUpperCase()}`,
        body: snippet(p.description),
        keywords: keywords([p.currency]),
        status: p.status,
        url: `/commerce/price-lists/${p.id}`,
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

// ─── commerce: a markup rule ─────────────────────────────────────────────────

const MARKUP_METHODS: Record<string, string> = {
  percentage: 'Adds a percentage to what it cost you',
  multiplier: 'Multiplies what it cost you',
  flat: 'Adds a set amount to what it cost you',
  margin_target: 'Prices to the margin you want',
  matrix: 'Marks up by how much it cost you',
};

const markupRuleProjector: EntityProjector = {
  entityType: 'markup_rule',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.markupRule.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const m = await tx.markupRule.findFirst({ where: { id } });
      if (!m) return null;
      return {
        id: universalId(ctx.tenantId, 'markup_rule', m.id),
        tenant_id: ctx.tenantId,
        entity_type: 'markup_rule',
        module: 'commerce',
        record_id: m.id,
        title: m.name,
        subtitle: MARKUP_METHODS[m.method] ?? codeAsWords(m.method),
        status: m.isActive ? 'active' : 'inactive',
        url: `/commerce/markup-rules/${m.id}`,
        created_at: epoch(m.createdAt),
        updated_at: epoch(m.updatedAt),
      };
    }),
};

// ─── commerce: a delivery profile ────────────────────────────────────────────

const shippingProfileProjector: EntityProjector = {
  entityType: 'shipping_profile',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.shippingProfile.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.shippingProfile.findFirst({ where: { id } });
      if (!p) return null;
      const how = p.requiresFreight
        ? 'Goes by freight'
        : p.requiresSignature
          ? 'Needs a signature on delivery'
          : 'How these products are delivered';
      return {
        id: universalId(ctx.tenantId, 'shipping_profile', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'shipping_profile',
        module: 'commerce',
        record_id: p.id,
        title: p.name,
        subtitle: snippet(p.description, 120) ?? how,
        body: snippet(p.description),
        url: `/commerce/shipping/profiles/${p.id}`,
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

// ─── commerce: a delivery region ─────────────────────────────────────────────

/** "United States" for "US"; the code itself when the runtime has no name for it. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

const shippingZoneProjector: EntityProjector = {
  entityType: 'shipping_zone',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.shippingZone.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const z = await tx.shippingZone.findFirst({ where: { id } });
      if (!z) return null;
      const targeting = (z.targeting ?? {}) as Record<string, unknown>;
      const countries = pickStrings(targeting.countries).map(countryName);
      const regions = pickStrings(targeting.regions);
      const places = listWords([...countries, ...regions]);
      return {
        id: universalId(ctx.tenantId, 'shipping_zone', z.id),
        tenant_id: ctx.tenantId,
        entity_type: 'shipping_zone',
        module: 'commerce',
        record_id: z.id,
        title: z.name,
        subtitle: places ? `Delivers to ${places}` : 'No places in it yet',
        keywords: keywords([...countries, ...regions]),
        url: `/commerce/shipping/regions/${z.id}`,
        created_at: epoch(z.createdAt),
        updated_at: epoch(z.updatedAt),
      };
    }),
};

// ─── commerce: a compatibility list (fitment domain) ─────────────────────────

const fitmentDomainProjector: EntityProjector = {
  entityType: 'fitment_domain',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.fitmentDomain.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const d = await tx.fitmentDomain.findFirst({ where: { id, deletedAt: null } });
      if (!d) return null;
      // What a buyer picks, in order: "Year, Make and Model".
      const dimensions = Array.isArray(d.dimensions)
        ? d.dimensions
            .map((dim) =>
              dim && typeof dim === 'object' && !Array.isArray(dim)
                ? pickString((dim as Record<string, unknown>).label)
                : undefined
            )
            .filter((label): label is string => label !== undefined)
        : [];
      return {
        id: universalId(ctx.tenantId, 'fitment_domain', d.id),
        tenant_id: ctx.tenantId,
        entity_type: 'fitment_domain',
        module: 'commerce',
        record_id: d.id,
        title: d.displayName,
        subtitle:
          snippet(d.description, 120) ??
          (dimensions.length > 0 ? `By ${listWords(dimensions, 4) ?? ''}` : undefined),
        body: snippet(d.description),
        keywords: keywords([d.slug, ...dimensions]),
        url: `/commerce/fitment/${d.id}`,
        created_at: epoch(d.createdAt),
        updated_at: epoch(d.updatedAt),
      };
    }),
};

// ─── commerce: a build template (configurator) ───────────────────────────────

const configuratorTemplateProjector: EntityProjector = {
  entityType: 'configurator_template',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.configurationTemplate.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const t = await tx.configurationTemplate.findFirst({
        where: { id },
        include: { product: { select: { title: true } } },
      });
      if (!t) return null;
      return {
        id: universalId(ctx.tenantId, 'configurator_template', t.id),
        tenant_id: ctx.tenantId,
        entity_type: 'configurator_template',
        module: 'commerce',
        record_id: t.id,
        title: t.name,
        subtitle: `Builds ${t.product.title}`,
        body: snippet(t.description),
        keywords: keywords([t.product.title]),
        status: t.status,
        url: `/commerce/configurator/${t.id}`,
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

// ─── commerce: a product type ────────────────────────────────────────────────
//
// Addressed by KEY (`/commerce/product-types/:key`), so the search entry is keyed
// by it and the service signals the key. A key is fixed once the type is made.

const productTypeProjector: EntityProjector = {
  entityType: 'product_type',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.productType.findMany({ select: { key: true }, distinct: ['key'] });
      return rows.map((r) => r.key);
    }),
  project: (ctx: ProjectorContext, key: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      // A built-in the tenant has edited exists twice: their copy wins, as on screen.
      const t = await tx.productType.findFirst({
        where: { key },
        orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
      });
      if (!t) return null;
      return {
        id: universalId(ctx.tenantId, 'product_type', t.key),
        tenant_id: ctx.tenantId,
        entity_type: 'product_type',
        module: 'commerce',
        record_id: t.key,
        title: t.name,
        subtitle:
          snippet(t.description, 120) ??
          (t.isBuiltIn ? 'Comes with your account' : 'A kind of product you added'),
        body: snippet(t.description),
        keywords: keywords([t.pluralName]),
        url: `/commerce/product-types/${encodeURIComponent(t.key)}`,
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

// ─── b2b: a wholesale price tier ─────────────────────────────────────────────

const pricingTierProjector: EntityProjector = {
  entityType: 'pricing_tier',
  module: 'b2b',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.b2bPricingTier.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const t = await tx.b2bPricingTier.findFirst({ where: { id, deletedAt: null } });
      if (!t) return null;
      // The discount itself is what tells two tiers apart. A fixed amount is in
      // the tenant's currency, which this row does not carry, so it is not printed.
      const off =
        t.discountType === 'percentage'
          ? `${plainNumber(t.discountValue)}% off`
          : 'A set amount off';
      return {
        id: universalId(ctx.tenantId, 'pricing_tier', t.id),
        tenant_id: ctx.tenantId,
        entity_type: 'pricing_tier',
        module: 'b2b',
        record_id: t.id,
        title: t.name,
        subtitle: snippet(t.description, 120) ?? off,
        body: snippet(t.description),
        url: `/wholesale/price-tiers/${t.id}`,
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

export const sellingOwnerNamedProjectors: EntityProjector[] = [
  priceListProjector,
  markupRuleProjector,
  shippingProfileProjector,
  shippingZoneProjector,
  fitmentDomainProjector,
  configuratorTemplateProjector,
  productTypeProjector,
  pricingTierProjector,
];
