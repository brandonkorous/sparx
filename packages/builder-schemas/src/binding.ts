// The Builder binding schema — the keystone contract (docs/43).
//
// A read-only, computed description of what a page can BIND to: the tenant's
// real CMS content types + the code-defined Commerce/CRM sources, each with its
// fields' TYPE and CARDINALITY. Cardinality drives single-vs-iterate; kind gates
// which component can bind where (the editor consumes this — Phase 1b).
//
// Plain TS types (no Zod): this is computed read-only data we produce + consume,
// not a persisted shape validated at a trust boundary (cf. node.ts / page.ts).

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
// The `site` module is what the SITE (layout) editor binds to: brand identity,
// navigation, social. The SHAPE is fixed here; the DATA is fetched per tenant at
// preview/render time from the platform's existing stores (TenantBrand,
// NavigationMenu) — the Builder keeps no parallel nav/brand. These are NOT in the
// page editor's catalog; chrome binds to site data, pages bind to content.

const NAV_FIELDS: FieldSchema[] = [
  { key: 'label', label: 'Label', kind: 'text', cardinality: 'scalar' },
  { key: 'url', label: 'URL', kind: 'text', cardinality: 'scalar' },
];

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
    key: 'site.primaryNav',
    label: 'Primary navigation',
    module: 'site',
    cardinality: 'array',
    recordType: 'navItem',
    fields: NAV_FIELDS,
  },
  {
    key: 'site.footerNav',
    label: 'Footer navigation',
    module: 'site',
    cardinality: 'array',
    recordType: 'navItem',
    fields: NAV_FIELDS,
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
