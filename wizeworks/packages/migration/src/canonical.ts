// The canonical row contract — the only thing a vendor adapter has to produce, and
// the only thing an import processor has to understand.
//
// This indirection is the whole architecture. Twenty vendors and seventeen entities
// is 340 possible pairings; without a canonical shape in the middle, the worker grows
// a branch per pairing and the fortieth vendor is unaddable. With one, a vendor
// adapter is a pure function nobody downstream has heard of, and adding a competitor
// is one file plus one registry entry.
//
// Rows are `Record<string, string>` rather than typed objects on purpose: that is
// exactly what the existing `/import` endpoints accept and what `ImportJob.rawRows`
// stores, so a canonical row survives the trip through JSONB and back without a
// serialisation contract of its own. Coercion happens once, in the processor, against
// the field spec below — which is also what the browser validates against, so the
// preview and the import can never disagree.

/** Everything a migration can carry. `entityType` on ImportJob is VarChar(50) and
 *  free-form, so this list is code rather than schema — adding one is a processor,
 *  not a database migration. */
export type CanonicalEntity =
  | 'products'
  | 'inventory_levels'
  | 'customers'
  | 'orders'
  | 'categories'
  | 'collections'
  | 'discounts'
  | 'content'
  | 'media'
  | 'redirects'
  | 'companies'
  | 'deals'
  | 'tickets'
  | 'segments'
  | 'suppliers'
  | 'purchase_orders'
  | 'b2b_accounts';

export const CANONICAL_ENTITIES: readonly CanonicalEntity[] = [
  'products',
  'inventory_levels',
  'customers',
  'orders',
  'categories',
  'collections',
  'discounts',
  'content',
  'media',
  'redirects',
  'companies',
  'deals',
  'tickets',
  'segments',
  'suppliers',
  'purchase_orders',
  'b2b_accounts',
];

export type CanonicalRow = Record<string, string>;

/**
 * The module that has to be on for an entity to land.
 *
 * A tenant without commerce can still import a WordPress site's posts — the products
 * in the same file are reported as skipped with the reason, never dropped silently
 * and never a 403 on the run.
 *
 * Typed as a literal union rather than `string` so a consumer can hand these straight
 * to `isModuleEnabled` without a cast. It is deliberately a SUBSET of the platform's
 * module list spelled out here, because this package has no dependencies and importing
 * `@wizeworks/modules` for six strings would be the thing that ends that.
 */
export type EntityModule = 'builder' | 'commerce' | 'cms' | 'crm' | 'b2b' | 'inventory';

export const ENTITY_MODULE: Record<CanonicalEntity, EntityModule | null> = {
  products: 'commerce',
  inventory_levels: 'inventory',
  customers: 'crm',
  orders: 'commerce',
  categories: 'commerce',
  collections: 'commerce',
  discounts: 'commerce',
  content: 'cms',
  media: null,
  redirects: 'builder',
  companies: 'crm',
  deals: 'crm',
  tickets: 'crm',
  segments: 'crm',
  suppliers: 'inventory',
  purchase_orders: 'inventory',
  b2b_accounts: 'b2b',
};

/** Plain-language entity names. Business owners do not have "entities" — they have
 *  products and customers, so every surface that shows one of these shows this. */
export const ENTITY_LABEL: Record<CanonicalEntity, { one: string; many: string }> = {
  products: { one: 'Product', many: 'Products' },
  inventory_levels: { one: 'Stock level', many: 'Stock levels' },
  customers: { one: 'Customer', many: 'Customers' },
  orders: { one: 'Order', many: 'Orders' },
  categories: { one: 'Category', many: 'Categories' },
  collections: { one: 'Collection', many: 'Collections' },
  discounts: { one: 'Discount', many: 'Discounts' },
  content: { one: 'Page or post', many: 'Pages and posts' },
  media: { one: 'Image or file', many: 'Images and files' },
  redirects: { one: 'Redirect', many: 'Redirects' },
  companies: { one: 'Company', many: 'Companies' },
  deals: { one: 'Deal', many: 'Deals' },
  tickets: { one: 'Ticket', many: 'Tickets' },
  segments: { one: 'Segment', many: 'Segments' },
  suppliers: { one: 'Supplier', many: 'Suppliers' },
  purchase_orders: { one: 'Purchase order', many: 'Purchase orders' },
  b2b_accounts: { one: 'Trade account', many: 'Trade accounts' },
};

// ──────────────────────────────────────────────────────────────────────────────
// Field specs
// ──────────────────────────────────────────────────────────────────────────────

export type FieldKind =
  | 'text'
  | 'html'
  | 'slug'
  | 'email'
  | 'url'
  | 'phone'
  | 'money'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'list'
  | 'enum';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  /** A row without this cannot be imported at all. */
  required?: boolean;
  /** Part of the natural key. A row needs at least one non-empty key field. */
  naturalKey?: boolean;
  /** Allowed values for `enum`. Matched case-insensitively. */
  values?: readonly string[];
  /** Max characters. Longer values are a warning (they get truncated), not an error. */
  max?: number;
  /** Shown under the column in the mapping UI. */
  help?: string;
}

/**
 * Field specs per entity — THE import contract.
 *
 * Every key offered here is a column the Move-in mapper lets a tenant assign, so every
 * key must be one the entity's processor in the import worker actually reads and
 * saves. A key offered and never read is data the tenant watches import and then
 * never sees; that happened to discounts (every row failed "name is required"),
 * products, stock levels, categories, collections, customers, media, deals, tickets,
 * suppliers and purchase orders, each with its own tests green. The import worker's
 * `contract.test.ts` now MEASURES which columns each processor reads and holds that
 * set equal to this list, so a field that cannot be stored stays off it and the file
 * report lists the column under "not imported" instead.
 */
export const ENTITY_FIELDS: Record<CanonicalEntity, readonly FieldSpec[]> = {
  products: [
    {
      key: 'handle',
      label: 'Handle',
      kind: 'slug',
      naturalKey: true,
      max: 255,
      help: 'Groups the rows of one product together. Rows sharing a handle become one product with several options.',
    },
    { key: 'title', label: 'Title', kind: 'text', required: true, max: 255 },
    { key: 'description', label: 'Description', kind: 'html' },
    { key: 'sku', label: 'SKU', kind: 'text', naturalKey: true, max: 100 },
    { key: 'status', label: 'Status', kind: 'enum', values: ['draft', 'active', 'archived'] },
    { key: 'vendor', label: 'Brand', kind: 'text', max: 255 },
    { key: 'product_type', label: 'Product type', kind: 'text', max: 255 },
    { key: 'tags', label: 'Tags', kind: 'list' },
    { key: 'category', label: 'Category', kind: 'text', max: 255 },
    {
      key: 'collections',
      label: 'Collections',
      kind: 'list',
      help: 'Collections this product belongs to, by name. A collection that does not exist yet is created.',
    },
    { key: 'price', label: 'Price', kind: 'money' },
    { key: 'compare_at_price', label: 'Compare-at price', kind: 'money' },
    { key: 'cost_per_item', label: 'Cost', kind: 'money' },
    { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
    { key: 'barcode', label: 'Barcode', kind: 'text', max: 14 },
    { key: 'track_inventory', label: 'Track stock', kind: 'boolean' },
    {
      key: 'quantity',
      label: 'Quantity',
      kind: 'integer',
      help: 'Stock on hand, counted at your main location. Used only for items with no stock recorded yet, and not when the same move carries a stock levels file.',
    },
    { key: 'weight_grams', label: 'Weight (g)', kind: 'decimal' },
    { key: 'weight_kg', label: 'Weight (kg)', kind: 'decimal' },
    { key: 'length_mm', label: 'Length (mm)', kind: 'decimal' },
    { key: 'width_mm', label: 'Width (mm)', kind: 'decimal' },
    { key: 'height_mm', label: 'Height (mm)', kind: 'decimal' },
    { key: 'length_cm', label: 'Length (cm)', kind: 'decimal' },
    { key: 'width_cm', label: 'Width (cm)', kind: 'decimal' },
    { key: 'height_cm', label: 'Height (cm)', kind: 'decimal' },
    {
      key: 'fulfillment_type',
      label: 'Fulfillment',
      kind: 'enum',
      values: ['physical', 'digital', 'service'],
    },
    { key: 'requires_shipping', label: 'Needs shipping', kind: 'boolean' },
    { key: 'option1_name', label: 'Option 1 name', kind: 'text', max: 100 },
    { key: 'option1_value', label: 'Option 1 value', kind: 'text', max: 255 },
    { key: 'option2_name', label: 'Option 2 name', kind: 'text', max: 100 },
    { key: 'option2_value', label: 'Option 2 value', kind: 'text', max: 255 },
    { key: 'option3_name', label: 'Option 3 name', kind: 'text', max: 100 },
    { key: 'option3_value', label: 'Option 3 value', kind: 'text', max: 255 },
    { key: 'image_url', label: 'Image URL', kind: 'url' },
    { key: 'image_alt', label: 'Image alt text', kind: 'text', max: 512 },
    {
      key: 'image_position',
      label: 'Image position',
      kind: 'integer',
      help: 'Where this row’s image sits in the product’s gallery, when each row carries one image.',
    },
    {
      key: 'images',
      label: 'All image URLs',
      kind: 'list',
      help: 'The product gallery, in order. Carried on the first row of each product; every commerce export spreads these across continuation rows and we re-gather them.',
    },
    { key: 'variant_image_url', label: 'Variant image URL', kind: 'url' },
    { key: 'seo_title', label: 'SEO title', kind: 'text', max: 255 },
    { key: 'seo_description', label: 'SEO description', kind: 'text', max: 512 },
    {
      key: 'published_at',
      label: 'Published',
      kind: 'date',
      help: 'The date the product first went on sale. Kept for active products so your newest items stay in order.',
    },
    {
      key: 'source_url',
      label: 'Old URL',
      kind: 'url',
      help: 'Where this product lived on the old platform. Used to build a redirect so existing links keep working, when your site builder is on.',
    },
  ],

  inventory_levels: [
    { key: 'sku', label: 'SKU', kind: 'text', required: true, naturalKey: true, max: 100 },
    {
      key: 'location',
      label: 'Location',
      kind: 'text',
      naturalKey: true,
      max: 255,
      help: 'The warehouse or shop this count is for. Created automatically if it does not exist yet.',
    },
    { key: 'quantity', label: 'On hand', kind: 'integer', required: true },
    { key: 'reorder_point', label: 'Reorder at', kind: 'integer' },
    { key: 'reorder_quantity', label: 'Reorder amount', kind: 'integer' },
    {
      key: 'bin',
      label: 'Bin',
      kind: 'text',
      max: 100,
      help: 'The shelf this item lives on at that location. It becomes the item’s home shelf when a shelf with that code or name is already set up there.',
    },
    { key: 'cost_per_item', label: 'Unit cost', kind: 'money' },
    { key: 'barcode', label: 'Barcode', kind: 'text', max: 14 },
  ],

  customers: [
    { key: 'email', label: 'Email', kind: 'email', naturalKey: true, max: 320 },
    { key: 'first_name', label: 'First name', kind: 'text', max: 100 },
    { key: 'last_name', label: 'Last name', kind: 'text', max: 100 },
    { key: 'name', label: 'Full name', kind: 'text', max: 255 },
    { key: 'phone', label: 'Phone', kind: 'phone', naturalKey: true, max: 50 },
    { key: 'company', label: 'Company', kind: 'text', max: 255 },
    { key: 'job_title', label: 'Job title', kind: 'text', max: 255 },
    { key: 'type', label: 'Type', kind: 'enum', values: ['person', 'company'] },
    { key: 'accepts_marketing', label: 'Email opt-in', kind: 'boolean' },
    { key: 'address1', label: 'Address line 1', kind: 'text', max: 255 },
    { key: 'address2', label: 'Address line 2', kind: 'text', max: 255 },
    { key: 'city', label: 'City', kind: 'text', max: 128 },
    { key: 'province', label: 'State / region', kind: 'text', max: 128 },
    { key: 'country', label: 'Country', kind: 'text', max: 128 },
    { key: 'zip', label: 'Postal code', kind: 'text', max: 32 },
    { key: 'tags', label: 'Tags', kind: 'list' },
    {
      key: 'note',
      label: 'Note',
      kind: 'text',
      max: 20000,
      help: 'Saved as a note on their timeline.',
    },
  ],

  orders: [
    {
      key: 'order_number',
      label: 'Order number',
      kind: 'text',
      required: true,
      naturalKey: true,
      max: 100,
    },
    { key: 'email', label: 'Customer email', kind: 'email', max: 320 },
    { key: 'customer_name', label: 'Customer name', kind: 'text', max: 255 },
    { key: 'phone', label: 'Phone', kind: 'phone', max: 50 },
    { key: 'placed_at', label: 'Placed', kind: 'date' },
    { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
    { key: 'financial_status', label: 'Payment status', kind: 'text', max: 50 },
    { key: 'fulfillment_status', label: 'Fulfillment status', kind: 'text', max: 50 },
    { key: 'subtotal', label: 'Subtotal', kind: 'money' },
    { key: 'shipping', label: 'Shipping', kind: 'money' },
    { key: 'tax', label: 'Tax', kind: 'money' },
    { key: 'discount', label: 'Discount', kind: 'money' },
    { key: 'total', label: 'Total', kind: 'money' },
    { key: 'discount_code', label: 'Discount code', kind: 'text', max: 100 },
    { key: 'shipping_method', label: 'Shipping method', kind: 'text', max: 255 },
    { key: 'line_sku', label: 'Line SKU', kind: 'text', max: 100 },
    { key: 'line_title', label: 'Line item', kind: 'text', max: 512 },
    { key: 'line_quantity', label: 'Line quantity', kind: 'integer' },
    { key: 'line_price', label: 'Line price', kind: 'money' },
    { key: 'ship_name', label: 'Ship to name', kind: 'text', max: 255 },
    { key: 'ship_address1', label: 'Ship to line 1', kind: 'text', max: 255 },
    { key: 'ship_address2', label: 'Ship to line 2', kind: 'text', max: 255 },
    { key: 'ship_city', label: 'Ship to city', kind: 'text', max: 128 },
    { key: 'ship_province', label: 'Ship to state', kind: 'text', max: 128 },
    { key: 'ship_country', label: 'Ship to country', kind: 'text', max: 128 },
    { key: 'ship_zip', label: 'Ship to postal code', kind: 'text', max: 32 },
    { key: 'note', label: 'Note', kind: 'text' },
  ],

  categories: [
    { key: 'name', label: 'Name', kind: 'text', required: true, naturalKey: true, max: 255 },
    { key: 'slug', label: 'Slug', kind: 'slug', naturalKey: true, max: 255 },
    { key: 'parent', label: 'Parent', kind: 'text', max: 255 },
    { key: 'description', label: 'Description', kind: 'html' },
    { key: 'position', label: 'Position', kind: 'integer' },
    { key: 'image_url', label: 'Image URL', kind: 'url', help: 'Shown as the category’s banner.' },
  ],

  collections: [
    { key: 'name', label: 'Name', kind: 'text', required: true, naturalKey: true, max: 255 },
    { key: 'slug', label: 'Slug', kind: 'slug', naturalKey: true, max: 255 },
    { key: 'description', label: 'Description', kind: 'html' },
    { key: 'products', label: 'Product handles or SKUs', kind: 'list' },
    {
      key: 'image_url',
      label: 'Image URL',
      kind: 'url',
      help: 'Shown as the collection’s banner.',
    },
  ],

  discounts: [
    { key: 'code', label: 'Code', kind: 'text', required: true, naturalKey: true, max: 63 },
    {
      key: 'title',
      label: 'Name',
      kind: 'text',
      max: 127,
      help: 'What your team sees in the list. The code is used when this is blank.',
    },
    { key: 'description', label: 'Description', kind: 'text', max: 2000 },
    {
      key: 'type',
      label: 'Type',
      kind: 'enum',
      values: ['percentage', 'fixed_amount', 'free_shipping'],
    },
    {
      key: 'value',
      label: 'Value',
      kind: 'decimal',
      help: 'The percentage off for a percentage discount, or the amount off for a fixed one.',
    },
    { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
    { key: 'minimum_amount', label: 'Minimum spend', kind: 'money' },
    { key: 'usage_limit', label: 'Usage limit', kind: 'integer' },
    { key: 'per_customer_limit', label: 'Uses per customer', kind: 'integer' },
    { key: 'starts_at', label: 'Starts', kind: 'date' },
    { key: 'ends_at', label: 'Ends', kind: 'date' },
    {
      key: 'status',
      label: 'Status',
      kind: 'enum',
      values: ['active', 'scheduled', 'expired', 'disabled'],
      help: 'Active and scheduled discounts are switched on; the start and end dates still decide when they apply. Expired and disabled ones arrive switched off.',
    },
  ],

  content: [
    { key: 'title', label: 'Title', kind: 'text', required: true, max: 512 },
    { key: 'slug', label: 'Slug', kind: 'slug', naturalKey: true, max: 255 },
    { key: 'type', label: 'Kind', kind: 'enum', values: ['post', 'page'] },
    { key: 'body', label: 'Body', kind: 'html' },
    { key: 'excerpt', label: 'Excerpt', kind: 'text' },
    {
      key: 'status',
      label: 'Status',
      kind: 'enum',
      values: ['draft', 'published', 'scheduled', 'archived'],
    },
    { key: 'author', label: 'Author', kind: 'text', max: 255 },
    { key: 'published_at', label: 'Published', kind: 'date' },
    { key: 'categories', label: 'Categories', kind: 'list' },
    { key: 'tags', label: 'Tags', kind: 'list' },
    { key: 'featured_image_url', label: 'Featured image', kind: 'url' },
    { key: 'seo_title', label: 'SEO title', kind: 'text', max: 255 },
    { key: 'seo_description', label: 'SEO description', kind: 'text', max: 512 },
    {
      key: 'source_url',
      label: 'Old URL',
      kind: 'url',
      help: 'Where this page lived on the old platform. Used to build a redirect so existing links keep working, when your site builder is on.',
    },
  ],

  media: [
    { key: 'url', label: 'File URL', kind: 'url', required: true, naturalKey: true },
    { key: 'filename', label: 'Filename', kind: 'text', max: 255 },
    { key: 'alt', label: 'Alt text', kind: 'text', max: 500 },
    { key: 'caption', label: 'Caption', kind: 'text', max: 2000 },
  ],

  redirects: [
    { key: 'from', label: 'Old path', kind: 'text', required: true, naturalKey: true, max: 2048 },
    { key: 'to', label: 'New path', kind: 'text', required: true, max: 2048 },
    { key: 'status_code', label: 'Type', kind: 'enum', values: ['301', '302'] },
  ],

  // Only fields a company record can actually store belong here; the companies
  // processor in the import worker reads exactly this list, and its contract test
  // holds the two equal. Phone, a street address and the old system's created date
  // used to be offered too, and nothing read them: a company has no phone or address
  // column and its created date is stamped by the database, so a HubSpot, Salesforce
  // or Pipedrive move showed those columns as mapped and then dropped every value.
  // Left off, the file report lists them under "not imported" instead.
  companies: [
    {
      key: 'name',
      label: 'Company name',
      kind: 'text',
      required: true,
      naturalKey: true,
      max: 255,
    },
    { key: 'domain', label: 'Website', kind: 'text', naturalKey: true, max: 255 },
    { key: 'industry', label: 'Industry', kind: 'text', max: 255 },
    { key: 'employees', label: 'Employees', kind: 'integer' },
    { key: 'annual_revenue', label: 'Annual revenue', kind: 'money' },
    { key: 'owner_email', label: 'Owner', kind: 'email', max: 320 },
    { key: 'description', label: 'Description', kind: 'text' },
  ],

  deals: [
    { key: 'name', label: 'Deal name', kind: 'text', required: true, naturalKey: true, max: 255 },
    { key: 'pipeline', label: 'Pipeline', kind: 'text', max: 255 },
    { key: 'stage', label: 'Stage', kind: 'text', max: 255 },
    { key: 'amount', label: 'Amount', kind: 'money' },
    { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
    { key: 'close_date', label: 'Close date', kind: 'date' },
    { key: 'status', label: 'Status', kind: 'enum', values: ['open', 'won', 'lost'] },
    { key: 'probability', label: 'Probability', kind: 'integer' },
    { key: 'owner_email', label: 'Owner', kind: 'email', max: 320 },
    { key: 'company', label: 'Company', kind: 'text', max: 255 },
    { key: 'contact_email', label: 'Contact', kind: 'email', max: 320 },
    { key: 'source', label: 'Source', kind: 'text', max: 255 },
  ],

  tickets: [
    { key: 'subject', label: 'Subject', kind: 'text', required: true, naturalKey: true, max: 512 },
    { key: 'description', label: 'Description', kind: 'text' },
    {
      key: 'priority',
      label: 'Priority',
      kind: 'enum',
      values: ['low', 'normal', 'high', 'urgent'],
    },
    { key: 'contact_email', label: 'Contact', kind: 'email', max: 320 },
    { key: 'company', label: 'Company', kind: 'text', max: 255 },
    { key: 'owner_email', label: 'Assigned to', kind: 'email', max: 320 },
  ],

  segments: [
    {
      key: 'name',
      label: 'Segment name',
      kind: 'text',
      required: true,
      naturalKey: true,
      max: 255,
    },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'members', label: 'Member emails', kind: 'list' },
  ],

  suppliers: [
    {
      key: 'name',
      label: 'Supplier name',
      kind: 'text',
      required: true,
      naturalKey: true,
      max: 255,
    },
    { key: 'code', label: 'Supplier code', kind: 'text', naturalKey: true, max: 100 },
    { key: 'email', label: 'Email', kind: 'email', max: 320 },
    { key: 'phone', label: 'Phone', kind: 'phone', max: 50 },
    { key: 'lead_time_days', label: 'Lead time (days)', kind: 'integer' },
    { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
    { key: 'address1', label: 'Address line 1', kind: 'text', max: 255 },
    { key: 'city', label: 'City', kind: 'text', max: 128 },
    { key: 'country', label: 'Country', kind: 'text', max: 128 },
    { key: 'sku', label: 'Supplies SKU', kind: 'text', max: 100 },
    { key: 'supplier_sku', label: 'Their SKU', kind: 'text', max: 100 },
    { key: 'unit_cost', label: 'Unit cost', kind: 'money' },
  ],

  purchase_orders: [
    {
      key: 'po_number',
      label: 'PO number',
      kind: 'text',
      required: true,
      naturalKey: true,
      max: 100,
    },
    { key: 'supplier', label: 'Supplier', kind: 'text', max: 255 },
    { key: 'location', label: 'Deliver to', kind: 'text', max: 255 },
    { key: 'expected_at', label: 'Expected', kind: 'date' },
    { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
    { key: 'line_sku', label: 'Line SKU', kind: 'text', max: 100 },
    { key: 'line_quantity', label: 'Line quantity', kind: 'integer' },
    { key: 'line_cost', label: 'Line unit cost', kind: 'money' },
    { key: 'note', label: 'Note', kind: 'text' },
  ],

  // Keyed EXACTLY as the trade-account processor reads them and as the trade-account
  // export writes them, so an export can be dropped straight back in. These keys used
  // to be `name` and `tier` while the processor read `company_name` and
  // `pricing_tier`, and nothing translated: every row failed "company_name is
  // required". Only fields a trade account can actually store belong here. A column
  // offered on this list and dropped on arrival reads as imported when it was not, so
  // phone, address and a tax-exempt yes/no are deliberately absent (a tax exemption
  // needs a jurisdiction, a reason and a certificate number, which a yes/no cannot
  // supply). The contract test in the import worker holds both sides to this list.
  b2b_accounts: [
    {
      key: 'company_name',
      label: 'Account name',
      kind: 'text',
      required: true,
      naturalKey: true,
      max: 255,
    },
    {
      key: 'email',
      label: 'Primary contact',
      kind: 'email',
      max: 320,
      help: 'Linked to the customer who already has this email. Customers in the same import are added first, so they count.',
    },
    { key: 'pricing_tier', label: 'Pricing tier', kind: 'text', max: 63 },
    {
      key: 'payment_terms',
      label: 'Payment terms',
      kind: 'enum',
      values: ['prepay', 'net30', 'net60', 'net90'],
    },
    { key: 'credit_limit', label: 'Credit limit', kind: 'money' },
    { key: 'discount_percent', label: 'Discount (%)', kind: 'decimal' },
    { key: 'tax_id', label: 'Tax ID', kind: 'text', max: 64 },
    { key: 'website', label: 'Website', kind: 'url', max: 2048 },
    {
      key: 'status',
      label: 'Status',
      kind: 'enum',
      values: ['active', 'credit_hold', 'suspended', 'inactive'],
    },
    { key: 'notes', label: 'Notes', kind: 'text' },
    { key: 'tags', label: 'Tags', kind: 'list' },
  ],
};

/** Field spec lookup, or `undefined` for a column we do not know. */
export function fieldSpec(entity: CanonicalEntity, key: string): FieldSpec | undefined {
  return ENTITY_FIELDS[entity].find((field) => field.key === key);
}

/** Fields that together identify a row for upsert. */
export function naturalKeyFields(entity: CanonicalEntity): FieldSpec[] {
  return ENTITY_FIELDS[entity].filter((field) => field.naturalKey === true);
}
