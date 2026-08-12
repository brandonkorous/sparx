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
 * `@sparx/modules` for six strings would be the thing that ends that.
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
 * Field specs per entity.
 *
 * Deliberately a superset of what the four original processors read — the extra keys
 * (handle, description, option matrix, images, SEO) are what let a Shopify export
 * arrive as a real multi-variant product instead of one flat row per line.
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
    { key: 'collections', label: 'Collections', kind: 'list' },
    { key: 'price', label: 'Price', kind: 'money' },
    { key: 'compare_at_price', label: 'Compare-at price', kind: 'money' },
    { key: 'cost_per_item', label: 'Cost', kind: 'money' },
    { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
    { key: 'barcode', label: 'Barcode', kind: 'text', max: 100 },
    { key: 'track_inventory', label: 'Track stock', kind: 'boolean' },
    { key: 'quantity', label: 'Quantity', kind: 'integer' },
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
      label: 'Fulfilment',
      kind: 'enum',
      values: ['physical', 'digital', 'service'],
    },
    { key: 'requires_shipping', label: 'Needs shipping', kind: 'boolean' },
    { key: 'taxable', label: 'Taxable', kind: 'boolean' },
    { key: 'option1_name', label: 'Option 1 name', kind: 'text', max: 100 },
    { key: 'option1_value', label: 'Option 1 value', kind: 'text', max: 255 },
    { key: 'option2_name', label: 'Option 2 name', kind: 'text', max: 100 },
    { key: 'option2_value', label: 'Option 2 value', kind: 'text', max: 255 },
    { key: 'option3_name', label: 'Option 3 name', kind: 'text', max: 100 },
    { key: 'option3_value', label: 'Option 3 value', kind: 'text', max: 255 },
    { key: 'image_url', label: 'Image URL', kind: 'url' },
    { key: 'image_alt', label: 'Image alt text', kind: 'text', max: 512 },
    { key: 'image_position', label: 'Image position', kind: 'integer' },
    {
      key: 'images',
      label: 'All image URLs',
      kind: 'list',
      help: 'The product gallery, in order. Carried on the first row of each product; every commerce export spreads these across continuation rows and we re-gather them.',
    },
    { key: 'variant_image_url', label: 'Variant image URL', kind: 'url' },
    { key: 'seo_title', label: 'SEO title', kind: 'text', max: 255 },
    { key: 'seo_description', label: 'SEO description', kind: 'text', max: 512 },
    { key: 'published_at', label: 'Published', kind: 'date' },
    {
      key: 'source_url',
      label: 'Old URL',
      kind: 'url',
      help: 'Where this product lived on the old platform. Used to build a redirect so existing links keep working.',
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
    { key: 'available', label: 'Available', kind: 'integer' },
    { key: 'incoming', label: 'Incoming', kind: 'integer' },
    { key: 'reorder_point', label: 'Reorder at', kind: 'integer' },
    { key: 'reorder_quantity', label: 'Reorder amount', kind: 'integer' },
    { key: 'bin', label: 'Bin', kind: 'text', max: 100 },
    { key: 'cost_per_item', label: 'Unit cost', kind: 'money' },
    { key: 'barcode', label: 'Barcode', kind: 'text', max: 100 },
  ],

  customers: [
    { key: 'email', label: 'Email', kind: 'email', naturalKey: true, max: 320 },
    { key: 'first_name', label: 'First name', kind: 'text', max: 100 },
    { key: 'last_name', label: 'Last name', kind: 'text', max: 100 },
    { key: 'name', label: 'Full name', kind: 'text', max: 255 },
    { key: 'phone', label: 'Phone', kind: 'phone', naturalKey: true, max: 50 },
    { key: 'company', label: 'Company', kind: 'text', max: 255 },
    { key: 'type', label: 'Type', kind: 'enum', values: ['person', 'company'] },
    { key: 'accepts_marketing', label: 'Email opt-in', kind: 'boolean' },
    { key: 'accepts_sms', label: 'SMS opt-in', kind: 'boolean' },
    { key: 'address1', label: 'Address line 1', kind: 'text', max: 255 },
    { key: 'address2', label: 'Address line 2', kind: 'text', max: 255 },
    { key: 'city', label: 'City', kind: 'text', max: 128 },
    { key: 'province', label: 'State / region', kind: 'text', max: 128 },
    { key: 'country', label: 'Country', kind: 'text', max: 128 },
    { key: 'zip', label: 'Postcode', kind: 'text', max: 32 },
    { key: 'tags', label: 'Tags', kind: 'list' },
    { key: 'note', label: 'Note', kind: 'text' },
    { key: 'total_spent', label: 'Lifetime spend', kind: 'money' },
    { key: 'total_orders', label: 'Order count', kind: 'integer' },
    { key: 'created_at', label: 'Customer since', kind: 'date' },
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
    { key: 'fulfillment_status', label: 'Fulfilment status', kind: 'text', max: 50 },
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
    { key: 'ship_zip', label: 'Ship to postcode', kind: 'text', max: 32 },
    { key: 'note', label: 'Note', kind: 'text' },
  ],

  categories: [
    { key: 'name', label: 'Name', kind: 'text', required: true, naturalKey: true, max: 255 },
    { key: 'slug', label: 'Slug', kind: 'slug', naturalKey: true, max: 255 },
    { key: 'parent', label: 'Parent', kind: 'text', max: 255 },
    { key: 'description', label: 'Description', kind: 'html' },
    { key: 'position', label: 'Position', kind: 'integer' },
    { key: 'image_url', label: 'Image URL', kind: 'url' },
  ],

  collections: [
    { key: 'name', label: 'Name', kind: 'text', required: true, naturalKey: true, max: 255 },
    { key: 'slug', label: 'Slug', kind: 'slug', naturalKey: true, max: 255 },
    { key: 'description', label: 'Description', kind: 'html' },
    { key: 'products', label: 'Product handles or SKUs', kind: 'list' },
    { key: 'image_url', label: 'Image URL', kind: 'url' },
    { key: 'published', label: 'Published', kind: 'boolean' },
  ],

  discounts: [
    { key: 'code', label: 'Code', kind: 'text', required: true, naturalKey: true, max: 100 },
    { key: 'title', label: 'Name', kind: 'text', max: 255 },
    {
      key: 'type',
      label: 'Type',
      kind: 'enum',
      values: ['percentage', 'fixed_amount', 'free_shipping'],
    },
    { key: 'value', label: 'Value', kind: 'decimal' },
    { key: 'minimum_amount', label: 'Minimum spend', kind: 'money' },
    { key: 'usage_limit', label: 'Usage limit', kind: 'integer' },
    { key: 'starts_at', label: 'Starts', kind: 'date' },
    { key: 'ends_at', label: 'Ends', kind: 'date' },
    {
      key: 'status',
      label: 'Status',
      kind: 'enum',
      values: ['active', 'scheduled', 'expired', 'disabled'],
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
    { key: 'updated_at', label: 'Updated', kind: 'date' },
    { key: 'categories', label: 'Categories', kind: 'list' },
    { key: 'tags', label: 'Tags', kind: 'list' },
    { key: 'featured_image_url', label: 'Featured image', kind: 'url' },
    { key: 'seo_title', label: 'SEO title', kind: 'text', max: 255 },
    { key: 'seo_description', label: 'SEO description', kind: 'text', max: 512 },
    { key: 'source_url', label: 'Old URL', kind: 'url' },
  ],

  media: [
    { key: 'url', label: 'File URL', kind: 'url', required: true, naturalKey: true },
    { key: 'filename', label: 'Filename', kind: 'text', max: 255 },
    { key: 'alt', label: 'Alt text', kind: 'text', max: 512 },
    { key: 'title', label: 'Title', kind: 'text', max: 255 },
    { key: 'caption', label: 'Caption', kind: 'text' },
    { key: 'uploaded_at', label: 'Uploaded', kind: 'date' },
  ],

  redirects: [
    { key: 'from', label: 'Old path', kind: 'text', required: true, naturalKey: true, max: 2048 },
    { key: 'to', label: 'New path', kind: 'text', required: true, max: 2048 },
    { key: 'status_code', label: 'Type', kind: 'enum', values: ['301', '302'] },
  ],

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
    { key: 'phone', label: 'Phone', kind: 'phone', max: 50 },
    { key: 'industry', label: 'Industry', kind: 'text', max: 255 },
    { key: 'employees', label: 'Employees', kind: 'integer' },
    { key: 'annual_revenue', label: 'Annual revenue', kind: 'money' },
    { key: 'address1', label: 'Address line 1', kind: 'text', max: 255 },
    { key: 'city', label: 'City', kind: 'text', max: 128 },
    { key: 'province', label: 'State / region', kind: 'text', max: 128 },
    { key: 'country', label: 'Country', kind: 'text', max: 128 },
    { key: 'zip', label: 'Postcode', kind: 'text', max: 32 },
    { key: 'owner_email', label: 'Owner', kind: 'email', max: 320 },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'created_at', label: 'Created', kind: 'date' },
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
    { key: 'created_at', label: 'Created', kind: 'date' },
  ],

  tickets: [
    { key: 'subject', label: 'Subject', kind: 'text', required: true, naturalKey: true, max: 512 },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'text', max: 100 },
    {
      key: 'priority',
      label: 'Priority',
      kind: 'enum',
      values: ['low', 'normal', 'high', 'urgent'],
    },
    { key: 'pipeline', label: 'Pipeline', kind: 'text', max: 255 },
    { key: 'stage', label: 'Stage', kind: 'text', max: 255 },
    { key: 'contact_email', label: 'Contact', kind: 'email', max: 320 },
    { key: 'company', label: 'Company', kind: 'text', max: 255 },
    { key: 'owner_email', label: 'Assigned to', kind: 'email', max: 320 },
    { key: 'created_at', label: 'Opened', kind: 'date' },
    { key: 'closed_at', label: 'Closed', kind: 'date' },
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
    { key: 'minimum_order', label: 'Minimum order', kind: 'money' },
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
    { key: 'status', label: 'Status', kind: 'text', max: 50 },
    { key: 'ordered_at', label: 'Ordered', kind: 'date' },
    { key: 'expected_at', label: 'Expected', kind: 'date' },
    { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
    { key: 'line_sku', label: 'Line SKU', kind: 'text', max: 100 },
    { key: 'line_quantity', label: 'Line quantity', kind: 'integer' },
    { key: 'line_cost', label: 'Line unit cost', kind: 'money' },
    { key: 'note', label: 'Note', kind: 'text' },
  ],

  b2b_accounts: [
    {
      key: 'name',
      label: 'Account name',
      kind: 'text',
      required: true,
      naturalKey: true,
      max: 255,
    },
    { key: 'email', label: 'Primary contact', kind: 'email', naturalKey: true, max: 320 },
    { key: 'tier', label: 'Pricing tier', kind: 'text', max: 255 },
    { key: 'payment_terms', label: 'Payment terms', kind: 'text', max: 100 },
    { key: 'credit_limit', label: 'Credit limit', kind: 'money' },
    { key: 'tax_exempt', label: 'Tax exempt', kind: 'boolean' },
    { key: 'phone', label: 'Phone', kind: 'phone', max: 50 },
    { key: 'address1', label: 'Address line 1', kind: 'text', max: 255 },
    { key: 'city', label: 'City', kind: 'text', max: 128 },
    { key: 'province', label: 'State / region', kind: 'text', max: 128 },
    { key: 'country', label: 'Country', kind: 'text', max: 128 },
    { key: 'zip', label: 'Postcode', kind: 'text', max: 32 },
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
