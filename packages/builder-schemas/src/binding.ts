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
export type SourceModule = 'cms' | 'commerce' | 'crm' | 'site';

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
  { key: 'title', label: 'Title', kind: 'text', cardinality: 'scalar' },
  { key: 'price', label: 'Price', kind: 'number', cardinality: 'scalar' },
  { key: 'compareAtPrice', label: 'Compare-at price', kind: 'number', cardinality: 'scalar' },
  { key: 'description', label: 'Description', kind: 'richtext', cardinality: 'scalar' },
  { key: 'images', label: 'Images', kind: 'images', cardinality: 'array' },
  { key: 'sku', label: 'SKU', kind: 'text', cardinality: 'scalar' },
];

export const COMMERCE_SOURCES: DataSource[] = [
  {
    key: 'commerce.product',
    label: 'Products',
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
];

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
      { key: 'logo', label: 'Logo', kind: 'image', cardinality: 'scalar' },
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
    label: 'Loyalty / store credit',
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
    key: 'appointment',
    label: 'Appointment',
    module: 'crm',
    cardinality: 'object',
    recordType: 'appointment',
    fields: [
      text('service', 'Service'),
      text('date', 'Date'),
      text('time', 'Time'),
      text('when', 'When'),
      text('duration', 'Duration'),
      text('status', 'Status'),
      text('vehicle', 'Vehicle'),
      text('cancellationReason', 'Cancellation reason'),
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
