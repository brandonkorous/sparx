// The Blueprint manifest — the declarative contract for a marketplace template
// that provisions a whole tenant (docs/54 §4). ONE versioned document; the
// installer (Phase 2) walks it in dependency order and replays it through the
// existing service layer, resolving every handle/ref to a runtime id as it goes.
//
// Design rules (docs/54):
//   · Reference by HANDLE, never by id — the manifest can't know runtime UUIDs.
//     Categories link by `parentHandle`; products link by `categoryHandles`;
//     MediaAsset-bound fields carry a `*AssetId` that names an entry in `assets`.
//   · Authored TREES (pages/layouts/emails/components) are real
//     @sparx/builder-schemas node trees — the same JSON the visual editor emits —
//     and reference brand via tokens, so they re-theme per installing tenant.
//   · MediaAsset-bound imagery (product images, logos, category/og images, and
//     `asset` fields inside content bodies) goes through `assets`; tree imagery
//     hot-links a raw URL inline (docs/54 §6).
//
// Zod-only (no DB, no React), like the schema packages it composes.

import { z } from 'zod';

import {
  BuilderNodeSchema,
  BuilderPageKind,
  ComponentGroup,
  ComponentKey,
  ComponentSurface,
  PageSlug,
  PropSpecListSchema,
} from '@sparx/builder-schemas';
import { ContentTypeSchema } from '@sparx/cms-schemas';
import { CreateSavedThemeInput } from '@sparx/sitebuilder-schemas';
import {
  Barcode,
  CollectionRuleSet,
  CollectionType,
  Currency,
  Dimensions,
  FulfillmentType,
  Handle,
  InventoryPolicy,
  MoneyCents,
  OptionDisplayType,
  ProductStatus,
  Sku,
  WeightGrams,
} from '@sparx/commerce-schemas';

// ── Shared manifest primitives ────────────────────────────────────────────────

/** A manifest-local id (asset decl ids, referenced by `*AssetId` fields). Never
 *  persisted — the installer maps it to the created MediaAsset's UUID. */
export const ManifestId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers, and internal hyphens.');

const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be #RRGGBB.');

/** An absolute http(s) URL — every blueprint image hot-links one (docs/54 §6 D3). */
const AbsoluteUrl = z
  .string()
  .max(2048)
  .regex(/^https?:\/\//i, 'Must be an absolute http(s) URL.');

/** The modules a blueprint can require / provision for. Mirrors @sparx/auth's
 *  ModuleSlug (kept independent so this package stays DB-free). */
export const BlueprintModuleSlug = z.enum([
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'dropship',
  'inventory',
  'ai',
]);
export type BlueprintModuleSlug = z.infer<typeof BlueprintModuleSlug>;

export const BlueprintVertical = z.enum(['retail', 'b2b', 'content', 'services']);
export type BlueprintVertical = z.infer<typeof BlueprintVertical>;

// ── Assets (docs/54 §6) ───────────────────────────────────────────────────────

export const AssetDecl = z.object({
  /** Manifest-local id referenced by `*AssetId` fields and `{ $asset }` body refs. */
  id: ManifestId,
  url: AbsoluteUrl,
  alt: z.string().max(512).optional(),
  width: z.number().int().positive().max(100_000).optional(),
  height: z.number().int().positive().max(100_000).optional(),
  mimeType: z.string().max(127).optional(),
});
export type AssetDecl = z.infer<typeof AssetDecl>;

// ── Brand + theme ─────────────────────────────────────────────────────────────

export const BrandDecl = z.object({
  businessName: z.string().min(1).max(255),
  tagline: z.string().max(255).optional(),
  colors: z.object({
    primary: Hex,
    primaryForeground: Hex.optional(),
    accent: Hex.optional(),
    accentForeground: Hex.optional(),
    secondary: Hex.optional(),
    secondaryForeground: Hex.optional(),
  }),
  fonts: z.object({
    heading: z.string().min(1).max(127),
    body: z.string().min(1).max(127),
  }),
  logoLightAssetId: ManifestId.optional(),
  logoDarkAssetId: ManifestId.optional(),
  faviconAssetId: ManifestId.optional(),
});
export type BrandDecl = z.infer<typeof BrandDecl>;

// A blueprint ships its OWN named theme (docs/54 §3 D5): the installer creates a
// tenant SiteTheme — a `basePresetKey` (one of the code-first presets) plus a
// Token Model v2 `presentation` overlay and an optional brand `look` snapshot —
// then applies it. This is data, not a code preset, so it installs without a
// deploy and stays fully editable afterward (savedThemeService.create + apply).
// Reuses CreateSavedThemeInput verbatim so the manifest validates exactly as the
// theme service does, plus an `apply` flag.
export const ThemeDecl = CreateSavedThemeInput.extend({
  /** Apply this new theme on install — set it as the working theme and apply its
   *  brand look. Default true: a blueprint ships a theme in order to use it. */
  apply: z.boolean().default(true),
});
export type ThemeDecl = z.infer<typeof ThemeDecl>;

// ── Content (docs/51) ─────────────────────────────────────────────────────────

const ContentTypeKey = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-z0-9_]*$/, 'Content type keys are lowercase with underscores.');

/** A custom content type to create on install. Most blueprints omit this and
 *  lean on the built-in types (page, blog_post, …). */
export const ContentTypeDecl = z.object({
  key: ContentTypeKey,
  name: z.string().min(1).max(120),
  pluralName: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  urlPattern: z.string().max(255).optional(),
  icon: z.string().max(64).optional(),
  isSingleton: z.boolean().optional(),
  schema: ContentTypeSchema,
});
export type ContentTypeDecl = z.infer<typeof ContentTypeDecl>;

const ContentSeoDecl = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(512).optional(),
  canonical: z.string().max(2048).optional(),
  robots: z.string().max(120).optional(),
  ogImageAssetId: ManifestId.optional(),
});

/** A content entry (e.g. a blog post). `body` is opaque here and validated at
 *  install against its content type's schema; `asset`-typed fields inside it use
 *  a `{ $asset: '<id>' }` ref (see ./refs). Default status draft (docs/54 D4). */
export const ContentEntryDecl = z.object({
  typeKey: ContentTypeKey,
  slug: z.string().max(255).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  body: z.record(z.string(), z.unknown()),
  seo: ContentSeoDecl.optional(),
});
export type ContentEntryDecl = z.infer<typeof ContentEntryDecl>;

// ── Commerce (docs/09) ────────────────────────────────────────────────────────

export const CategoryDecl = z.object({
  handle: Handle,
  name: z.string().min(1).max(127),
  description: z.string().max(10_000).optional(),
  /** Parent category by handle; the installer computes the materialized path. */
  parentHandle: Handle.optional(),
  position: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  iconAssetId: ManifestId.optional(),
  heroAssetId: ManifestId.optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(512).optional(),
  ogImageAssetId: ManifestId.optional(),
});
export type CategoryDecl = z.infer<typeof CategoryDecl>;

export const CollectionDecl = z.object({
  handle: Handle,
  name: z.string().min(1).max(127),
  description: z.string().max(10_000).optional(),
  type: CollectionType.default('manual'),
  ruleSet: CollectionRuleSet.optional(), // required when type=rules
  /** Manual membership by product handle (ignored for rules collections). */
  productHandles: z.array(Handle).max(5000).default([]),
  heroAssetId: ManifestId.optional(),
  featured: z.boolean().default(false),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(512).optional(),
  ogImageAssetId: ManifestId.optional(),
});
export type CollectionDecl = z.infer<typeof CollectionDecl>;

export const ProductOptionValueDecl = z.object({
  value: z.string().min(1).max(127),
  swatchHex: Hex.optional(),
  swatchImageAssetId: ManifestId.optional(),
  position: z.number().int().nonnegative().default(0),
});
export type ProductOptionValueDecl = z.infer<typeof ProductOptionValueDecl>;

export const ProductOptionDecl = z.object({
  name: z.string().min(1).max(63),
  displayType: OptionDisplayType.default('dropdown'),
  position: z.number().int().nonnegative().default(0),
  values: z.array(ProductOptionValueDecl).min(1).max(250),
});
export type ProductOptionDecl = z.infer<typeof ProductOptionDecl>;

export const VariantDecl = z.object({
  sku: Sku,
  barcode: Barcode.optional(),
  title: z.string().max(255).optional(),
  /** Maps the variant onto the option lattice: optionName → value. Must name a
   *  declared option + value on the parent product, one entry per option. */
  optionValues: z.record(z.string(), z.string()).default({}),
  priceCents: MoneyCents,
  compareAtPriceCents: MoneyCents.optional(),
  costCents: MoneyCents.optional(),
  currency: Currency.default('USD'),
  weight: WeightGrams.optional(),
  dimensions: Dimensions.optional(),
  inventoryPolicy: InventoryPolicy.default('deny'),
  requiresShipping: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  position: z.number().int().nonnegative().default(0),
});
export type VariantDecl = z.infer<typeof VariantDecl>;

export const ProductImageDecl = z.object({
  assetId: ManifestId,
  /** Pin to a variant by SKU; product-level when omitted. */
  variantSku: Sku.optional(),
  /** Pin to option values (optionName → value), e.g. show when Color=Red. */
  optionValues: z.record(z.string(), z.string()).default({}),
  position: z.number().int().nonnegative().default(0),
  alt: z.string().max(512).optional(),
  isPrimary: z.boolean().default(false),
});
export type ProductImageDecl = z.infer<typeof ProductImageDecl>;

export const ProductDecl = z.object({
  handle: Handle,
  title: z.string().min(1).max(255),
  description: z.string().max(50_000).optional(), // HTML allowed
  status: ProductStatus.default('draft'),
  productType: z.string().max(127).optional(),
  vendor: z.string().max(127).optional(),
  tags: z.array(z.string().min(1).max(63)).max(50).default([]),
  fulfillmentType: FulfillmentType.default('physical'),
  weight: WeightGrams.optional(),
  dimensions: Dimensions.optional(),
  taxClass: z.string().max(63).optional(),
  requiresShipping: z.boolean().default(true),
  categoryHandles: z.array(Handle).max(20).default([]),
  collectionHandles: z.array(Handle).max(50).default([]),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(512).optional(),
  ogImageAssetId: ManifestId.optional(),
  options: z.array(ProductOptionDecl).max(8).default([]),
  variants: z.array(VariantDecl).min(1).max(1000),
  images: z.array(ProductImageDecl).max(50).default([]),
});
export type ProductDecl = z.infer<typeof ProductDecl>;

export const CommerceDecl = z.object({
  categories: z.array(CategoryDecl).max(500).default([]),
  collections: z.array(CollectionDecl).max(200).default([]),
  products: z.array(ProductDecl).max(1000).default([]),
});
export type CommerceDecl = z.infer<typeof CommerceDecl>;

// ── Builder: components, layout, pages (docs/40, 41, 45, 53) ───────────────────

/** A tenant component to create on install (docs/53). Tree + propSpec are the
 *  same shape `componentService.create` takes; pages may place it via a
 *  `custom:<key>` node. */
export const ComponentDecl = z.object({
  key: ComponentKey,
  name: z.string().min(1).max(120),
  group: ComponentGroup.default('content'),
  icon: z.string().max(64).default('box'),
  description: z.string().max(500).optional(),
  surfaces: z.array(ComponentSurface).min(1).default(['page']),
  tree: BuilderNodeSchema,
  propSpec: PropSpecListSchema.default([]),
});
export type ComponentDecl = z.infer<typeof ComponentDecl>;

/** The site chrome (header · Outlet · footer). Becomes the property's active
 *  layout unless `makeActive` is false (or the property already has one). */
export const LayoutDecl = z.object({
  name: z.string().min(1).max(255),
  tree: BuilderNodeSchema,
  makeActive: z.boolean().default(true),
});
export type LayoutDecl = z.infer<typeof LayoutDecl>;

export const PageDecl = z.object({
  name: z.string().min(1).max(255),
  kind: BuilderPageKind.default('singleton'),
  /** Collection pages target a recordType (e.g. cms.blog_post, commerce.product). */
  recordType: z.string().max(63).optional(),
  /** Singleton route slug (e.g. about, contact). */
  slug: PageSlug.optional(),
  tree: BuilderNodeSchema,
  /** Make this the default template for its recordType (collection pages only). */
  isDefault: z.boolean().default(false),
  // Singleton SEO (raw URL for ogImage — hot-linked, not a MediaAsset).
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(500).optional(),
  canonical: z.string().max(2048).optional(),
  ogImage: z.string().max(2048).optional(),
  noindex: z.boolean().optional(),
});
export type PageDecl = z.infer<typeof PageDecl>;

// ── Email (docs/52) ────────────────────────────────────────────────────────────

export const EmailDecl = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().max(255).optional(),
  preheader: z.string().max(255).optional(),
  tree: BuilderNodeSchema,
  /** Publish on install. Default false — installs leave emails draft (docs/54 D4). */
  publish: z.boolean().default(false),
});
export type EmailDecl = z.infer<typeof EmailDecl>;

// ── The Blueprint ──────────────────────────────────────────────────────────────

export const BlueprintSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers, and internal hyphens.'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use semver (x.y.z).'),
  name: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  vertical: BlueprintVertical,
  // A marketplace preview image (a screenshot of the installed site). Rendered on
  // the browse/detail card (docs/54 §9). A site-absolute path (served from the
  // dashboard's public/) or an absolute URL.
  preview: z.string().min(1).max(1024).optional(),
  requiresModules: z.array(BlueprintModuleSlug).min(1),
  brand: BrandDecl,
  theme: ThemeDecl,
  assets: z.array(AssetDecl).max(500).default([]),
  contentTypes: z.array(ContentTypeDecl).max(50).default([]),
  content: z.array(ContentEntryDecl).max(500).default([]),
  commerce: CommerceDecl.optional(),
  components: z.array(ComponentDecl).max(100).default([]),
  layout: LayoutDecl.optional(),
  pages: z.array(PageDecl).max(200).default([]),
  emails: z.array(EmailDecl).max(100).default([]),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;

/** The catalog-row view of a blueprint — identity without the heavy body. The
 *  marketplace browse list renders these (docs/54 §9). */
export interface BlueprintSummary {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: BlueprintVertical;
  preview?: string;
  requiresModules: BlueprintModuleSlug[];
}

export function toSummary(bp: Blueprint): BlueprintSummary {
  return {
    key: bp.key,
    version: bp.version,
    name: bp.name,
    summary: bp.summary,
    vertical: bp.vertical,
    ...(bp.preview ? { preview: bp.preview } : {}),
    requiresModules: bp.requiresModules,
  };
}
