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
    BuilderPageKind,
    PageSlug,
    SilicaEmailDocumentInput,
    SilicaThemeInput,
    SilicaTreeInput,
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
    ProductTypeKey,
    ProductTypeSchema,
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

/** An asset source — an absolute http(s) URL (hot-linked, docs/54 §6 D3) OR a
 *  self-contained `data:image/...` URI for reliable, network-free blueprint imagery
 *  (SVG placeholders, logos). The public media route serves data assets inline; the
 *  scheme is pinned to `image/` so a blueprint can't smuggle `data:text/html`. */
const AssetUrl = z
    .string()
    .max(32_768)
    .refine(
        (u) => /^https?:\/\//i.test(u) || /^data:image\//i.test(u),
        'Must be an absolute http(s) URL or a data:image/... URI.'
    );

/** The modules a blueprint can require / provision for. Mirrors @sparx/auth's
 *  ModuleSlug (kept independent so this package stays DB-free). */
export const BlueprintModuleSlug = z.enum([
    'builder',
    'commerce',
    'cms',
    'crm',
    'email',
    'scheduling',
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
    url: AssetUrl,
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
    // Example social links the install seeds into the site's per-site links
    // (Property.settings.socials) so the footer's SocialLinks renders out of the box.
    // Placeholder handles the tenant swaps post-install (like the placeholder imagery);
    // the installer only seeds them when the site has none, never clobbering edits.
    socials: z
        .array(
            z.object({
                platform: z.string().min(1).max(40),
                url: z.string().min(1).max(500),
            })
        )
        .max(12)
        .optional(),
});
export type BrandDecl = z.infer<typeof BrandDecl>;

// A blueprint ships its OWN named theme (docs/54 §3 D5): the installer creates a
// tenant SiteTheme — a `basePresetKey` (a theme sparx ships, @sparx/silica-catalog) plus a
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

/** A byline persona a blueprint ships (docs/131 §4 — an Author is a PUBLIC persona, not
 *  a login). Referenced by a content entry's `authorSlug`. The installer creates one CMS
 *  `Author` per decl, scoped to the installed site, and reconciles by `slug` on reinstall.
 *  `avatarAssetId` is a manifest asset id (`{ $asset }`-style), resolved to the installed
 *  MediaAsset like every other asset ref — so a byline can carry a real portrait. */
export const AuthorDecl = z.object({
    slug: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers, and internal hyphens.'),
    displayName: z.string().min(1).max(255),
    bio: z.string().max(2000).optional(),
    avatarAssetId: ManifestId.optional(),
});
export type AuthorDecl = z.infer<typeof AuthorDecl>;

/** A content entry (e.g. a blog post). `body` is opaque here and validated at
 *  install against its content type's schema; `asset`-typed fields inside it use
 *  a `{ $asset: '<id>' }` ref (see ./refs). Default status draft (docs/54 D4).
 *
 *  `authorSlug` names one of the blueprint's `authors`; `categories`/`tags` are term
 *  NAMES (not slugs — the installer slugifies) filed under the `blog_category` /
 *  `blog_tag` vocabularies the storefront byline projection reads. All three are optional
 *  and only meaningful for CMS types with those relations (a `blog_post`); a non-CMS or
 *  author-less entry simply omits them and installs exactly as before. */
export const ContentEntryDecl = z.object({
    typeKey: ContentTypeKey,
    slug: z.string().max(255).optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    body: z.record(z.string(), z.unknown()),
    seo: ContentSeoDecl.optional(),
    authorSlug: z.string().max(255).optional(),
    categories: z.array(z.string().min(1).max(255)).max(20).optional(),
    tags: z.array(z.string().min(1).max(255)).max(50).optional(),
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

/** A blueprint-declared PRODUCT TYPE (docs/143) — the commerce mirror of
 *  ContentTypeDecl. A blueprint ships its own typed product type(s) with an attribute
 *  schema, exactly as it ships content types; the installer upserts them by
 *  (tenant, key) before products so a product's `attributes` bag validates. Author a
 *  built-in key (`apparel`, `cosmetics`, …) to reuse a platform type, or a fresh key +
 *  schema for a bespoke vertical. */
export const ProductTypeDecl = z.object({
    key: ProductTypeKey,
    name: z.string().min(1).max(127),
    pluralName: z.string().min(1).max(127).optional(),
    description: z.string().max(2000).optional(),
    icon: z.string().max(63).optional(),
    attributeSchema: ProductTypeSchema,
});
export type ProductTypeDecl = z.infer<typeof ProductTypeDecl>;

export const ProductDecl = z.object({
    handle: Handle,
    title: z.string().min(1).max(255),
    description: z.string().max(50_000).optional(), // HTML allowed
    status: ProductStatus.default('draft'),
    productType: z.string().max(127).optional(),
    /** The typed product-type link (docs/143) — a ProductTypeDecl key (or a built-in).
     *  When set, `attributes` is validated against that type's schema at install. */
    productTypeKey: ProductTypeKey.optional(),
    /** The typed attribute bag — validated against the resolved product type at install
     *  (422 on mismatch, exactly like a content entry body). Opaque here. */
    attributes: z.record(z.string(), z.unknown()).optional(),
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

// ── Scheduling (docs/79) ───────────────────────────────────────────────────────
//
// A booking-backed service business — the spine that makes a "services" blueprint
// FUNCTION, not just look the part (a real service menu with durations + prices, the
// staff/rooms/stations a booking consumes, weekly hours, deposit/cancellation
// policy). The installer maps each decl to the scheduling service layer
// (`createBookingPolicy` → `createResource` + `setAvailabilityWindows` → `createService`),
// resolving handles → ids and attaching the module-activation-seeded 'Main location'.
// References are by HANDLE like the rest of the manifest.
//
// The enums below MIRROR @sparx/scheduling-schemas' column value sets, kept inline so
// this package stays dependency-light + DB-free (exactly as BlueprintModuleSlug mirrors
// ModuleSlug). The installer re-validates every mapped value against the domain's own
// CreateService/Resource/Policy inputs before writing, so drift is caught at install.

const SchedResourceKind = z.enum(['staff', 'asset', 'table', 'space', 'equipment']);
const SchedBookingType = z.enum(['appointment', 'class', 'reservation', 'rental']);
const SchedAssignmentStrategy = z.enum([
    'any_available',
    'round_robin',
    'collective',
    'customer_choice',
]);
const SchedDepositType = z.enum(['none', 'card_hold', 'deposit', 'prepay']);

/** A required-resource role on a service (stored in the service's
 *  `resource_requirements` JSONB) — the slot engine matches a free resource per role by
 *  `kind` + `skillTags` at booking time. Mirrors scheduling-schemas' ResourceRequirement. */
export const SchedulingResourceRequirementDecl = z.object({
    role: z.string().min(1).max(40),
    kind: SchedResourceKind,
    skillTags: z.array(z.string().min(1).max(63)).max(20).default([]),
    count: z.number().int().min(1).max(20).default(1),
});
export type SchedulingResourceRequirementDecl = z.infer<typeof SchedulingResourceRequirementDecl>;

/** One recurring weekly availability window for a resource — minutes from local
 *  midnight, `dayOfWeek` 0=Sun..6=Sat. Maps to an `AvailabilityWindow` row. */
export const SchedulingWindowDecl = z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
});
export type SchedulingWindowDecl = z.infer<typeof SchedulingWindowDecl>;

/** A bookable resource — a stylist (`staff`), a treatment room (`space`), a nail
 *  station (`table`), a bay (`equipment`)… A service's `resourceRequirements` match
 *  resources by `kind` + `skillTags`, so the link is capability-based, not by id. */
export const SchedulingResourceDecl = z.object({
    handle: Handle,
    name: z.string().min(1).max(255),
    kind: SchedResourceKind,
    skillTags: z.array(z.string().min(1).max(63)).max(50).default([]),
    capacity: z.number().int().min(1).max(100_000).default(1),
    capacityMin: z.number().int().min(1).max(100_000).optional(),
    capacityMax: z.number().int().min(1).max(100_000).optional(),
    /** IANA zone the weekly windows are authored in (the engine resolves DST). */
    timezone: z.string().min(1).max(64).default('UTC'),
    bookableOnline: z.boolean().default(true),
    imageAssetId: ManifestId.optional(),
    windows: z.array(SchedulingWindowDecl).max(100).default([]),
    /** A `SchedulingLocationDecl` handle — where this person or thing works.
     *  Omitted = the blueprint's first declared location, or the tenant's seeded
     *  'Main location' when it declares none. */
    locationHandle: Handle.optional(),
});
export type SchedulingResourceDecl = z.infer<typeof SchedulingResourceDecl>;

/** A PLACE the business serves from — the shop floor, the treatment room block,
 *  the yard. Declared so a design brings its own premises instead of piling onto
 *  whatever location the tenant already had: install a barber design on one site
 *  and a grooming design on another, and each business gets its own place, scoped
 *  to its own site, rather than both sharing the seeded 'Main location'.
 *
 *  DELIBERATELY NO ADDRESS. A blueprint cannot know where the business actually
 *  is, and an invented street address reads as real — the same rule the contact
 *  spine follows, where an unfilled field renders nothing rather than a plausible
 *  lie. The owner fills the address in on the Places surface; the blueprint only
 *  supplies the NAME and the zone, which are safe to guess and easy to correct. */
export const SchedulingLocationDecl = z.object({
    handle: Handle,
    name: z.string().min(1).max(255),
    /** IANA zone the place is in. Same default as a resource's. */
    timezone: z.string().min(1).max(64).default('UTC'),
});
export type SchedulingLocationDecl = z.infer<typeof SchedulingLocationDecl>;

/** A deposit / cancellation / reminder policy a service attaches to by `handle`.
 *  Omit and a service uses no policy (the activation-seeded 'Standard' still exists). */
export const SchedulingPolicyDecl = z.object({
    handle: Handle,
    name: z.string().min(1).max(255),
    depositType: SchedDepositType.default('none'),
    depositAmountCents: MoneyCents.optional(),
    depositPercent: z.number().int().min(0).max(100).optional(),
    cancellationWindowHours: z.number().int().min(0).max(8760).default(24),
    policyText: z.string().max(20_000).optional(),
    /** Minutes-before-start to remind, e.g. `[1440, 120]` = 24h + 2h. */
    reminderOffsetsMin: z.array(z.number().int().min(0).max(43_200)).max(10).default([1440, 120]),
});
export type SchedulingPolicyDecl = z.infer<typeof SchedulingPolicyDecl>;

/** A bookable service — the menu row a visitor picks on `/book`. `resourceRequirements`
 *  (the domain's own shape) name the roles a booking must fill by kind + skill. */
export const SchedulingServiceDecl = z.object({
    handle: Handle,
    name: z.string().min(1).max(255),
    description: z.string().max(10_000).optional(),
    bookingType: SchedBookingType.default('appointment'),
    durationMinutes: z
        .number()
        .int()
        .min(1)
        .max(60 * 24 * 30)
        .default(60),
    bufferBeforeMin: z.number().int().min(0).max(1440).default(0),
    bufferAfterMin: z.number().int().min(0).max(1440).default(0),
    priceCents: MoneyCents.default(0),
    /** ISO-4217 lowercase (the scheduling column form, e.g. 'usd'). */
    currency: z.string().length(3).default('usd'),
    /** >1 = a class roster; appointments/reservations/rentals keep 1. */
    capacity: z.number().int().min(1).max(100_000).default(1),
    slotIntervalMin: z.number().int().min(1).max(1440).default(15),
    minLeadMinutes: z.number().int().min(0).default(0),
    maxAdvanceDays: z.number().int().min(0).max(3650).default(365),
    assignmentStrategy: SchedAssignmentStrategy.default('any_available'),
    resourceRequirements: z.array(SchedulingResourceRequirementDecl).max(20).default([]),
    /** A `SchedulingPolicyDecl` handle; omitted = no attached policy. */
    policyHandle: Handle.optional(),
    /** A `SchedulingLocationDecl` handle — where this service is delivered.
     *  Omitted = the blueprint's first declared location, else the seeded one. */
    locationHandle: Handle.optional(),
    bookableOnline: z.boolean().default(true),
    requiresApproval: z.boolean().default(false),
    imageAssetId: ManifestId.optional(),
});
export type SchedulingServiceDecl = z.infer<typeof SchedulingServiceDecl>;

export const SchedulingDecl = z.object({
    /** The places this business serves from. Empty = the design brings no premises
     *  of its own and everything files against the tenant's seeded 'Main location',
     *  which is the right answer for a single-premises business. */
    locations: z.array(SchedulingLocationDecl).max(20).default([]),
    policies: z.array(SchedulingPolicyDecl).max(20).default([]),
    resources: z.array(SchedulingResourceDecl).max(100).default([]),
    services: z.array(SchedulingServiceDecl).min(1).max(200),
});
export type SchedulingDecl = z.infer<typeof SchedulingDecl>;

// ── The site: frame, pages, theme, symbols (docs/118) ──────────────────────────
//
// SILICA-NATIVE, and only silica. A blueprint's authored trees are the same
// `Node` documents the studio editor and the MCP authoring tools emit, and the
// installer writes them straight through `siteService.installSite` — the same
// seam a human author's save goes through.
//
// The legacy `BuilderNode` manifest (a `layout` + flat `pages[]`, converted to
// silica at go-live by a best-effort bridge) is GONE. It could only ever express
// what the converter could translate, so a template authored in the real editor
// lost exactly the things that made it good — color bands, arbitrary utility
// classes, host cores, attribute bindings — on the way into a bundle. Authoring
// and installing now share one shape, so a captured site reinstalls byte-identical.

/** A site-global saved component — silica's `SymbolDef`, keyed by symbol id. Kept
 *  opaque (silica owns the shape) and passed through to `sync` verbatim, exactly
 *  as the editor's own `symbols` map is. Replaces the legacy per-tenant
 *  `ComponentDecl`, whose `custom:<key>` placement node has no silica analogue —
 *  a silica page inlines a symbol instance instead. */
export const SiteSymbolsDecl = z.record(z.string(), z.unknown());
export type SiteSymbolsDecl = z.infer<typeof SiteSymbolsDecl>;

/** One page of the site. `root` is the page's full silica body tree (the same
 *  document `siteService.load` returns), NOT a list of sections — a captured page
 *  round-trips without being re-wrapped. No `id`: the manifest cannot know runtime
 *  UUIDs (the handle-not-id rule), so the installer mints one per page. */
export const SitePageDecl = z.object({
    name: z.string().min(1).max(255),
    kind: BuilderPageKind.default('singleton'),
    /** Collection pages target a recordType (e.g. cms.blog_post, commerce.product). */
    recordType: z.string().max(63).optional(),
    /** A `commerce.product` page's product-TYPE target (docs/143 Option B) — the type
     *  key this page designs (`apparel`, …); omitted = the default product page. */
    recordSubtype: z.string().max(63).optional(),
    /** Route slug; `''` (or omitted) is the home page. */
    slug: PageSlug.optional(),
    root: SilicaTreeInput,
    /** Make this the default template for its recordType (collection pages only). */
    isDefault: z.boolean().default(false),
    // SEO (raw URL for ogImage — hot-linked, not a MediaAsset).
    seoTitle: z.string().max(255).optional(),
    seoDescription: z.string().max(500).optional(),
    canonical: z.string().max(2048).optional(),
    ogImage: z.string().max(2048).optional(),
    noindex: z.boolean().optional(),
});
export type SitePageDecl = z.infer<typeof SitePageDecl>;

/** The whole authored site: the shared chrome frame, every page, the authored
 *  theme, and the saved-component symbols. Mirrors `StoredSilicaSite` — what
 *  `siteService.load`/`getPublishedSite` hand back — so capturing a live site into
 *  a bundle is a projection, not a translation.
 *
 *  `theme` is optional: omitting it lets the installing tenant's own brand-derived
 *  theme stand, which is what makes one template re-skin per tenant. Include it
 *  only when the design genuinely depends on specific tokens. */
export const SiteDecl = z.object({
    frame: z.object({ root: SilicaTreeInput }).optional(),
    pages: z.array(SitePageDecl).min(1).max(200),
    theme: SilicaThemeInput.optional(),
    symbols: SiteSymbolsDecl.optional(),
});
export type SiteDecl = z.infer<typeof SiteDecl>;

// ── Email (docs/52, docs/120) ──────────────────────────────────────────────────

/** A marketing email. `doc` is a silica `EmailDocument` — the shape the email
 *  editor saves and `renderSilicaEmail` sends. Silica owns `subject`/`preheader`
 *  inside the document; the row mirrors them, so they are not duplicated here. */
export const EmailDecl = z.object({
    name: z.string().min(1).max(255),
    doc: SilicaEmailDocumentInput,
    /** Publish on install. Default false — installs leave emails draft (docs/54 D4). */
    publish: z.boolean().default(false),
});
export type EmailDecl = z.infer<typeof EmailDecl>;

// ── Email sequences (docs/81 §9) ────────────────────────────────────────────────
/** One step of a blueprint sequence. References a blueprint EMAIL by its `name`
 *  (the installer resolves it to the created Builder email's id). `delaySeconds`
 *  is the wait before this step (0 on the first = send on enrol). */
export const SequenceStepDecl = z.object({
    emailName: z.string().min(1).max(255),
    delaySeconds: z
        .number()
        .int()
        .min(0)
        .max(365 * 24 * 60 * 60),
    emailType: z.enum(['transactional', 'marketing']).default('marketing'),
    name: z.string().max(255).optional(),
});
export type SequenceStepDecl = z.infer<typeof SequenceStepDecl>;

/** A reusable multi-touch journey. Steps reference blueprint emails by name.
 *  `activate` installs it live (draining) vs draft — default false, like email publish. */
export const SequenceDecl = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    reentryPolicy: z.enum(['once', 'always']).default('once'),
    exitOnPurchase: z.boolean().default(false),
    activate: z.boolean().default(false),
    steps: z.array(SequenceStepDecl).min(1).max(25),
});
export type SequenceDecl = z.infer<typeof SequenceDecl>;

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
    /** Byline personas the content entries reference by `authorSlug` (docs/131 §4).
     *  Installed as CMS `Author` rows scoped to the site; empty for a blueprint whose
     *  posts carry no byline. */
    authors: z.array(AuthorDecl).max(200).default([]),
    content: z.array(ContentEntryDecl).max(500).default([]),
    /** Typed product types (docs/143) — shipped like content types, installed (upsert by
     *  key) before products so a product's `attributes` bag validates against its type. */
    productTypes: z.array(ProductTypeDecl).max(50).default([]),
    commerce: CommerceDecl.optional(),
    /** A booking-backed service business (docs/79) — policies, resources, weekly hours,
     *  and a bookable service menu. Present → the install provisions a working booking
     *  flow (the `/book` widget renders it live). Requires the `scheduling` module. */
    scheduling: SchedulingDecl.optional(),
    /** The authored silica site (frame + pages + theme + symbols). Optional so a
     *  commerce/content-only blueprint (no hosted site) stays expressible. */
    site: SiteDecl.optional(),
    emails: z.array(EmailDecl).max(100).default([]),
    sequences: z.array(SequenceDecl).max(20).default([]),
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
