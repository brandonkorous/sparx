// Sample-data contract (docs/104, Wave 5).
//
// A `SampleDataPack` is pure data-as-code: the fully-realised demo experience for
// one industry (`settings.industry`). Loading a pack populates a tenant with a real
// product catalog, long-form articles, customers, orders, reviews, Q&A, bookings,
// quotes — everything an empty tenant lacks — so "Load sample data" makes the whole
// product feel alive. Authored once here; applied by BOTH the dev/e2e seed and the
// production load/clear seam (services/api-rest/src/lib/sample-data.ts).
//
// Two hard invariants the engine enforces (NOT the pack author's job):
//   1. A pack NEVER flips `settings.modules` — only the user enables a module.
//   2. A slice for a DISABLED module inserts nothing (the engine gates every
//      module's writes on the enabled set it's handed).
//
// Everything a pack creates is identifiable for a clean Clear without a schema
// change — see ./markers.ts (handle/slug prefixes, `metadata.sample`, `source`,
// scheduling `settings.sample`). The engine generates the COMBINATORIAL structure
// (order lifecycle spread, return flows, booking instances, quote/deal pipelines,
// inventory ledger history) from authored primitives so a pack stays prose-and-
// numbers, not a wall of row literals.

/** A reason+delta+age tuple replayed into the inventory ledger (newest balance
 *  is the running sum). `reason`: receive | sale | recount | transfer_in | loss. */
export interface SampleMovement {
  delta: number;
  reason: string;
  daysAgo: number;
}

/** One stock position for a variant at a warehouse. Σ(movements.delta) == on-hand;
 *  the engine replays them oldest→newest so `balanceAfter` stays consistent. */
export interface SampleStockLevel {
  warehouseKey: string;
  reorderPoint?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;
  movements: SampleMovement[];
}

/** A purchasable SKU. `key` is an author cross-ref handle (bundles/configurator
 *  reference it); the real SKU is `sku`. `cost`/`price` are integer cents. */
export interface SampleVariant {
  key?: string;
  sku: string;
  title: string | null;
  priceCents: number;
  compareAtPriceCents?: number;
  costCents: number;
  /** When the product declares `options`, the option VALUES this variant pins
   *  (e.g. `['Red', 'M']`) — wires the storefront variant picker. */
  optionValues?: string[];
  /** Inventory positions — applied only when the `inventory` module is on. */
  stock?: SampleStockLevel[];
}

/** A product option (Color, Size, …) with its values. Optional swatch hex. */
export interface SampleOption {
  name: string;
  displayType?: string; // dropdown | swatch | radio | segmented
  values: { value: string; swatchHex?: string }[];
}

/** An authored product review — real text + rating, not lorem. `authorPersona`
 *  (a persona key) links the review to a settled order for the verified-purchase
 *  badge; omit for a guest/anonymous review and set `displayName`. */
export interface SampleReview {
  rating: number; // 1–5
  title: string;
  body: string;
  displayName?: string;
  authorPersona?: string;
  status?: 'approved' | 'pending' | 'flagged' | 'rejected'; // default approved
  response?: string; // merchant reply
  helpfulCount?: number;
  daysAgo?: number;
}

/** An authored Q&A pair. `answer` (when present) is an official merchant answer. */
export interface SampleQuestion {
  body: string;
  displayName?: string;
  authorPersona?: string;
  status?: 'published' | 'pending' | 'rejected'; // default published
  answer?: string;
  daysAgo?: number;
}

/** A fully-authored product: rich HTML description, options/variants, stock, and
 *  its own reviews + Q&A. `key` is an author cross-ref handle used by bundles,
 *  the configurator, and order biasing. */
export interface SampleProduct {
  key: string;
  title: string;
  handle: string; // engine prefixes with `sample-`
  /** Rich HTML — rendered verbatim on the PDP. Write real, in-depth copy. */
  description: string;
  productType: string;
  vendor: string;
  tags?: string[];
  hazmatClass?: string;
  fulfillmentType?: string; // physical (default) | digital | service | …
  seoTitle?: string;
  seoDescription?: string;
  options?: SampleOption[];
  variants: SampleVariant[];
  categoryKeys?: string[];
  collectionKeys?: string[];
  reviews?: SampleReview[];
  questions?: SampleQuestion[];
  /** When `inventory` is off, this sets the storefront in-stock flag directly
   *  (default true). With inventory on, in-stock derives from the ledger. */
  inStock?: boolean;
  /** Hero image. Omit and the engine generates a branded SVG data-URI (industry
   *  hue + an emoji derived from title/type) — reliable, network-free, swappable
   *  for real photography post-load. Provide a URL or data-URI to override. */
  image?: string;
  /** Emoji used in the generated SVG hero (overrides keyword derivation). */
  emoji?: string;
}

/** A merchandising collection. Products opt in via `collectionKeys`. */
export interface SampleCollection {
  key: string;
  name: string;
  handle: string;
  description?: string;
  featured?: boolean;
}

/** An organizational category (one level; `parentKey` nests). Products opt in via
 *  `categoryKeys`. Note: the Wave-3 industry STARTER also installs a category
 *  taxonomy — a pack's categories are the ones its sample products actually sit in,
 *  created find-or-create by handle so the two never collide. */
export interface SampleCategory {
  key: string;
  name: string;
  handle: string;
  parentKey?: string;
  description?: string;
  featured?: boolean;
}

/** A warehouse for inventory stock. Applied only when `inventory` is on. */
export interface SampleWarehouse {
  key: string;
  code: string;
  name: string;
  type?: string; // owned | 3pl | …
  city?: string;
  region?: string;
}

/** A lot/batch for a tracked variant (expiry, hazmat, recall demo). Applied only
 *  when `inventory` is on. */
export interface SampleLot {
  variantKey: string;
  warehouseKey: string;
  lotNumber: string;
  quantity: number;
  /** Days until expiry (negative = already expired); omit for non-perishable. */
  expiresInDays?: number;
  hazmatClass?: string;
  /** A recall reason → an active recall on the lot. */
  recall?: string;
}

/** A supplier + the variants it sources (purchasing links + demo POs are derived).
 *  Applied only when `inventory` is on. */
export interface SampleSupplier {
  code: string;
  name: string;
  paymentTerms?: string; // net30 | net45 | …
  leadTimeDays?: number;
  city?: string;
  region?: string;
  /** Variant keys this supplier sources (must reference SampleVariant.key). */
  variantKeys: string[];
}

/** A buyer persona — drives generated customers, orders, bookings, quotes, and
 *  verified reviews. `kind` selects the spine: retail customer vs B2B account. */
export interface SamplePersona {
  key: string;
  /** Full display name. The engine splits on the first space for first/last. */
  name: string;
  email: string; // engine rewrites the domain to the sample domain
  kind?: 'retail' | 'b2b'; // default retail
  company?: string;
  phone?: string;
  line1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string; // default US
}

/** A long-form CMS article. `body` is a TipTap doc (use the `doc`/`p`/`h2`/… kit
 *  in ./engine/prose.ts). Rendered as a real blog post. */
export interface SampleArticle {
  typeKey?: string; // default 'blog_post'
  slug: string; // engine prefixes with `sample-`
  title: string;
  excerpt: string;
  /** TipTap document: { type: 'doc', content: [...] }. */
  body: unknown;
  status?: 'published' | 'draft'; // default published
  daysAgo?: number;
  /** Featured/cover image. Omit and the engine generates a branded SVG data-URI
   *  (industry hue + emoji). Provide a URL or data-URI to override. */
  image?: string;
  /** Emoji used in the generated SVG cover (overrides keyword derivation). */
  emoji?: string;
}

/** A bookable service (scheduling). Applied only when `scheduling` is on. */
export interface SampleService {
  key: string;
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents?: number;
  capacity?: number; // >1 = class/group
  bookingType?: string; // appointment | class | reservation | rental
  bufferAfterMin?: number;
  slotIntervalMin?: number;
  requiresApproval?: boolean;
  /** Resource roles this service consumes, e.g.
   *  [{ role: 'stylist', kind: 'staff', skill: 'haircut' }]. The engine matches
   *  each role to a resource (by skill, else by kind) for the generated bookings. */
  resourceRoles?: { role: string; kind?: string; skill?: string }[];
}

/** A schedulable resource (staff, room, table, equipment). */
export interface SampleResource {
  key: string;
  name: string;
  kind: string; // staff | space | table | equipment
  skills?: string[];
  capacityMin?: number;
  capacityMax?: number;
  /** Weekly availability windows (0=Sun … 6=Sat; minutes from midnight). */
  windows?: { day: number; startMin: number; endMin: number }[];
}

export interface SampleScheduling {
  services: SampleService[];
  resources: SampleResource[];
}

/** Turns an existing pack product into a multi-product bundle. `wrapperProductKey`
 *  is the product the bundle is sold AS; `components` reference other products
 *  (their default variant). Applied only when `commerce` is on. */
export interface SampleBundle {
  wrapperProductKey: string;
  /** Pricing: fixed cents, a percent discount on the component sum, or sum-of-parts. */
  pricing:
    | { mode: 'fixed'; priceCents: number }
    | { mode: 'percent'; percentOff: number }
    | { mode: 'sum' };
  inventoryMode?: 'components' | 'bundle';
  components: { productKey: string; quantity?: number; required?: boolean; swappable?: boolean }[];
}

/** A configurator template pinned to one product. Applied only when `commerce` is on. */
export interface SampleConfigurator {
  productKey: string;
  name: string;
  options: {
    key: string;
    label: string;
    inputType: string; // single | swatch | toggle | quantity | …
    choices: {
      value: string;
      label: string;
      priceDeltaCents?: number;
      swatchHex?: string;
      isDefault?: boolean;
    }[];
  }[];
  /** Optional add-ons, each pinning a pack variant. */
  addOns?: { variantKey: string; defaultIncluded?: boolean; priceOverrideCents?: number }[];
}

/** A demo AI prompt the sample loader seeds into the library (docs/07 §9). Applied
 *  only when the `ai` module is on. `key` is engine-prefixed with `sample-` so Clear
 *  removes it; the platform's REAL default library (the `ai` preset) is untouched. */
export interface SampleAiPrompt {
  key: string;
  name: string;
  description?: string;
  category: string; // persona | support | email | product | seo | social | crm | general
  body: string;
  variables?: { key: string; label: string; example?: string }[];
}

/** The complete authored dataset for one industry. */
export interface SampleDataPack {
  industry: string;
  label: string;
  summary: string;
  warehouses?: SampleWarehouse[];
  suppliers?: SampleSupplier[];
  lots?: SampleLot[];
  products: SampleProduct[];
  collections?: SampleCollection[];
  categories?: SampleCategory[];
  personas: SamplePersona[];
  articles?: SampleArticle[];
  scheduling?: SampleScheduling;
  bundles?: SampleBundle[];
  configurator?: SampleConfigurator;
  /** Demo AI prompts (applied only when `ai` is on). Omit and the engine derives a
   *  small industry-flavored set from the pack label. */
  aiPrompts?: SampleAiPrompt[];
}

/** Per-entity counts returned by load/clear/status — drives the dashboard summary
 *  and the Clear confirmation copy ("removes 24 products, 10 orders, …"). */
export interface SampleDataCounts {
  products: number;
  collections: number;
  categories: number;
  articles: number;
  customers: number;
  orders: number;
  returns: number;
  reviews: number;
  questions: number;
  bookings: number;
  quotes: number;
  deals: number;
  bundles: number;
  movements: number;
  images: number;
  /** Demo AI prompt-library rows (docs/07 §9). */
  aiPrompts: number;
  /** Demo MCP tool-call audit rows that populate the /ai dashboard. */
  toolCalls: number;
}

/** What a tenant's sample-data status looks like: which industry pack applies,
 *  whether anything is currently loaded, and the per-entity counts. */
export interface SampleDataStatus {
  /** The tenant's chosen industry, or null. */
  industry: string | null;
  /** The pack that WOULD load (resolved from industry; falls back to generic). */
  packIndustry: string;
  packLabel: string;
  packSummary: string;
  /** Modules the pack would touch that are currently enabled. */
  modules: string[];
  /** True if any sample rows exist for the tenant right now. */
  loaded: boolean;
  counts: SampleDataCounts;
}
