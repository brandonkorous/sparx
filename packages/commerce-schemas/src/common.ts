// Shared Commerce primitives — reused across product, pricing, cart,
// checkout, subscription, return, and provider schemas.
//
// Money is stored on the wire as integer cents (matching the *Cents
// columns in the Prisma schema) — JavaScript floats are never used for
// authoritative pricing. Display formatting is the storefront/dashboard's
// problem, not this layer's.

import { z } from 'zod';

// Re-export the primitives Commerce shares with CRM verbatim, so callers
// don't need to dual-import from both schema packages for one type.
export { AddressSnapshot, Currency, LineItemInput, Money } from '@sparx/crm-schemas';
export type {
  AddressSnapshot as AddressSnapshotType,
  Currency as CurrencyType,
} from '@sparx/crm-schemas';

export const MoneyCents = z.number().int().nonnegative();
export type MoneyCents = z.infer<typeof MoneyCents>;

export const SignedMoneyCents = z.number().int();
export type SignedMoneyCents = z.infer<typeof SignedMoneyCents>;

// Channel — every cart, order, subscription, and price list is scoped to
// the surface it was created on. `admin` covers dashboard-manual entries
// (sales reps), `mcp` covers AI-tool-driven writes. `sparx_market` is the
// first-party marketplace (docs/106 §4.7) — a cart/checkout on sparx.market,
// where sparx is merchant-of-record (the order persists as channel='marketplace',
// source='sparx_market').
export const Channel = z.enum([
  'storefront',
  'b2b_portal',
  'admin',
  'subscription',
  'mcp',
  'import',
  'sparx_market',
]);
export type Channel = z.infer<typeof Channel>;

// Handles — URL-safe identifiers used for product/category/collection
// slugs. Mirrors the Shopify convention; case-sensitive lowercase only,
// no leading/trailing hyphens, max 127 chars to fit the unique index.
export const Handle = z
  .string()
  .min(1)
  .max(127)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Handle must be lowercase alphanumeric with internal hyphens only'
  );
export type Handle = z.infer<typeof Handle>;

// SKU — merchant-defined. Allow upper/lower/digits/dashes/underscores,
// punctuation/spaces rejected so SKUs are barcode-friendly. Mirrors the
// VARCHAR(127) cap on ProductVariant.sku.
export const Sku = z
  .string()
  .min(1)
  .max(127)
  .regex(
    /^[A-Za-z0-9._\-/]+$/,
    'SKU may only contain letters, digits, dot, dash, underscore, slash'
  );
export type Sku = z.infer<typeof Sku>;

export const Barcode = z
  .string()
  .min(8)
  .max(14)
  .regex(/^[0-9]+$/, 'Barcode must be numeric (UPC-A, EAN-13, GTIN-14)');
export type Barcode = z.infer<typeof Barcode>;

// Fulfillment type — drives which checkout flow + which inventory rules
// apply. Configurable products resolve through the configurator engine
// to one of the simpler types at cart time; bundles decrement their
// components (or the bundle SKU itself, per Bundle.inventoryMode).
export const FulfillmentType = z.enum([
  'physical',
  'digital',
  'service',
  'configurable',
  'bundle',
  'subscription',
]);
export type FulfillmentType = z.infer<typeof FulfillmentType>;

export const InventoryPolicy = z.enum(['deny', 'continue', 'preorder']);
export type InventoryPolicy = z.infer<typeof InventoryPolicy>;

export const ProductStatus = z.enum(['draft', 'active', 'archived']);
export type ProductStatus = z.infer<typeof ProductStatus>;

// Hazmat class — IATA / DOT classification surfaces to the shipping
// provider so freight/ground/air decisions are made downstream. `none`
// is the default; merchants only set this when the product actually
// carries a regulated material.
export const HazmatClass = z.enum([
  'none',
  'class_1_explosive',
  'class_2_gas',
  'class_3_flammable_liquid',
  'class_4_flammable_solid',
  'class_5_oxidizer',
  'class_6_toxic',
  'class_7_radioactive',
  'class_8_corrosive',
  'class_9_misc',
]);
export type HazmatClass = z.infer<typeof HazmatClass>;

// Dimensions are persisted in millimeters + grams to dodge unit drift
// across regions; UI surfaces let merchants enter in their preferred
// units and convert at the form boundary.
export const Dimensions = z.object({
  lengthMm: z.number().int().positive().max(100_000),
  widthMm: z.number().int().positive().max(100_000),
  heightMm: z.number().int().positive().max(100_000),
});
export type Dimensions = z.infer<typeof Dimensions>;

export const WeightGrams = z.number().int().nonnegative().max(10_000_000); // 10 tonnes
export type WeightGrams = z.infer<typeof WeightGrams>;

// ISO 3166-1 alpha-2 country codes are required on every shipping/billing
// address; this matches the AddressSnapshot constraint in @sparx/crm-schemas.
export const CountryCode = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'Country must be ISO 3166-1 alpha-2');
export type CountryCode = z.infer<typeof CountryCode>;

// BCP-47 language tag — `en`, `en-US`, `fr-CA`, `zh-Hans`, `zh-Hans-CN`.
// Capped at 10 chars to match the VARCHAR(10) locale columns.
//
// Casing is CANONICALIZED rather than merely validated, because the rows
// keyed by this value carry an exact-string unique index (e.g.
// `product_translations_locale_unique` on (product_id, locale)). Without
// normalization `en-US` and `EN-us` are two different rows for the same
// language, and the storefront — which resolves a single tag — would show
// one of them at random. Canonical form follows the BCP-47 convention:
// language lowercase, script Titlecase, region UPPERCASE, variants
// lowercase.
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export function canonicalizeLocale(raw: string): string {
  const [language = '', ...rest] = raw.split('-');
  const subtags = rest.map((subtag) => {
    // 4 alpha = script (Hans); 2 alpha or 3 digit = region (US, 419).
    if (/^[A-Za-z]{4}$/.test(subtag)) {
      return subtag.slice(0, 1).toUpperCase() + subtag.slice(1).toLowerCase();
    }
    if (/^[A-Za-z]{2}$/.test(subtag) || /^[0-9]{3}$/.test(subtag)) return subtag.toUpperCase();
    return subtag.toLowerCase();
  });
  return [language.toLowerCase(), ...subtags].join('-');
}

export const Locale = z
  .string()
  .min(2)
  .max(10)
  .regex(LOCALE_PATTERN, 'Locale must be a BCP-47 language tag (e.g. en, en-US, zh-Hans)')
  .transform(canonicalizeLocale);
export type Locale = z.infer<typeof Locale>;
