// commerceSiteService — per-site storefront settings + theme tokens.
//
// Sitebuilder owns layout; this service owns the commerce-relevant defaults
// (currency, channels, abandonment threshold, theme overrides).
//
// Settings + theme are now one-row-per-(tenant, PROPERTY) (docs/49 Phase 6): each
// of a tenant's SITES keeps its own. A site with no settings row of its own
// INHERITS the tenant's PRIMARY site's settings at read time (resolveSettingsRow:
// property → primary → code defaults), so adding a site never silently resets
// currency/locale/checkout policy. RLS enforces per-tenant isolation regardless;
// property_id is app-tier scoping within the tenant.

import {
  UpdateCommerceSiteSettingsInput,
  UpdateCommerceSiteThemeInput,
} from '@sparx/commerce-schemas';
import { withTenant, type TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';

export interface CommerceSiteSettings {
  defaultCurrency: string;
  defaultLocale: string;
  defaultWarehouseId: string | null;
  channelsEnabled: string[];
  cartAbandonmentMinutes: number;
  showStockBelow: number;
  hidePricesWhenSignedOut: boolean;
  requireAuthForCheckout: boolean;
}

const DEFAULTS: CommerceSiteSettings = {
  defaultCurrency: 'USD',
  defaultLocale: 'en-US',
  defaultWarehouseId: null,
  channelsEnabled: ['storefront'],
  cartAbandonmentMinutes: 120,
  showStockBelow: 10,
  hidePricesWhenSignedOut: false,
  requireAuthForCheckout: false,
};

// The raw settings row returned by Prisma (the subset every reader needs).
type SettingsRow = NonNullable<Awaited<ReturnType<TxClient['commerceSiteSettings']['findUnique']>>>;

/**
 * Resolve the settings row that GOVERNS a site (docs/49 Phase 6b): the site's own
 * row, else the tenant's PRIMARY site's row (inheritance), else null (caller uses
 * code defaults). Shared by every settings reader — the dashboard service, the
 * public storefront payload, the cart, and the search projector — so the
 * fallback is identical everywhere. Runs inside the caller's withTenant tx (RLS
 * already scopes it to the tenant).
 */
export async function resolveSettingsRow(
  tx: TxClient,
  tenantId: string,
  propertyId: string
): Promise<SettingsRow | null> {
  const own = await tx.commerceSiteSettings.findUnique({
    where: { tenantId_propertyId: { tenantId, propertyId } },
  });
  if (own) return own;
  const primary = await tx.property.findFirst({
    where: { isPrimary: true },
    select: { id: true },
  });
  if (!primary || primary.id === propertyId) return null;
  return tx.commerceSiteSettings.findUnique({
    where: { tenantId_propertyId: { tenantId, propertyId: primary.id } },
  });
}

export async function getSettings(
  ctx: ServiceContext,
  propertyId: string
): Promise<CommerceSiteSettings> {
  return withTenant(ctx, async (tx) => {
    const row = await resolveSettingsRow(tx, ctx.tenantId, propertyId);
    if (!row) return DEFAULTS;
    return {
      defaultCurrency: row.defaultCurrency,
      defaultLocale: row.defaultLocale,
      defaultWarehouseId: row.defaultWarehouseId,
      channelsEnabled: Array.isArray(row.channelsEnabled)
        ? (row.channelsEnabled as string[])
        : DEFAULTS.channelsEnabled,
      cartAbandonmentMinutes: row.cartAbandonmentMinutes,
      showStockBelow: row.showStockBelow,
      hidePricesWhenSignedOut: row.hidePricesWhenSignedOut,
      requireAuthForCheckout: row.requireAuthForCheckout,
    };
  });
}

export async function updateSettings(
  ctx: ServiceContext,
  propertyId: string,
  rawInput: unknown
): Promise<void> {
  const input = UpdateCommerceSiteSettingsInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const before = await tx.commerceSiteSettings.findUnique({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId } },
    });

    await tx.commerceSiteSettings.upsert({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId } },
      create: {
        tenantId: ctx.tenantId,
        propertyId,
        defaultCurrency: input.defaultCurrency,
        defaultLocale: input.defaultLocale,
        defaultWarehouseId: input.defaultWarehouseId ?? null,
        channelsEnabled: input.channelsEnabled,
        cartAbandonmentMinutes: input.cartAbandonmentMinutes,
        showStockBelow: input.showStockBelow,
        hidePricesWhenSignedOut: input.hidePricesWhenSignedOut,
        requireAuthForCheckout: input.requireAuthForCheckout,
      },
      update: {
        defaultCurrency: input.defaultCurrency,
        defaultLocale: input.defaultLocale,
        defaultWarehouseId: input.defaultWarehouseId ?? null,
        channelsEnabled: input.channelsEnabled,
        cartAbandonmentMinutes: input.cartAbandonmentMinutes,
        showStockBelow: input.showStockBelow,
        hidePricesWhenSignedOut: input.hidePricesWhenSignedOut,
        requireAuthForCheckout: input.requireAuthForCheckout,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: before ? 'commerce.site.settings.updated' : 'commerce.site.settings.created',
      entityType: 'CommerceSiteSettings',
      entityId: propertyId,
      diff: { before: before as Record<string, unknown> | null, after: input },
    });
  });
}

// ─── Activation default (docs/104 L2) ─────────────────────────────────
//
// On `module.activated(commerce)`, materialize the PRIMARY site's commerce
// settings row so the Commerce → Settings surface is populated (and currency /
// checkout policy have an explicit home rather than relying on the read-time
// code-default fallback). The default fulfillment origin is linked to the
// tenant's default warehouse when one exists (inventory rides free with
// commerce, so its `bootstrapDefaultWarehouse` has typically already run). Find-
// or-create by (tenant, primary property): a tenant that edited its settings
// keeps them. `tenantId` is scoped explicitly (not just RLS) since the local
// superuser bypasses RLS.
export async function bootstrapDefaults(ctx: ServiceContext): Promise<{ created: boolean }> {
  return withTenant(ctx, async (tx) => {
    const primary = await tx.property.findFirst({
      where: { tenantId: ctx.tenantId, isPrimary: true },
      select: { id: true },
    });
    if (!primary) return { created: false };

    const existing = await tx.commerceSiteSettings.findUnique({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: primary.id } },
      select: { propertyId: true },
    });
    if (existing) return { created: false };

    // Link the default fulfillment origin to the tenant's default operating
    // warehouse if one already exists; otherwise null (resolved at checkout).
    const warehouse = await tx.warehouse.findFirst({
      where: { tenantId: ctx.tenantId, isSystem: false, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    // All other columns carry schema-level defaults (currency USD, locale
    // en-US, channels ['storefront'], abandonment 120m, …).
    await tx.commerceSiteSettings.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: primary.id,
        defaultWarehouseId: warehouse?.id ?? null,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'system',
      action: 'commerce.site.settings.bootstrapped',
      entityType: 'CommerceSiteSettings',
      entityId: primary.id,
      diff: { after: { defaultWarehouseId: warehouse?.id ?? null } },
    });
    return { created: true };
  });
}

// Presentation-only theme overrides, per web PROPERTY (docs/49 Phase 6) — each
// site keeps its own write-through theme row. Brand identity (primary/accent
// colour, typography, logo, favicon) is owned by the tenant-level brand
// (docs/30 §6) and is NOT stored here — those columns were removed in migration
// 20260610000200. `propertyId` is resolved at the transport (the active site).
export async function getTheme(
  ctx: ServiceContext,
  propertyId: string
): Promise<Record<string, string | null>> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.commerceSiteTheme.findUnique({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId } },
    });
    const empty: Record<string, string | null> = {};
    if (!row) return empty;
    return {
      colorBackground: row.colorBackground,
      colorMuted: row.colorMuted,
      radiusBase: row.radiusBase,
    };
  });
}

export async function updateTheme(
  ctx: ServiceContext,
  propertyId: string,
  rawInput: unknown
): Promise<void> {
  const input = UpdateCommerceSiteThemeInput.parse(rawInput);

  // Strip undefined keys so an upsert doesn't blow away an existing
  // value the user didn't touch — the form only sends the fields that
  // changed.
  const cleanTokens: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(input.tokens)) {
    cleanTokens[key] = value ?? null;
  }

  await withTenant(ctx, async (tx) => {
    await tx.commerceSiteTheme.upsert({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId } },
      create: { tenantId: ctx.tenantId, propertyId, ...cleanTokens },
      update: cleanTokens,
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.site.theme.updated',
      entityType: 'CommerceSiteTheme',
      entityId: propertyId,
      diff: { after: cleanTokens },
    });
  });
}
