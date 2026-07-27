// The Builder binding schema — the keystone contract (docs/43).
//
// A read-only, computed description of what a page can BIND to: the tenant's
// real CMS content types + the code-defined Commerce/CRM sources, each with its
// fields' TYPE and CARDINALITY. Cardinality drives single-vs-iterate; kind gates
// which component can bind where (the editor consumes this — Phase 1b).
//
// Plain TS types (no Zod): this is computed read-only data we produce + consume,
// not a persisted shape validated at a trust boundary (cf. node.ts / page.ts).

import { bindingSourceKey, collectBindingPaths } from './runtime';
import type { BuilderNode } from './node';

// ── Field + source shapes ─────────────────────────────────────────────────────

export type FieldKind =
  | 'text'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'option'
  | 'reference'
  | 'image'
  | 'images'
  | 'file'
  | 'group'
  | 'list';

export type FieldCardinality = 'scalar' | 'object' | 'array';
export type SourceCardinality = 'array' | 'object';
export type SourceModule = 'cms' | 'commerce' | 'crm' | 'site' | 'scheduling';

export interface FieldSchema {
  key: string;
  label: string;
  kind: FieldKind;
  cardinality: FieldCardinality;
  /** Nested fields for `group` (object) and `list` (repeater) kinds. */
  fields?: FieldSchema[];
}

export interface DataSource {
  /** Binding ROOT path — `cms.post` (a list) or `post` (one record). */
  key: string;
  label: string;
  module: SourceModule;
  /** array → iterate; object → render-once + set scope. */
  cardinality: SourceCardinality;
  /** The record type each item is, e.g. `post`, `product`, `list`. */
  recordType: string;
  fields: FieldSchema[];
}

// The full set of bindable sources (named to avoid clashing with node.ts's
// per-node `BindingSchema` Zod — this is the catalog, not one node's binding).
export interface BindingCatalog {
  sources: DataSource[];
}

// ── CMS content type → sources ────────────────────────────────────────────────

// Structural shape of a CMS FieldDef (@sparx/cms-schemas) — duplicated minimally
// so this package stays zod-only with no CMS dependency. Only the parts the
// mapping reads.
export interface CmsFieldLike {
  key: string;
  label: string;
  type: string;
  multiple?: boolean;
  accept?: string[];
  fields?: CmsFieldLike[];
}

export interface CmsContentTypeLike {
  key: string;
  name: string;
  pluralName: string;
  isSingleton?: boolean;
  fields: CmsFieldLike[];
}

function isImageAccept(accept: string[] | undefined): boolean {
  // No `accept` → assume image (the common case); else require an image/* entry.
  if (!accept || accept.length === 0) return true;
  return accept.some((a) => a.startsWith('image/'));
}

/** Map one CMS field definition to a Builder FieldSchema (docs/43 §3 table). */
function mapField(f: CmsFieldLike): FieldSchema {
  const base = { key: f.key, label: f.label };
  switch (f.type) {
    case 'rich_text':
      return { ...base, kind: 'richtext', cardinality: 'scalar' };
    case 'number':
      return { ...base, kind: 'number', cardinality: 'scalar' };
    case 'boolean':
      return { ...base, kind: 'boolean', cardinality: 'scalar' };
    case 'date':
    case 'datetime':
      return { ...base, kind: 'date', cardinality: 'scalar' };
    case 'enum':
      return { ...base, kind: 'option', cardinality: f.multiple ? 'array' : 'scalar' };
    case 'reference':
      return { ...base, kind: 'reference', cardinality: f.multiple ? 'array' : 'scalar' };
    case 'asset': {
      const image = isImageAccept(f.accept);
      if (f.multiple) return { ...base, kind: image ? 'images' : 'file', cardinality: 'array' };
      return { ...base, kind: image ? 'image' : 'file', cardinality: 'scalar' };
    }
    case 'object':
      return {
        ...base,
        kind: 'group',
        cardinality: 'object',
        fields: (f.fields ?? []).map(mapField),
      };
    case 'repeater':
      return {
        ...base,
        kind: 'list',
        cardinality: 'array',
        fields: (f.fields ?? []).map(mapField),
      };
    // text, long_text, slug, url, email — and any unknown future type — read as text.
    default:
      return { ...base, kind: 'text', cardinality: 'scalar' };
  }
}

/** A content type → its binding sources: a collection (`cms.<key>`, array) for
 *  grids that iterate, plus a record (`<key>`, object) for a collection-page
 *  template bound to one record. Singletons emit only the record source. */
export function mapCmsContentType(ct: CmsContentTypeLike): DataSource[] {
  const fields = (ct.fields ?? []).map(mapField);
  const record: DataSource = {
    key: ct.key,
    label: ct.name,
    module: 'cms',
    cardinality: 'object',
    recordType: ct.key,
    fields,
  };
  if (ct.isSingleton) return [record];
  const collection: DataSource = {
    key: `cms.${ct.key}`,
    label: ct.pluralName,
    module: 'cms',
    cardinality: 'array',
    recordType: ct.key,
    fields,
  };
  return [collection, record];
}

// ── Code-defined domain sources (Commerce owns its schema; CRM likewise) ──────

const PRODUCT_FIELDS: FieldSchema[] = [
  // `id` + `handle` (docs/98 Pillar 7) let a descendant of a pinned/looped product
  // read its identity — e.g. a card title that links to the product's PDP
  // (`/products/{{item.handle}}`) or a node keyed by `item.id`.
  { key: 'id', label: 'Product ID', kind: 'text', cardinality: 'scalar' },
  { key: 'handle', label: 'Handle (URL)', kind: 'text', cardinality: 'scalar' },
  { key: 'title', label: 'Title', kind: 'text', cardinality: 'scalar' },
  { key: 'price', label: 'Price', kind: 'number', cardinality: 'scalar' },
  { key: 'compareAtPrice', label: 'Compare-at price', kind: 'number', cardinality: 'scalar' },
  { key: 'description', label: 'Description', kind: 'richtext', cardinality: 'scalar' },
  { key: 'images', label: 'Images', kind: 'images', cardinality: 'array' },
  // The primary-image URL as a SCALAR — the derived first-of-`images` a silica
  // `Image` atom binds its `src` to (silica's `fillValue` sets `<img src>` from a
  // string, so a card/buy-box media node needs a scalar image ref, not the array).
  // The preview/live data loaders populate it from `images[0].url`.
  { key: 'image', label: 'Primary image', kind: 'image', cardinality: 'scalar' },
  { key: 'sku', label: 'SKU', kind: 'text', cardinality: 'scalar' },
  // The variant an add-to-cart lands on with no options picked. Bound by the buy
  // box's hidden field so its <form> submit carries a real cart line — silica's
  // `fillValue` writes a bound value into an `<input>`'s `value` attribute
  // (silicaui ≥ 0.12). Empty string when the product has no live variant.
  { key: 'variantId', label: 'Default variant ID', kind: 'text', cardinality: 'scalar' },
  // The product's storefront URL (`/products/<handle>`). A product card binds it
  // into its `<a href>` via `bindAttr` — without it a product grid renders a wall
  // of cards that navigate nowhere. Derived, not stored: the data loaders build it
  // from `handle` so the route shape lives in one place.
  { key: 'url', label: 'Product URL', kind: 'text', cardinality: 'scalar' },
];

// A collection's own fields PLUS its `products` — a `list` (repeater) whose items
// carry the product fields, so a collection-detail template can bind a header to
// the collection AND a grid to its products in ONE object scope. The storefront
// collection route injects the collection with its products pre-fetched onto this
// `products` list (docs/118 collections coverage), so the grid repeats a
// scope-relative `products` ref — no separate collection-scoped product source.
const COLLECTION_FIELDS: FieldSchema[] = [
  { key: 'name', label: 'Name', kind: 'text', cardinality: 'scalar' },
  { key: 'description', label: 'Description', kind: 'richtext', cardinality: 'scalar' },
  { key: 'image', label: 'Hero image', kind: 'image', cardinality: 'scalar' },
  {
    key: 'products',
    label: 'Products',
    kind: 'list',
    cardinality: 'array',
    fields: PRODUCT_FIELDS,
  },
];

// A browse-CATEGORY's own fields — the record a `commerce.category` detail template
// binds its header to (docs/122). A category is a tree node, not a flat merchandising
// surface: its product ROLLUP (self + descendants, paginated) is a functional core, not
// a bindable list, so unlike COLLECTION_FIELDS there is no `products` list here — the
// pinned `commerce.category-detail` core owns the rollup.
const CATEGORY_FIELDS: FieldSchema[] = [
  { key: 'id', label: 'Category ID', kind: 'text', cardinality: 'scalar' },
  { key: 'handle', label: 'Handle (URL)', kind: 'text', cardinality: 'scalar' },
  { key: 'name', label: 'Name', kind: 'text', cardinality: 'scalar' },
  { key: 'description', label: 'Description', kind: 'richtext', cardinality: 'scalar' },
  { key: 'image', label: 'Hero image', kind: 'image', cardinality: 'scalar' },
  { key: 'url', label: 'Category URL', kind: 'text', cardinality: 'scalar' },
];

// A bookable SERVICE's own fields — the record a `scheduling.service` detail template
// binds its header to (docs/122). The live time-picker (availability, slot selection) is
// a functional core (`scheduling.service-detail`), so no availability data lives here.
const SERVICE_FIELDS: FieldSchema[] = [
  { key: 'id', label: 'Service ID', kind: 'text', cardinality: 'scalar' },
  { key: 'name', label: 'Name', kind: 'text', cardinality: 'scalar' },
  { key: 'description', label: 'Description', kind: 'richtext', cardinality: 'scalar' },
  { key: 'duration', label: 'Duration (minutes)', kind: 'number', cardinality: 'scalar' },
  { key: 'price', label: 'Price', kind: 'number', cardinality: 'scalar' },
  { key: 'image', label: 'Image', kind: 'image', cardinality: 'scalar' },
  { key: 'url', label: 'Booking URL', kind: 'text', cardinality: 'scalar' },
];

export const COMMERCE_SOURCES: DataSource[] = [
  {
    key: 'commerce.product',
    label: 'All products',
    module: 'commerce',
    cardinality: 'array',
    recordType: 'product',
    fields: PRODUCT_FIELDS,
  },
  // The bounded rails the configurable Products block picks between (docs/118). Same
  // product SHAPE as `commerce.product`; the storefront caps each to a handful and
  // (on a PDP) excludes the product being viewed. `commerce.category.<handle>` is
  // parameterized — the editor's Products inspector appends the chosen collection.
  {
    key: 'commerce.featured',
    label: 'Featured products',
    module: 'commerce',
    cardinality: 'array',
    recordType: 'product',
    fields: PRODUCT_FIELDS,
  },
  {
    key: 'commerce.new',
    label: 'New arrivals',
    module: 'commerce',
    cardinality: 'array',
    recordType: 'product',
    fields: PRODUCT_FIELDS,
  },
  {
    key: 'commerce.related',
    label: 'Related products',
    module: 'commerce',
    cardinality: 'array',
    recordType: 'product',
    fields: PRODUCT_FIELDS,
  },
  {
    key: 'product',
    label: 'Product',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'product',
    fields: PRODUCT_FIELDS,
  },
  {
    key: 'commerce.collection',
    label: 'Collections',
    module: 'commerce',
    cardinality: 'array',
    recordType: 'collection',
    fields: COLLECTION_FIELDS,
  },
  {
    key: 'collection',
    label: 'Collection',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'collection',
    fields: COLLECTION_FIELDS,
  },
  // Browse categories — the ARRAY source makes `commerce.category` a template record
  // type in the studio (a category-detail page); the OBJECT source (`category`) is the
  // in-scope record a category-detail template binds its header to. Distinct from the
  // parameterized `commerce.category.<handle>` product sources (a specific category's
  // products for the Products block) — this is the category TYPE, not one category's items.
  {
    key: 'commerce.category',
    label: 'Categories',
    module: 'commerce',
    cardinality: 'array',
    recordType: 'category',
    fields: CATEGORY_FIELDS,
  },
  {
    key: 'category',
    label: 'Category',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'category',
    fields: CATEGORY_FIELDS,
  },
];

/** One tenant product collection → a parameterized `commerce.category.<handle>`
 *  source for the configurable Products block (docs/122). `bindingService` enumerates
 *  the tenant's real collections into the page catalog so each surfaces in the studio
 *  binding picker as its own source ("Category: <name>"); picking one binds a Products
 *  repeat to that collection. Same product SHAPE as `commerce.product` — the storefront
 *  resolves the ref via `listCollectionProducts(handle)`. Handles are kebab-case (no
 *  dots), so the dotted binding key stays a clean three-segment path. */
export function commerceCategorySource(handle: string, name: string): DataSource {
  return {
    key: `commerce.category.${handle}`,
    label: `Category: ${name}`,
    module: 'commerce',
    cardinality: 'array',
    recordType: 'product',
    fields: PRODUCT_FIELDS,
  };
}

export const CRM_SOURCES: DataSource[] = [
  {
    key: 'crm.list',
    label: 'Newsletter list',
    module: 'crm',
    cardinality: 'object',
    recordType: 'list',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', cardinality: 'scalar' },
      { key: 'subscribers', label: 'Subscribers', kind: 'number', cardinality: 'scalar' },
    ],
  },
];

// ── Scheduling sources ────────────────────────────────────────────────────────
//
// The ARRAY `scheduling.service` makes a bookable-service DETAIL a template record type
// in the studio (docs/122); the OBJECT `service` is the in-scope record such a template
// binds its header to. The live time-picker is a pinned `scheduling.service-detail`
// functional core (availability isn't bindable data), so these fields are the service's
// own descriptive attributes only.
export const SCHEDULING_SOURCES: DataSource[] = [
  {
    key: 'scheduling.service',
    label: 'Bookable services',
    module: 'scheduling',
    cardinality: 'array',
    recordType: 'service',
    fields: SERVICE_FIELDS,
  },
  {
    key: 'service',
    label: 'Service',
    module: 'scheduling',
    cardinality: 'object',
    recordType: 'service',
    fields: SERVICE_FIELDS,
  },
];

// ── Site-scope sources (the layout chrome — docs/45 §3) ───────────────────────
//
// The `site` module is what the SITE (layout) editor binds to: brand identity +
// social. The SHAPE is fixed here; the DATA is fetched per tenant at
// preview/render time from the platform's existing stores (TenantBrand). These
// are NOT in the page editor's catalog; chrome binds to site data, pages bind to
// content. Navigation is NOT a binding — it's Builder-owned (docs/57), authored
// on the NavMenu node's own `props.links`, never read from a CMS menu.

export const SITE_SOURCES: DataSource[] = [
  {
    key: 'site.identity',
    label: 'Brand identity',
    module: 'site',
    cardinality: 'object',
    recordType: 'identity',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', cardinality: 'scalar' },
      { key: 'tagline', label: 'Tagline', kind: 'text', cardinality: 'scalar' },
      // Both logos the tenant uploads in Site settings. Only offer a field the
      // host actually fills — a bound node whose ref resolves empty loses its
      // authored content, so a decorative field here is a blanked node there.
      { key: 'logo', label: 'Logo (light backgrounds)', kind: 'image', cardinality: 'scalar' },
      { key: 'logoDark', label: 'Logo (dark backgrounds)', kind: 'image', cardinality: 'scalar' },
    ],
  },
  {
    key: 'site.social',
    label: 'Social links',
    module: 'site',
    cardinality: 'array',
    recordType: 'socialLink',
    fields: [
      { key: 'platform', label: 'Platform', kind: 'text', cardinality: 'scalar' },
      { key: 'url', label: 'URL', kind: 'text', cardinality: 'scalar' },
    ],
  },
];

/** The site (layout) editor's binding catalog. Constant — tenant-independent in
 *  shape — so the editor route passes it directly with no fetch (cf. the page
 *  catalog, which must introspect the tenant's CMS content types). */
export const SITE_CATALOG: BindingCatalog = { sources: SITE_SOURCES };

// ── Email-scope sources (the Email Builder — docs/52 §7) ──────────────────────
//
// What an email can bind to. The SHAPE is fixed here; the DATA is produced per
// send/recipient at dispatch time by an email DataSources resolver in api-rest
// (the generalization of today's section `sectionResolver`). Two tiers:
//   · personalized — resolved PER RECIPIENT (recipient / order / cart / loyalty);
//   · dynamic      — resolved once per send (products / collections / promotion).
// Tenant CMS sources (e.g. latest blog posts) are introspected per tenant like
// the page catalog; they're merged in when the data-aware palette lands (Phase 4),
// so this constant carries only the code-defined sources.

const text = (key: string, label: string): FieldSchema => ({
  key,
  label,
  kind: 'text',
  cardinality: 'scalar',
});

// The line-item columns a `line_item_table` binds (order/cart/quote/invoice.items).
// All display-ready strings (qty/price already formatted by the resolver). `name`
// and `description` co-exist so one column set serves both vocabularies (orders use
// `name`, invoices use `description`).
const LINE_ITEM_FIELDS: FieldSchema[] = [
  text('name', 'Name'),
  text('description', 'Description'),
  text('quantity', 'Quantity'),
  text('unitPrice', 'Unit price'),
  text('lineTotal', 'Line total'),
];
const lineItems = (): FieldSchema => ({
  key: 'items',
  label: 'Line items',
  kind: 'list',
  cardinality: 'array',
  fields: LINE_ITEM_FIELDS,
});

const CUSTOMER_FIELDS: FieldSchema[] = [
  text('firstName', 'First name'),
  text('lastName', 'Last name'),
  text('fullName', 'Full name'),
  text('email', 'Email'),
  text('company', 'Company'),
];

// Email products are DISPLAY-ready (price already a currency string, an image
// URL, a clickable link) — unlike the page catalog's COMMERCE_SOURCES, whose
// `price` is a raw number for interactive commerce components. Email leaves bind
// to plain text/image, so the resolver hands back exactly what renders.
const EMAIL_PRODUCT_FIELDS: FieldSchema[] = [
  text('title', 'Title'),
  text('priceLabel', 'Price'),
  { key: 'imageUrl', label: 'Image', kind: 'image', cardinality: 'scalar' },
  text('url', 'Link'),
];

// The bindable email sources, in the docs/91 §3 vocabulary. Entity-scoped sources
// (customer/order/cart/quote/invoice/b2bAccount) resolve from the send's entity
// refs at dispatch; per-send sources (tenant/commerce.product/promotion) resolve
// once. Every `*Url` field resolves to a real storefront route at dispatch.
export const EMAIL_SOURCES: DataSource[] = [
  {
    key: 'customer',
    label: 'Customer',
    module: 'crm',
    cardinality: 'object',
    recordType: 'customer',
    fields: CUSTOMER_FIELDS,
  },
  {
    // Historical alias of `customer` (firstName/lastName/email) — kept so an
    // existing tree that bound `recipient.*` still resolves.
    key: 'recipient',
    label: 'Recipient',
    module: 'crm',
    cardinality: 'object',
    recordType: 'customer',
    fields: [
      text('firstName', 'First name'),
      text('lastName', 'Last name'),
      text('email', 'Email'),
    ],
  },
  {
    // The site identity (the tenant's customer-facing brand) — `{{site.name}}`,
    // `{{site.url}}`. The CANONICAL namespace is `site.*`; the historical `tenant.*`
    // (with a `siteUrl`/`storeUrl` URL field) still resolves via the back-compat
    // aliases the resolver + sample emit, so an email authored before the rename
    // keeps working. Single-segment key, so `bindingSourceKey('site.name')` is
    // `site` (distinct catalog from the page builder's `site.identity`).
    key: 'site',
    label: 'Site',
    module: 'site',
    cardinality: 'object',
    recordType: 'site',
    fields: [text('name', 'Name'), text('url', 'URL'), text('supportEmail', 'Support email')],
  },
  {
    key: 'order',
    label: 'Order',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'order',
    fields: [
      text('number', 'Order number'),
      text('status', 'Status'),
      text('total', 'Total'),
      text('subtotal', 'Subtotal'),
      // The amount refunded (order-refunded hero) and the lifecycle fields the
      // delivered / cancelled emails read; each is empty when it doesn't apply, so
      // an optional row self-drops (a cancelled order with no reason shows no line).
      text('refundTotal', 'Refund total'),
      text('deliveredAt', 'Delivered date'),
      text('cancelReason', 'Cancellation reason'),
      text('shippingAddress', 'Shipping address'),
      text('placedAt', 'Date'),
      text('reviewUrl', 'Review link'),
      text('statusUrl', 'Order status link'),
      lineItems(),
    ],
  },
  {
    key: 'cart',
    label: 'Cart',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'cart',
    fields: [
      text('total', 'Total'),
      text('itemCount', 'Item count'),
      text('recoveryUrl', 'Recovery link'),
      {
        key: 'items',
        label: 'Line items',
        kind: 'list',
        cardinality: 'array',
        fields: [
          ...LINE_ITEM_FIELDS,
          { key: 'imageUrl', label: 'Image', kind: 'image', cardinality: 'scalar' },
        ],
      },
    ],
  },
  {
    key: 'quote',
    label: 'Quote',
    module: 'crm',
    cardinality: 'object',
    recordType: 'quote',
    fields: [
      text('number', 'Quote number'),
      text('status', 'Status'),
      text('total', 'Total'),
      text('validUntil', 'Valid until'),
      text('reviewUrl', 'Review link'),
      lineItems(),
    ],
  },
  {
    key: 'invoice',
    label: 'Invoice',
    module: 'crm',
    cardinality: 'object',
    recordType: 'invoice',
    fields: [
      text('number', 'Invoice number'),
      text('total', 'Total'),
      text('balance', 'Balance due'),
      text('dueDate', 'Due date'),
      text('daysUntilDue', 'Days until due'),
      text('overdueDays', 'Days overdue'),
      text('payUrl', 'Pay link'),
      lineItems(),
    ],
  },
  {
    key: 'b2bAccount',
    label: 'B2B account',
    module: 'crm',
    cardinality: 'object',
    recordType: 'b2bAccount',
    fields: [
      text('companyName', 'Company name'),
      text('status', 'Status'),
      text('paymentTerms', 'Payment terms'),
      text('creditLimit', 'Credit limit'),
      text('portalUrl', 'Portal link'),
    ],
  },
  {
    key: 'loyalty',
    label: 'Loyalty / account credit',
    module: 'crm',
    cardinality: 'object',
    recordType: 'loyalty',
    fields: [text('pointsLabel', 'Balance'), text('tierName', 'Tier')],
  },
  {
    key: 'shipping',
    label: 'Shipment',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'fulfillment',
    fields: [
      text('status', 'Status'),
      text('carrier', 'Carrier'),
      text('service', 'Service'),
      text('trackingNumber', 'Tracking number'),
      text('trackingUrl', 'Tracking link'),
      text('shippedAt', 'Shipped date'),
    ],
  },
  {
    // A commerce auto-ship subscription (docs/impl transactional-email P2) — the
    // renewal reminder / paused / cancelled notices. `interval` is plain-language
    // cadence ("every 2 weeks"); the optional date fields are empty until they apply.
    key: 'subscription',
    label: 'Subscription',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'subscription',
    fields: [
      text('status', 'Status'),
      text('interval', 'Frequency'),
      text('amount', 'Amount'),
      text('itemCount', 'Item count'),
      text('nextOrderDate', 'Next order date'),
      text('pausedUntil', 'Paused until'),
      text('currentPeriodEnd', 'Current period ends'),
      text('manageUrl', 'Manage link'),
    ],
  },
  {
    // A return / RMA (docs/impl transactional-email P3) — the received / approved /
    // refunded notices. `refundAmount` is empty until a refund settles, and `hasLabel`
    // is non-empty only when a prepaid label exists (gates the "print your label" line).
    key: 'return',
    label: 'Return',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'return',
    fields: [
      text('status', 'Status'),
      text('outcome', 'Requested outcome'),
      text('refundAmount', 'Refund amount'),
      text('refundMethod', 'Refund method'),
      text('labelUrl', 'Return label link'),
      text('hasLabel', 'Has return label'),
      text('manageUrl', 'Manage link'),
    ],
  },
  {
    // The Scheduling module's booking (docs/79) — the industry-agnostic
    // appointment/class/reservation/rental record. B2B fleet appointments are
    // Bookings too (Booking.b2bAccountId/assetRef) — the legacy B2B-only
    // `appointment` source (service_appointments) was retired 2026-07-14.
    key: 'booking',
    label: 'Booking',
    module: 'scheduling',
    cardinality: 'object',
    recordType: 'booking',
    fields: [
      text('service', 'Service'),
      text('date', 'Date'),
      text('time', 'Time'),
      text('when', 'When'),
      text('duration', 'Duration'),
      text('location', 'Location'),
      text('staff', 'Staff'),
      text('partySize', 'Party size'),
      text('status', 'Status'),
      text('cancellationReason', 'Cancellation reason'),
      text('manageUrl', 'Manage link'),
      text('bookUrl', 'Book-again link'),
      text('addToCalendarUrl', 'Add-to-calendar link'),
      // Owner-facing helpers for the internal new-booking alert: `newHeadline` varies
      // the heading wording ("New booking" vs "New booking request"), and
      // `pendingApproval` is non-empty only for a requires-approval booking still
      // awaiting a decision (gates the action-needed line).
      text('newHeadline', 'New-booking headline'),
      text('pendingApproval', 'Pending approval'),
    ],
  },
  {
    // A waitlist OFFER (docs/79 §7) — sent when a spot opens for a customer waiting
    // on a service. Carries the service + requested window + how long the offer is
    // held + the book-now link. No booking exists yet (the offer is a nudge to book).
    key: 'waitlist',
    label: 'Waitlist offer',
    module: 'scheduling',
    cardinality: 'object',
    recordType: 'waitlist',
    fields: [
      text('service', 'Service'),
      text('window', 'Requested window'),
      text('offerExpires', 'Offer expires'),
      text('bookUrl', 'Book link'),
      text('manageUrl', 'Manage link'),
    ],
  },
  {
    key: 'commerce.product',
    label: 'Products',
    module: 'commerce',
    cardinality: 'array',
    recordType: 'product',
    fields: EMAIL_PRODUCT_FIELDS,
  },
  {
    key: 'promotion',
    label: 'Active promotion',
    module: 'commerce',
    cardinality: 'object',
    recordType: 'promotion',
    fields: [
      text('title', 'Title'),
      text('body', 'Body'),
      text('ctaLabel', 'CTA label'),
      text('ctaHref', 'CTA link'),
    ],
  },
];

/** The Email Builder's binding catalog (docs/52 §7). The code-defined sources are
 *  constant; the per-tenant catalog (api-rest's `getEmailSchema`) merges these
 *  with the tenant's CMS COLLECTION sources so an email can iterate latest posts. */
export const EMAIL_CATALOG: BindingCatalog = { sources: EMAIL_SOURCES };

// ── Personalization (per-recipient vs per-send) ───────────────────────────────
//
// Some email sources resolve PER RECIPIENT (the recipient, their recent order /
// abandoned cart / loyalty balance); the rest resolve ONCE per send (products,
// promotion, latest posts). A tree that binds any per-recipient source must defer
// rendering to dispatch so each recipient gets their own copy (docs/52 §6, §9 P4);
// a tree that doesn't renders once and fans out. These keys are the per-recipient
// SOURCE roots (`bindingSourceKey` reduces a path to its source key).

export const EMAIL_PERSONALIZED_ROOTS: readonly string[] = [
  'recipient',
  'customer',
  'order',
  'cart',
  'quote',
  'invoice',
  'b2bAccount',
  'loyalty',
];

/** Does this email tree bind any per-recipient source? Drives render-once vs
 *  per-recipient deferred render in the broadcast send path. */
export function treeIsEmailPersonalized(tree: BuilderNode): boolean {
  return collectBindingPaths(tree).some((p) =>
    EMAIL_PERSONALIZED_ROOTS.includes(bindingSourceKey(p))
  );
}
