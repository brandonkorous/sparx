// WordPress and WooCommerce, live — one connector, because underneath they are one
// site.
//
// This is the connector that saves the most work, and for an unglamorous reason: the
// WordPress path is the one where the file route asks the most of the tenant. The
// catalogue comes out of WooCommerce's exporter, the posts come out of WordPress's
// exporter underneath it, they are in different menus, and the second one produces a
// 90 MB XML file that a browser can only just read. One site address and two keys
// replaces all of that.
//
// Two different authentications, because there genuinely are two APIs:
//
//   /wp-json/wc/v3/*  WooCommerce. Consumer key + secret, made in WooCommerce itself.
//   /wp-json/wp/v2/*  WordPress core. Published content needs no key at all; drafts
//                     need an application password, which is why that pair is
//                     optional and the field help says what leaving it out costs.
//
// A site with no shop is a first-class case here, not a degraded one — a publisher
// leaving WordPress supplies an address and nothing else, and their posts, pages and
// media library all come across.

import type { CanonicalRow } from '../canonical';
import { woocommerceInternals } from '../vendors/woocommerce';
import type { SourceRow } from '../parse/csv';
import {
  ConnectorError,
  asArray,
  asRecord,
  asText,
  assertSafeUrl,
  dig,
  digText,
  firstText,
  query,
  requestJson,
} from './http';
import type { Connector, Credentials, FetchLike, PullInput, PullPage } from './types';

const PAGE = { products: 25, orders: 25, simple: 100 };

/** `example.com`, `https://example.com/`, `https://example.com/blog` all become a
 *  usable base. Tenants paste all three, and the third one matters — WordPress in a
 *  subdirectory is extremely common and its REST root is under that subdirectory. */
function siteBase(credentials: Credentials): string {
  const raw = (credentials.siteUrl ?? '').trim();
  if (raw === '') {
    throw new ConnectorError('We need the web address of your site.', {
      hint: 'The one people visit — https://yourbusiness.com.',
    });
  }
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = assertSafeUrl(withScheme);
  const path = url.pathname.replace(/\/+$/, '');
  // Somebody pasting the REST root itself should not end up with it twice.
  const trimmed = path.replace(/\/wp-json.*$/, '').replace(/\/wp-admin.*$/, '');
  return `${url.origin}${trimmed}`;
}

function base64(value: string): string {
  if (typeof btoa === 'function') {
    // btoa is byte-oriented; a key with a non-ASCII character would throw otherwise.
    return btoa(
      encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_match, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      )
    );
  }
  /* c8 ignore next 2 -- Node ≥16 and every browser have btoa; this is the belt. */
  const globalBuffer = (
    globalThis as {
      Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } };
    }
  ).Buffer;
  if (globalBuffer !== undefined) return globalBuffer.from(value, 'utf8').toString('base64');
  throw new ConnectorError('This browser cannot sign the request to your site.');
}

function hasWooKeys(credentials: Credentials): boolean {
  return (
    (credentials.consumerKey ?? '').trim() !== '' &&
    (credentials.consumerSecret ?? '').trim() !== ''
  );
}

function hasWpLogin(credentials: Credentials): boolean {
  return (
    (credentials.username ?? '').trim() !== '' &&
    (credentials.applicationPassword ?? '').trim() !== ''
  );
}

/**
 * A WooCommerce request.
 *
 * Basic auth over HTTPS is what WooCommerce documents, but a large minority of hosts
 * strip the Authorization header before PHP ever sees it (mod_php + CGI is the usual
 * culprit), and on those the documented method returns 401 forever. WooCommerce
 * accepts the keys as query parameters for exactly this reason, so a 401 on the
 * header route is retried that way before it becomes the tenant's problem. Without
 * this fallback the connector simply does not work on a chunk of shared hosting.
 */
async function wooGet(
  fetchLike: FetchLike,
  credentials: Credentials,
  path: string,
  params: Record<string, string | number | undefined>,
  what: string
): Promise<unknown> {
  if (!hasWooKeys(credentials)) {
    throw new ConnectorError(`Reading ${what} needs your WooCommerce keys.`, {
      hint: 'WooCommerce → Settings → Advanced → REST API → Add key, with Read permission.',
    });
  }

  const base = siteBase(credentials);
  const key = credentials.consumerKey!.trim();
  const secret = credentials.consumerSecret!.trim();
  const url = `${base}/wp-json/wc/v3/${path}${query(params)}`;

  try {
    return await requestJson(fetchLike, url, {
      headers: { Authorization: `Basic ${base64(`${key}:${secret}`)}`, Accept: 'application/json' },
      what,
    });
  } catch (error) {
    if (!(error instanceof ConnectorError) || (error.status !== 401 && error.status !== 403))
      throw error;
    return requestJson(
      fetchLike,
      `${base}/wp-json/wc/v3/${path}${query({ ...params, consumer_key: key, consumer_secret: secret })}`,
      { headers: { Accept: 'application/json' }, what }
    );
  }
}

/** A WordPress core request. Signed only if the tenant gave us a login. */
function wpGet(
  fetchLike: FetchLike,
  credentials: Credentials,
  path: string,
  params: Record<string, string | number | undefined>,
  what: string
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (hasWpLogin(credentials)) {
    const user = credentials.username!.trim();
    // WordPress prints application passwords in spaced groups of four; people paste
    // them exactly as printed, and WordPress itself ignores the spaces.
    const password = credentials.applicationPassword!.replace(/\s+/g, '');
    headers.Authorization = `Basic ${base64(`${user}:${password}`)}`;
  }
  return requestJson(fetchLike, `${siteBase(credentials)}/wp-json/wp/v2/${path}${query(params)}`, {
    headers,
    what,
  });
}

/** Page-number cursors. WordPress pages by number, not by opaque token. */
function pageNumber(cursor: string | null, prefix = ''): number {
  if (cursor === null) return 1;
  const raw = prefix === '' ? cursor : cursor.slice(prefix.length);
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}

// ── Products ─────────────────────────────────────────────────────────────────

/** WooCommerce's REST product → the column names its own CSV exporter writes, so the
 *  CSV mapper's parent/variation joining and its sale-price inversion both apply. */
function productRow(product: Record<string, unknown>, type: string, parentId: string): SourceRow {
  const categories = asArray(product.categories)
    .map((category) => asText(asRecord(category).name))
    .filter((name) => name !== '');
  const images = asArray(product.images)
    .map((image) => asText(asRecord(image).src))
    .filter((src) => src !== '');
  const dimensions = asRecord(product.dimensions);

  const row: SourceRow = {
    ID: asText(product.id),
    Type: type,
    SKU: asText(product.sku),
    Name: asText(product.name),
    Description: asText(product.description),
    'Short description': asText(product.short_description),
    Published: asText(product.status) === 'publish' ? '1' : '0',
    'Regular price': asText(product.regular_price),
    'Sale price': asText(product.sale_price),
    Stock: asText(product.stock_quantity),
    'Tax status': asText(product.tax_status),
    'Weight (kg)': asText(product.weight),
    'Length (cm)': asText(dimensions.length),
    'Width (cm)': asText(dimensions.width),
    'Height (cm)': asText(dimensions.height),
    Categories: categories.join(', '),
    Tags: asArray(product.tags)
      .map((tag) => asText(asRecord(tag).name))
      .filter((name) => name !== '')
      .join(', '),
    Images: images.join(', '),
  };

  if (parentId !== '') row.Parent = `id:${parentId}`;

  // Attributes are `Attribute 1 name` / `Attribute 1 value(s)` in the CSV. On a
  // variation the REST shape is `attributes: [{ name, option }]`; on a parent it is
  // `[{ name, options: [] }]`. Both flatten to the same two columns.
  asArray(product.attributes)
    .slice(0, 3)
    .forEach((rawAttribute, index) => {
      const attribute = asRecord(rawAttribute);
      const values = asArray(attribute.options)
        .map(asText)
        .filter((value) => value !== '');
      row[`Attribute ${index + 1} name`] = asText(attribute.name);
      row[`Attribute ${index + 1} value(s)`] =
        values.length > 0 ? values.join(', ') : asText(attribute.option);
    });

  return row;
}

/**
 * One page of products, plus the variations of any variable product on it.
 *
 * The extra calls are the price of getting variants at all: WooCommerce's REST puts
 * them on a sub-resource, and a "product" without them is a T-shirt with no sizes and
 * no price. Only variable products cost a call, and the page is deliberately small
 * (25) so a page of all-variable products is a bounded number of them rather than a
 * request that never returns.
 */
async function pullProducts(input: PullInput): Promise<PullPage> {
  const page = pageNumber(input.cursor);
  const body = asArray(
    await wooGet(
      input.fetch,
      input.credentials,
      'products',
      { per_page: PAGE.products, page, status: 'any', orderby: 'id', order: 'asc' },
      'your products'
    )
  );

  const rows: SourceRow[] = [];
  for (const raw of body) {
    const product = asRecord(raw);
    const type = asText(product.type);
    if (type === 'variable') {
      rows.push(productRow(product, 'variable', ''));
      const variations = asArray(
        await wooGet(
          input.fetch,
          input.credentials,
          `products/${asText(product.id)}/variations`,
          { per_page: PAGE.simple },
          'your product options'
        )
      );
      for (const rawVariation of variations) {
        rows.push(productRow(asRecord(rawVariation), 'variation', asText(product.id)));
      }
      continue;
    }
    rows.push(productRow(product, type === '' ? 'simple' : type, ''));
  }

  return {
    entity: 'products',
    rows: woocommerceInternals.mapProducts(rows),
    fetched: body.length,
    nextCursor: body.length < PAGE.products ? null : String(page + 1),
  };
}

// ── The rest of the shop ─────────────────────────────────────────────────────

function customerRows(body: unknown[]): CanonicalRow[] {
  return woocommerceInternals.mapCustomers(
    body.map((raw) => {
      const customer = asRecord(raw);
      const billing = asRecord(customer.billing);
      const first = asText(customer.first_name);
      const last = asText(customer.last_name);
      return {
        Email: firstText(asText(customer.email), asText(billing.email)),
        Name: `${first} ${last}`.trim(),
        City: asText(billing.city),
        Region: asText(billing.state),
        'Country / Region': asText(billing.country),
        'Postal code': asText(billing.postcode),
        'Sign up': asText(customer.date_created),
      };
    })
  );
}

function categoryRows(body: unknown[]): CanonicalRow[] {
  const byId = new Map<string, string>();
  for (const raw of body) {
    const category = asRecord(raw);
    byId.set(asText(category.id), asText(category.name));
  }

  const rows: CanonicalRow[] = [];
  for (const raw of body) {
    const category = asRecord(raw);
    const name = asText(category.name);
    if (name === '') continue;
    const row: CanonicalRow = { name };
    const slug = asText(category.slug);
    if (slug !== '') row.slug = slug;
    const description = asText(category.description);
    if (description !== '') row.description = description;
    const image = digText(category, 'image', 'src');
    if (image !== '') row.image_url = image;
    // A parent only resolves if it is on the same page, which it usually is —
    // WooCommerce returns categories parents-first. An unresolved one becomes a root
    // category rather than a dropped one.
    const parent = byId.get(asText(category.parent));
    if (parent !== undefined && parent !== '') row.parent = parent;
    rows.push(row);
  }
  return rows;
}

/** Orders flattened to one row per line item, which is the shape the processor
 *  regroups — the same shape every commerce CSV on the roster arrives in. */
function orderRows(body: unknown[]): CanonicalRow[] {
  const rows: CanonicalRow[] = [];

  for (const raw of body) {
    const order = asRecord(raw);
    const number = firstText(asText(order.number), asText(order.id));
    if (number === '') continue;

    const billing = asRecord(order.billing);
    const shipping = asRecord(order.shipping);
    const status = asText(order.status);
    const paid = asText(order.date_paid) !== '';

    const head: CanonicalRow = {
      order_number: number,
      email: asText(billing.email),
      customer_name: `${asText(billing.first_name)} ${asText(billing.last_name)}`.trim(),
      phone: asText(billing.phone),
      placed_at: asText(order.date_created),
      currency: asText(order.currency),
      // WooCommerce has ONE status where we have two axes. `completed` means both
      // paid and shipped; `processing` means paid and not yet shipped; `refunded`
      // and `cancelled` speak for themselves.
      financial_status: status === 'refunded' ? 'refunded' : paid ? 'paid' : 'pending',
      fulfillment_status:
        status === 'completed'
          ? 'fulfilled'
          : status === 'cancelled'
            ? 'cancelled'
            : status === 'refunded'
              ? 'refunded'
              : '',
      total: asText(order.total),
      tax: asText(order.total_tax),
      discount: asText(order.discount_total),
      shipping: asText(order.shipping_total),
      ship_name: `${asText(shipping.first_name)} ${asText(shipping.last_name)}`.trim(),
      ship_address1: asText(shipping.address_1),
      ship_address2: asText(shipping.address_2),
      ship_city: asText(shipping.city),
      ship_province: asText(shipping.state),
      ship_country: asText(shipping.country),
      ship_zip: asText(shipping.postcode),
      note: asText(order.customer_note),
    };

    const codes = asArray(order.coupon_lines)
      .map((line) => asText(asRecord(line).code))
      .filter((code) => code !== '');
    if (codes.length > 0) head.discount_code = codes.join(', ');
    const method = firstText(
      ...asArray(order.shipping_lines).map((line) => asText(asRecord(line).method_title))
    );
    if (method !== '') head.shipping_method = method;

    const lines = asArray(order.line_items);
    if (lines.length === 0) {
      rows.push(head);
      continue;
    }

    lines.forEach((rawLine, index) => {
      const line = asRecord(rawLine);
      const quantity = Number(asText(line.quantity)) || 1;
      const total = Number(asText(line.total));
      rows.push({
        ...(index === 0 ? head : { order_number: number }),
        line_sku: asText(line.sku),
        line_title: asText(line.name),
        line_quantity: String(quantity),
        // WooCommerce's `total` is the whole line; every other platform on the roster
        // writes the unit price, and the processor expects the unit price.
        line_price: Number.isFinite(total) ? String(total / quantity) : asText(line.price),
      });
    });
  }

  return rows;
}

// ── Content and the media library ────────────────────────────────────────────

/** `_embed` returns terms as nested arrays keyed by taxonomy — categories first,
 *  tags second, in the order the taxonomies were registered. Read by name rather
 *  than position, because a site with custom taxonomies reorders them. */
function embeddedTerms(source: Record<string, unknown>): { categories: string[]; tags: string[] } {
  const categories: string[] = [];
  const tags: string[] = [];
  for (const group of asArray(dig(source, '_embedded', 'wp:term'))) {
    for (const rawTerm of asArray(group)) {
      const term = asRecord(rawTerm);
      const name = asText(term.name);
      if (name === '') continue;
      const taxonomy = asText(term.taxonomy);
      if (taxonomy === 'category') categories.push(name);
      else if (taxonomy === 'post_tag') tags.push(name);
    }
  }
  return { categories, tags };
}

const WP_STATUS: Record<string, string> = {
  publish: 'published',
  future: 'scheduled',
  draft: 'draft',
  pending: 'draft',
  private: 'draft',
  trash: 'archived',
};

function contentRows(body: unknown[], kind: 'post' | 'page', base: string): CanonicalRow[] {
  const rows: CanonicalRow[] = [];

  for (const raw of body) {
    const source = asRecord(raw);
    const title = digText(source, 'title', 'rendered');
    if (title === '') continue;

    const { categories, tags } = embeddedTerms(source);
    const row: CanonicalRow = { title, type: kind };

    const slug = asText(source.slug);
    if (slug !== '') row.slug = slug;
    const body_ = digText(source, 'content', 'rendered');
    if (body_ !== '') row.body = body_;
    const excerpt = digText(source, 'excerpt', 'rendered');
    if (excerpt !== '') row.excerpt = excerpt;
    const status = WP_STATUS[asText(source.status)];
    if (status !== undefined) row.status = status;
    const published = firstText(asText(source.date_gmt), asText(source.date));
    if (published !== '') row.published_at = published;
    const modified = firstText(asText(source.modified_gmt), asText(source.modified));
    if (modified !== '') row.updated_at = modified;
    if (categories.length > 0) row.categories = categories.join(', ');
    if (tags.length > 0) row.tags = tags.join(', ');

    const author = firstText(
      ...asArray(dig(source, '_embedded', 'author')).map((entry) => asText(asRecord(entry).name))
    );
    if (author !== '') row.author = author;

    const featured = firstText(
      ...asArray(dig(source, '_embedded', 'wp:featuredmedia')).map((entry) =>
        asText(asRecord(entry).source_url)
      )
    );
    if (featured !== '') row.featured_image_url = featured;

    // The old permalink, made relative — this is what the redirect is built from, and
    // it is the difference between keeping the site's search rankings and starting
    // over. WordPress permalinks are almost never `/slug`, so taking the link the
    // site itself published is the only way to get it right.
    const link = asText(source.link);
    if (link.startsWith(base)) {
      const path = link.slice(base.length) || '/';
      row.source_url = path.startsWith('/') ? path : `/${path}`;
    }

    rows.push(row);
  }

  return rows;
}

function mediaRows(body: unknown[]): CanonicalRow[] {
  const rows: CanonicalRow[] = [];
  for (const raw of body) {
    const media = asRecord(raw);
    const url = asText(media.source_url);
    if (url === '') continue;
    const row: CanonicalRow = { url };
    const filename = url.split('/').pop();
    if (filename !== undefined && filename !== '') row.filename = filename;
    const alt = asText(media.alt_text);
    if (alt !== '') row.alt = alt;
    const title = digText(media, 'title', 'rendered');
    if (title !== '') row.title = title;
    const caption = digText(media, 'caption', 'rendered');
    if (caption !== '') row.caption = caption;
    const uploaded = firstText(asText(media.date_gmt), asText(media.date));
    if (uploaded !== '') row.uploaded_at = uploaded;
    rows.push(row);
  }
  return rows;
}

/** Posts first, then pages — one entity from two endpoints, same shape as Shopify's
 *  pages-then-blog walk and encoded in the cursor for the same reason. */
async function pullContent(input: PullInput): Promise<PullPage> {
  const cursor = input.cursor ?? 'posts:1';
  const stage = cursor.startsWith('pages:') ? 'pages' : 'posts';
  const page = pageNumber(cursor, `${stage}:`);
  const base = siteBase(input.credentials);

  const body = asArray(
    await wpGet(
      input.fetch,
      input.credentials,
      stage,
      {
        per_page: PAGE.simple,
        page,
        // Drafts need the login; without one WordPress rejects `status=any`
        // outright, so asking for it would break the no-credentials case entirely.
        status: hasWpLogin(input.credentials) ? 'publish,draft,pending,private,future' : 'publish',
        orderby: 'id',
        order: 'asc',
        _embed: 'author,wp:term,wp:featuredmedia',
      },
      stage === 'posts' ? 'your blog posts' : 'your pages'
    )
  );

  const more = body.length >= PAGE.simple;
  return {
    entity: 'content',
    rows: contentRows(body, stage === 'posts' ? 'post' : 'page', base),
    fetched: body.length,
    nextCursor: more ? `${stage}:${page + 1}` : stage === 'posts' ? 'pages:1' : null,
  };
}

// ── The connector ────────────────────────────────────────────────────────────

export const wordpressConnector: Connector = {
  slug: 'wordpress',
  label: 'WordPress & WooCommerce',
  vendors: ['wordpress', 'woocommerce'],
  instructions: [
    'Your posts, pages and media come across with just the web address of your site — nothing else to set up.',
    'For drafts as well as published posts: in WordPress go to Users → Profile → Application Passwords, add one called "migration", and copy what it gives you along with your username.',
    'If you sell with WooCommerce: WooCommerce → Settings → Advanced → REST API → Add key, set Permissions to Read, and copy the consumer key and consumer secret.',
    'Both keys are read-only. Nothing here can change anything on your old site.',
  ],
  fields: [
    {
      key: 'siteUrl',
      label: 'Your website address',
      help: 'The address people visit. If WordPress lives in a folder, include the folder.',
      placeholder: 'https://yourbusiness.com',
      secret: false,
      required: true,
    },
    {
      key: 'consumerKey',
      label: 'WooCommerce consumer key',
      help: 'Only if you sell. Leave both blank and we will bring your posts, pages and images.',
      placeholder: 'ck_…',
      secret: false,
      required: false,
      pattern: '^ck_[A-Za-z0-9]{20,}$',
      patternHint: 'WooCommerce consumer keys start with ck_.',
    },
    {
      key: 'consumerSecret',
      label: 'WooCommerce consumer secret',
      help: 'Shown next to the key, once, on the same screen.',
      placeholder: 'cs_…',
      secret: true,
      required: false,
      pattern: '^cs_[A-Za-z0-9]{20,}$',
      patternHint: 'WooCommerce consumer secrets start with cs_.',
    },
    {
      key: 'username',
      label: 'WordPress username',
      help: 'Only needed if you want drafts and private pages as well as published ones.',
      secret: false,
      required: false,
    },
    {
      key: 'applicationPassword',
      label: 'Application password',
      help: 'From Users → Profile → Application Passwords. Not your normal login password — paste it exactly as WordPress shows it, spaces and all.',
      placeholder: 'xxxx xxxx xxxx xxxx xxxx xxxx',
      secret: true,
      required: false,
    },
  ],
  resources: [
    {
      entity: 'content',
      label: 'Posts and pages',
      pageSize: PAGE.simple,
      note: 'Published ones need nothing. Drafts need the application password.',
    },
    { entity: 'media', label: 'The media library', pageSize: PAGE.simple },
    {
      entity: 'products',
      label: 'Products and their options',
      pageSize: PAGE.products,
      requires: 'consumerKey',
    },
    {
      entity: 'categories',
      label: 'Product categories',
      pageSize: PAGE.simple,
      requires: 'consumerKey',
    },
    { entity: 'customers', label: 'Customers', pageSize: PAGE.simple, requires: 'consumerKey' },
    { entity: 'orders', label: 'Order history', pageSize: PAGE.orders, requires: 'consumerKey' },
  ],

  async verify({ credentials, fetch }) {
    const base = siteBase(credentials);
    const root = await requestJson(fetch, `${base}/wp-json`, {
      headers: { Accept: 'application/json' },
      what: 'your site',
    });

    const name = digText(root, 'name');
    const namespaces = asArray(dig(root, 'namespaces')).map(asText);
    if (namespaces.length === 0 && name === '') {
      throw new ConnectorError('That address answered, but it is not a WordPress site.', {
        hint: 'Check the address — and if WordPress lives in a folder like /blog, include the folder.',
      });
    }

    const shop = namespaces.includes('wc/v3');
    if (hasWooKeys(credentials)) {
      if (!shop) {
        throw new ConnectorError('We could not find WooCommerce on that site.', {
          hint: 'The address is right but WooCommerce is not installed there, so there is no shop to read. Clear the two keys to bring the content across on its own.',
        });
      }
      // Prove the keys before the tenant picks what to move — a 401 discovered
      // halfway through a catalogue is a far worse moment to find out.
      await wooGet(fetch, credentials, 'products', { per_page: 1 }, 'your products');
    }

    return {
      account: name === '' ? base.replace(/^https?:\/\//, '') : name,
      detail: shop
        ? hasWooKeys(credentials)
          ? 'WordPress with WooCommerce — content and shop'
          : 'WooCommerce is here; add the two keys below to bring the shop as well'
        : 'WordPress',
    };
  },

  async pull(input) {
    if (input.entity === 'products') return pullProducts(input);
    if (input.entity === 'content') return pullContent(input);

    const page = pageNumber(input.cursor);

    if (input.entity === 'media') {
      const body = asArray(
        await wpGet(
          input.fetch,
          input.credentials,
          'media',
          { per_page: PAGE.simple, page, orderby: 'id', order: 'asc' },
          'your media library'
        )
      );
      return {
        entity: 'media',
        rows: mediaRows(body),
        fetched: body.length,
        nextCursor: body.length < PAGE.simple ? null : String(page + 1),
      };
    }

    const shop: Record<
      string,
      { path: string; what: string; size: number; rows: (body: unknown[]) => CanonicalRow[] }
    > = {
      customers: {
        path: 'customers',
        what: 'your customers',
        size: PAGE.simple,
        rows: customerRows,
      },
      categories: {
        path: 'products/categories',
        what: 'your product categories',
        size: PAGE.simple,
        rows: categoryRows,
      },
      orders: { path: 'orders', what: 'your orders', size: PAGE.orders, rows: orderRows },
    };

    const resource = shop[input.entity];
    if (resource === undefined) {
      throw new ConnectorError(`We do not read ${input.entity} from WordPress.`);
    }

    const body = asArray(
      await wooGet(
        input.fetch,
        input.credentials,
        resource.path,
        {
          per_page: resource.size,
          page,
          orderby: 'id',
          order: 'asc',
          ...(input.entity === 'orders' ? { status: 'any' } : {}),
        },
        resource.what
      )
    );

    return {
      entity: input.entity,
      rows: resource.rows(body),
      fetched: body.length,
      nextCursor: body.length < resource.size ? null : String(page + 1),
    };
  },
};
