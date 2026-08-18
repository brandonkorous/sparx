// Storefront-level settings and theme token overrides. Sitebuilder owns
// layout + page composition; Commerce owns the commerce-side defaults
// (currency, default warehouse, channel toggles) and the per-tenant theme
// token overrides applied on top of the @wizeworks/ui storefront variants.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

import { Channel, Currency } from './common';
import { DunningPolicy } from './subscriptions';

export const UpdateCommerceSiteSettingsInput = z.object({
  defaultCurrency: Currency,
  defaultLocale: z.string().min(2).max(10).default('en-US'),
  defaultWarehouseId: Uuid.optional(),
  channelsEnabled: z.array(Channel).default(['storefront']),
  // Cart abandonment threshold in minutes (default 120 — PRD §3 cart
  // abandonment definition).
  cartAbandonmentMinutes: z
    .number()
    .int()
    .min(15)
    .max(60 * 24 * 30)
    .default(120),
  // Storefront-wide guardrails surfaced as defaults at checkout.
  showStockBelow: z.number().int().nonnegative().default(10),
  hidePricesWhenSignedOut: z.boolean().default(false),
  requireAuthForCheckout: z.boolean().default(false),
  // What happens when a repeat order's card is declined (docs/142 §4.1). The
  // tenant-wide default; a single subscription can override it.
  //
  // OPTIONAL, unlike its neighbours, and deliberately so: this patch replaces
  // the whole settings object, and callers that predate the field (the MCP
  // `update_commerce_site_settings` tool, any script) do not send it. Defaulted
  // rather than optional, every one of them would silently reset a tenant's
  // dunning policy to the schema defaults as a side effect of changing the
  // currency. The service writes it only when it is present.
  defaultDunningPolicy: DunningPolicy.optional(),
});
export type UpdateCommerceSiteSettingsInput = z.infer<typeof UpdateCommerceSiteSettingsInput>;

// Theme tokens — the PRESENTATION-only subset a tenant can override on the
// storefront without touching Sitebuilder. Brand IDENTITY (primary/accent
// color, typography, logo, favicon) is owned by the tenant-level brand
// (docs/30 §6) and is NOT settable here — those columns were removed from
// CommerceSiteTheme in migration 20260610000200. Anything beyond presentation
// goes through Sitebuilder's theme editor / the Brand panel.
export const CommerceSiteThemeTokens = z
  .object({
    colorBackground: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    colorMuted: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    radiusBase: z
      .string()
      .regex(/^\d+(?:\.\d+)?(?:px|rem|em)$/)
      .optional(),
  })
  .partial();
export type CommerceSiteThemeTokens = z.infer<typeof CommerceSiteThemeTokens>;

export const UpdateCommerceSiteThemeInput = z.object({
  tokens: CommerceSiteThemeTokens,
});
export type UpdateCommerceSiteThemeInput = z.infer<typeof UpdateCommerceSiteThemeInput>;
