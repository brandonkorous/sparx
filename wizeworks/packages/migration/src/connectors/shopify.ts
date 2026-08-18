// Shopify, live.
//
// The file path already carries products, customers, orders, stock, discounts and
// redirects — so this connector exists for two reasons, and only two.
//
// The first is the things Shopify has NO export for: collections, pages and blog
// posts. `vendors/shopify.ts` says so in a comment and the marketing page says so in
// print — "your collections and your blog come across through the live connection" —
// which means this file is what keeps that sentence honest.
//
// The second is that a tenant with 40,000 products does not want to download six
// files. One access token and a progress bar beats six trips through an export queue
// that emails you a link.
//
// Everything here flattens the Admin API's shapes back into the column names
// Shopify's own CSV uses, then hands them to the mappers in `vendors/shopify.ts`.
// That indirection looks redundant for about a minute and then stops looking that
// way: the weight-unit conversion, the negative-percentage discounts, the option
// matrix and the gallery re-gathering are all quirks those mappers already handle
// correctly and have tests for. A second set of mappers for the API would be a second
// set of those bugs.

import type { CanonicalRow } from '../canonical';
import { shopifyInternals } from '../vendors/shopify';
import type { SourceRow } from '../parse/csv';
import { ConnectorError, asArray, asRecord, asText, dig, digText, requestJson } from './http';
import type { Connector, Credentials, FetchLike, PullInput, PullPage } from './types';

/**
 * Admin API version.
 *
 * Shopify supports each quarterly version for twelve months and then removes it, so
 * this is a maintenance date, not a constant. When it lapses every call here returns
 * a 400 with a message naming the version — which is why the error path passes the
 * vendor's own text through rather than swallowing it.
 */
const API_VERSION = '2026-01';

/** Shopify's page sizes are cost-based rather than count-based; these are the sizes
 *  that stay inside the default 1,000-point bucket with the nested fields we ask for. */
const PAGE = { products: 25, variants: 100, customers: 100, orders: 25, simple: 50 };

function shopDomain(credentials: Credentials): string {
  const raw = (credentials.shop ?? '').trim().toLowerCase();
  if (raw === '') {
    throw new ConnectorError('We need your Shopify store address.', {
      hint: 'It looks like your-store.myshopify.com — you can see it in the address bar of your Shopify admin.',
    });
  }
  // Tenants paste all of these: the bare handle, the domain, the full admin URL.
  const host = raw
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^admin\./, '');
  const domain = host.includes('.') ? host : `${host}.myshopify.com`;
  if (!domain.endsWith('.myshopify.com')) {
    throw new ConnectorError(`${domain} is not a Shopify store address.`, {
      hint: 'Use the .myshopify.com one rather than your own domain name — Shopify only answers on that one.',
    });
  }
  return domain;
}

function accessToken(credentials: Credentials): string {
  const token = (credentials.accessToken ?? '').trim();
  if (token === '') {
    throw new ConnectorError('We need the access token from your Shopify app.', {
      hint: 'Settings → Apps and sales channels → Develop apps → your app → API credentials.',
    });
  }
  return token;
}

/** One GraphQL call. Shopify answers 200 with an `errors` array for a bad query or a
 *  missing scope, so a non-error status proves nothing on its own. */
async function graphql(
  fetchLike: FetchLike,
  credentials: Credentials,
  document: string,
  variables: Record<string, unknown>,
  what: string
): Promise<Record<string, unknown>> {
  const body = await requestJson(
    fetchLike,
    `https://${shopDomain(credentials)}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken(credentials),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: document, variables }),
      what,
    }
  );

  const errors = asArray(dig(body, 'errors'));
  if (errors.length > 0) {
    const first = asRecord(errors[0]);
    const message = asText(first.message);
    // A missing scope is the single most common failure here, and it is fixable in
    // about fifteen seconds if the message says which one.
    const scope = /access denied|not approved|requires.*scope|read_[a-z_]+/i.test(message);
    throw new ConnectorError(`Shopify would not give us ${what}.`, {
      hint: scope
        ? `Your app is missing a permission. In Shopify: Develop apps → your app → Configuration → Admin API scopes, and tick the read permission for this. Shopify said: ${message}`
        : `Shopify said: ${message}`,
    });
  }

  return asRecord(dig(body, 'data'));
}

// ── Products ─────────────────────────────────────────────────────────────────

const PRODUCTS_QUERY = `
query MigrationProducts($cursor: String) {
  products(first: ${PAGE.products}, after: $cursor, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle title descriptionHtml vendor productType tags status isGiftCard
      seo { title description }
      options { name }
      images(first: 25) { nodes { url altText } }
      variants(first: ${PAGE.variants}) {
        nodes {
          sku title price compareAtPrice barcode inventoryQuantity taxable
          selectedOptions { name value }
          image { url }
          inventoryItem {
            tracked requiresShipping
            unitCost { amount }
            measurement { weight { unit value } }
          }
        }
      }
    }
  }
}`;

/** Grams for the CSV shape, which the mapper then reads with its own unit rules. */
const WEIGHT_UNIT: Record<string, string> = {
  GRAMS: 'g',
  KILOGRAMS: 'kg',
  POUNDS: 'lb',
  OUNCES: 'oz',
};

function productRows(data: unknown): SourceRow[] {
  const rows: SourceRow[] = [];

  for (const raw of asArray(dig(data, 'products', 'nodes'))) {
    const product = asRecord(raw);
    const handle = asText(product.handle);
    if (handle === '') continue;

    const optionNames = asArray(product.options).map((option) => asText(asRecord(option).name));
    const images = asArray(dig(product, 'images', 'nodes')).map((image) => asRecord(image));
    const variants = asArray(dig(product, 'variants', 'nodes'));

    const head: SourceRow = {
      Handle: handle,
      Title: asText(product.title),
      'Body (HTML)': asText(product.descriptionHtml),
      Vendor: asText(product.vendor),
      Type: asText(product.productType),
      Tags: asArray(product.tags).map(asText).join(', '),
      Status: asText(product.status),
      'Gift Card': asText(product.isGiftCard),
      'SEO Title': digText(product, 'seo', 'title'),
      'SEO Description': digText(product, 'seo', 'description'),
      'Option1 Name': optionNames[0] ?? '',
      'Option2 Name': optionNames[1] ?? '',
      'Option3 Name': optionNames[2] ?? '',
    };

    // One row per variant, exactly as the export writes it — the first also carries
    // the product and the first image.
    (variants.length === 0 ? [null] : variants).forEach((rawVariant, index) => {
      const variant = asRecord(rawVariant);
      const selected = asArray(variant.selectedOptions).map((option) => asRecord(option));
      const weightUnit = digText(variant, 'inventoryItem', 'measurement', 'weight', 'unit');
      const weightValue = digText(variant, 'inventoryItem', 'measurement', 'weight', 'value');
      const firstImage = images[0];

      rows.push({
        ...head,
        'Option1 Value': asText(selected[0]?.value),
        'Option2 Value': asText(selected[1]?.value),
        'Option3 Value': asText(selected[2]?.value),
        'Variant SKU': asText(variant.sku),
        'Variant Price': asText(variant.price),
        'Variant Compare At Price': asText(variant.compareAtPrice),
        'Variant Barcode': asText(variant.barcode),
        'Variant Inventory Qty': asText(variant.inventoryQuantity),
        // The mapper reads an empty tracker as untracked, which is how the CSV
        // expresses the same thing.
        'Variant Inventory Tracker':
          dig(variant, 'inventoryItem', 'tracked') === true ? 'shopify' : '',
        'Variant Requires Shipping': digText(variant, 'inventoryItem', 'requiresShipping'),
        'Variant Taxable': asText(variant.taxable),
        'Variant Grams': weightValue,
        'Variant Weight Unit': WEIGHT_UNIT[weightUnit] ?? '',
        'Cost per item': digText(variant, 'inventoryItem', 'unitCost', 'amount'),
        'Variant Image': digText(variant, 'image', 'url'),
        'Image Src': index === 0 ? asText(firstImage?.url) : '',
        'Image Position': index === 0 && firstImage !== undefined ? '1' : '',
        'Image Alt Text': index === 0 ? asText(firstImage?.altText) : '',
      });
    });

    // Continuation rows for the rest of the gallery, which is how the CSV carries a
    // product with more images than variants — and what `mapProducts` re-gathers.
    images.slice(1).forEach((image, index) => {
      rows.push({
        Handle: handle,
        'Image Src': asText(image.url),
        'Image Position': String(index + 2),
        'Image Alt Text': asText(image.altText),
      });
    });
  }

  return rows;
}

// ── Stock ────────────────────────────────────────────────────────────────────

const INVENTORY_QUERY = `
query MigrationInventory($cursor: String) {
  productVariants(first: ${PAGE.variants}, after: $cursor, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      sku
      inventoryItem {
        tracked
        inventoryLevels(first: 10) {
          nodes {
            location { name }
            quantities(names: ["on_hand", "available", "incoming"]) { name quantity }
          }
        }
      }
    }
  }
}`;

function inventoryRows(data: unknown): SourceRow[] {
  const rows: SourceRow[] = [];

  for (const raw of asArray(dig(data, 'productVariants', 'nodes'))) {
    const variant = asRecord(raw);
    const sku = asText(variant.sku);
    // Stock without a SKU cannot be matched to anything on our side; the row would
    // be dropped by the validator anyway, and dropping it here keeps the count honest.
    if (sku === '') continue;

    for (const rawLevel of asArray(dig(variant, 'inventoryItem', 'inventoryLevels', 'nodes'))) {
      const level = asRecord(rawLevel);
      const quantities: Record<string, string> = {};
      for (const rawQuantity of asArray(level.quantities)) {
        const quantity = asRecord(rawQuantity);
        quantities[asText(quantity.name)] = asText(quantity.quantity);
      }
      const onHand = quantities.on_hand ?? quantities.available ?? '';
      if (onHand === '') continue;

      rows.push({
        SKU: sku,
        Location: digText(level, 'location', 'name'),
        'On hand': onHand,
        Available: quantities.available ?? '',
        Incoming: quantities.incoming ?? '',
      });
    }
  }

  return rows;
}

// ── Customers ────────────────────────────────────────────────────────────────

const CUSTOMERS_QUERY = `
query MigrationCustomers($cursor: String) {
  customers(first: ${PAGE.customers}, after: $cursor, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      firstName lastName email phone note tags createdAt numberOfOrders
      emailMarketingConsent { marketingState }
      smsMarketingConsent { marketingState }
      amountSpent { amount }
      defaultAddress {
        address1 address2 city provinceCode countryCodeV2 zip company phone
      }
    }
  }
}`;

function subscribed(state: string): string {
  return state.toUpperCase() === 'SUBSCRIBED' ? 'yes' : 'no';
}

function customerRows(data: unknown): SourceRow[] {
  return asArray(dig(data, 'customers', 'nodes')).map((raw) => {
    const customer = asRecord(raw);
    return {
      Email: asText(customer.email),
      'First Name': asText(customer.firstName),
      'Last Name': asText(customer.lastName),
      Phone: asText(customer.phone) || digText(customer, 'defaultAddress', 'phone'),
      Company: digText(customer, 'defaultAddress', 'company'),
      'Accepts Email Marketing': subscribed(
        digText(customer, 'emailMarketingConsent', 'marketingState')
      ),
      'Accepts SMS Marketing': subscribed(
        digText(customer, 'smsMarketingConsent', 'marketingState')
      ),
      'Default Address Address1': digText(customer, 'defaultAddress', 'address1'),
      'Default Address Address2': digText(customer, 'defaultAddress', 'address2'),
      'Default Address City': digText(customer, 'defaultAddress', 'city'),
      'Default Address Province Code': digText(customer, 'defaultAddress', 'provinceCode'),
      'Default Address Country Code': digText(customer, 'defaultAddress', 'countryCodeV2'),
      'Default Address Zip': digText(customer, 'defaultAddress', 'zip'),
      Tags: asArray(customer.tags).map(asText).join(', '),
      Note: asText(customer.note),
      'Total Spent': digText(customer, 'amountSpent', 'amount'),
      'Total Orders': asText(customer.numberOfOrders),
    };
  });
}

// ── Orders ───────────────────────────────────────────────────────────────────

const ORDERS_QUERY = `
query MigrationOrders($cursor: String) {
  orders(first: ${PAGE.orders}, after: $cursor, sortKey: ID, query: "status:any") {
    pageInfo { hasNextPage endCursor }
    nodes {
      name email phone createdAt note currencyCode discountCodes
      displayFinancialStatus displayFulfillmentStatus
      currentSubtotalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      shippingLine { title }
      billingAddress { name }
      shippingAddress { name address1 address2 city province country zip }
      lineItems(first: 100) {
        nodes { sku name quantity originalUnitPriceSet { shopMoney { amount } } }
      }
    }
  }
}`;

function orderRows(data: unknown): SourceRow[] {
  const rows: SourceRow[] = [];

  for (const raw of asArray(dig(data, 'orders', 'nodes'))) {
    const order = asRecord(raw);
    const name = asText(order.name);
    if (name === '') continue;

    const lines = asArray(dig(order, 'lineItems', 'nodes'));
    // The order's own totals belong to its FIRST row only. The mapper enforces that
    // too, but emitting them once means the two agree rather than one correcting the
    // other — and an order with no lines at all still has to produce a row.
    const head: SourceRow = {
      Name: name,
      Email: asText(order.email),
      Phone: asText(order.phone),
      'Created at': asText(order.createdAt),
      Currency: asText(order.currencyCode),
      'Financial Status': asText(order.displayFinancialStatus),
      'Fulfillment Status': asText(order.displayFulfillmentStatus),
      Subtotal: digText(order, 'currentSubtotalPriceSet', 'shopMoney', 'amount'),
      Shipping: digText(order, 'totalShippingPriceSet', 'shopMoney', 'amount'),
      Taxes: digText(order, 'totalTaxSet', 'shopMoney', 'amount'),
      'Discount Amount': digText(order, 'totalDiscountsSet', 'shopMoney', 'amount'),
      Total: digText(order, 'totalPriceSet', 'shopMoney', 'amount'),
      'Discount Code': asArray(order.discountCodes).map(asText).join(', '),
      'Shipping Method': digText(order, 'shippingLine', 'title'),
      Notes: asText(order.note),
      'Billing Name': digText(order, 'billingAddress', 'name'),
      'Shipping Name': digText(order, 'shippingAddress', 'name'),
      'Shipping Address1': digText(order, 'shippingAddress', 'address1'),
      'Shipping Address2': digText(order, 'shippingAddress', 'address2'),
      'Shipping City': digText(order, 'shippingAddress', 'city'),
      'Shipping Province': digText(order, 'shippingAddress', 'province'),
      'Shipping Country': digText(order, 'shippingAddress', 'country'),
      'Shipping Zip': digText(order, 'shippingAddress', 'zip'),
    };

    if (lines.length === 0) {
      rows.push(head);
      continue;
    }

    lines.forEach((rawLine, index) => {
      const line = asRecord(rawLine);
      rows.push({
        ...(index === 0 ? head : { Name: name }),
        'Lineitem sku': asText(line.sku),
        'Lineitem name': asText(line.name),
        'Lineitem quantity': asText(line.quantity),
        'Lineitem price': digText(line, 'originalUnitPriceSet', 'shopMoney', 'amount'),
      });
    });
  }

  return rows;
}

// ── Discounts ────────────────────────────────────────────────────────────────

const DISCOUNTS_QUERY = `
query MigrationDiscounts($cursor: String) {
  codeDiscountNodes(first: ${PAGE.simple}, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      codeDiscount {
        __typename
        ... on DiscountCodeBasic {
          title status startsAt endsAt usageLimit
          codes(first: 1) { nodes { code } }
          minimumRequirement {
            ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
          }
          customerGets {
            value {
              ... on DiscountPercentage { percentage }
              ... on DiscountAmount { amount { amount } }
            }
          }
        }
        ... on DiscountCodeFreeShipping {
          title status startsAt endsAt usageLimit
          codes(first: 1) { nodes { code } }
        }
        ... on DiscountCodeBxgy {
          title status startsAt endsAt usageLimit
          codes(first: 1) { nodes { code } }
        }
      }
    }
  }
}`;

function discountRows(data: unknown): { rows: SourceRow[]; titles: string[] } {
  const rows: SourceRow[] = [];
  const titles: string[] = [];

  for (const raw of asArray(dig(data, 'codeDiscountNodes', 'nodes'))) {
    const discount = asRecord(dig(asRecord(raw), 'codeDiscount'));
    const typeName = asText(discount.__typename);
    const code = digText(dig(discount, 'codes', 'nodes', '0'), 'code') || asText(discount.title);
    if (code === '') continue;

    const percentage = digText(discount, 'customerGets', 'value', 'percentage');
    const amount = digText(discount, 'customerGets', 'value', 'amount', 'amount');
    const freeShipping = typeName === 'DiscountCodeFreeShipping';

    titles.push(asText(discount.title));
    rows.push({
      // `Name` and not `Code`, because that is the column Shopify's own export puts
      // the code in and the mapper reads it first. Getting this the intuitive way
      // round imports every coupon under its display name, so `SPRING10` becomes
      // "Spring sale" and not one customer's code works.
      Name: code,
      Code: code,
      // The mapper decides the type from these two words, and normalises Shopify's
      // fractional percentages on the way — which is why they are handed over raw.
      Type: freeShipping ? 'Free shipping' : percentage !== '' ? 'Percentage' : 'Fixed amount',
      'Value Type': freeShipping
        ? 'free_shipping'
        : percentage !== ''
          ? 'percentage'
          : 'fixed_amount',
      Value: percentage !== '' ? percentage : amount,
      'Minimum Requirement Value': digText(
        discount,
        'minimumRequirement',
        'greaterThanOrEqualToSubtotal',
        'amount'
      ),
      'Usage Limit': asText(discount.usageLimit),
      'Starts At': asText(discount.startsAt),
      'Ends At': asText(discount.endsAt),
      Status: asText(discount.status),
    });
  }

  return { rows, titles };
}

/**
 * Discounts, with the display name put back.
 *
 * Shopify's CSV has one column carrying both the code and the name, so the mapper
 * sets `title` from the code — right for a file, and a waste here where the API gave
 * us both. `mapDiscounts` is a straight 1:1 map over the rows it is handed, so the
 * titles collected alongside them line up by index.
 */
function discountCanonical(data: unknown): CanonicalRow[] {
  const { rows, titles } = discountRows(data);
  return shopifyInternals.mapDiscounts(rows).map((row, index) => {
    const title = titles[index];
    return title === undefined || title === '' ? row : { ...row, title };
  });
}

// ── Redirects ────────────────────────────────────────────────────────────────

const REDIRECTS_QUERY = `
query MigrationRedirects($cursor: String) {
  urlRedirects(first: 250, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes { path target }
  }
}`;

function redirectRows(data: unknown): SourceRow[] {
  return asArray(dig(data, 'urlRedirects', 'nodes')).map((raw) => {
    const redirect = asRecord(raw);
    return { 'Redirect from': asText(redirect.path), 'Redirect to': asText(redirect.target) };
  });
}

// ── Collections — the first thing there is no export for ─────────────────────

const COLLECTIONS_QUERY = `
query MigrationCollections($cursor: String) {
  collections(first: ${PAGE.simple}, after: $cursor, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle title descriptionHtml
      image { url }
      products(first: 250) { nodes { handle } }
    }
  }
}`;

function collectionRows(data: unknown): CanonicalRow[] {
  const rows: CanonicalRow[] = [];

  for (const raw of asArray(dig(data, 'collections', 'nodes'))) {
    const collection = asRecord(raw);
    const name = asText(collection.title);
    if (name === '') continue;

    const products = asArray(dig(collection, 'products', 'nodes'))
      .map((product) => asText(asRecord(product).handle))
      .filter((handle) => handle !== '');

    const row: CanonicalRow = { name, published: 'true' };
    const slug = asText(collection.handle);
    if (slug !== '') row.slug = slug;
    const description = asText(collection.descriptionHtml);
    if (description !== '') row.description = description;
    const image = digText(collection, 'image', 'url');
    if (image !== '') row.image_url = image;
    if (products.length > 0) row.products = products.join(', ');
    rows.push(row);
  }

  return rows;
}

// ── Pages and blog posts — the second ────────────────────────────────────────

const PAGES_QUERY = `
query MigrationPages($cursor: String) {
  pages(first: ${PAGE.simple}, after: $cursor, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes { handle title body bodySummary createdAt updatedAt publishedAt isPublished }
  }
}`;

const ARTICLES_QUERY = `
query MigrationArticles($cursor: String) {
  articles(first: ${PAGE.simple}, after: $cursor, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle title body summary tags publishedAt createdAt updatedAt isPublished
      author { name }
      image { url }
      blog { title }
    }
  }
}`;

function contentRow(source: Record<string, unknown>, kind: 'page' | 'post'): CanonicalRow | null {
  const title = asText(source.title);
  if (title === '') return null;

  const published = source.isPublished === true;
  const row: CanonicalRow = {
    title,
    type: kind,
    status: published ? 'published' : 'draft',
  };

  const slug = asText(source.handle);
  if (slug !== '') {
    row.slug = slug;
    row.source_url = kind === 'page' ? `/pages/${slug}` : `/blogs/news/${slug}`;
  }
  const body = asText(source.body);
  if (body !== '') row.body = body;
  const excerpt = asText(source.summary) || asText(source.bodySummary);
  if (excerpt !== '') row.excerpt = excerpt;
  const publishedAt = asText(source.publishedAt) || asText(source.createdAt);
  if (publishedAt !== '') row.published_at = publishedAt;
  const updatedAt = asText(source.updatedAt);
  if (updatedAt !== '') row.updated_at = updatedAt;
  const author = digText(source, 'author', 'name');
  if (author !== '') row.author = author;
  const image = digText(source, 'image', 'url');
  if (image !== '') row.featured_image_url = image;
  const tags = asArray(source.tags)
    .map(asText)
    .filter((tag) => tag !== '');
  if (tags.length > 0) row.tags = tags.join(', ');
  // The blog a post lived in is the closest thing Shopify has to a category, and
  // losing it would flatten three separate blogs into one undifferentiated feed.
  const blog = digText(source, 'blog', 'title');
  if (blog !== '') row.categories = blog;

  return row;
}

// ── The connector ────────────────────────────────────────────────────────────

/**
 * Content arrives from two root queries, so its cursor carries which one we are on.
 * `pages:` first, then `articles:` — encoded rather than kept in memory because a
 * pull is stateless between requests by design.
 */
function splitContentCursor(cursor: string | null): {
  stage: 'pages' | 'articles';
  at: string | null;
} {
  if (cursor === null) return { stage: 'pages', at: null };
  const separator = cursor.indexOf(':');
  const stage = cursor.slice(0, separator) === 'articles' ? 'articles' : 'pages';
  const at = cursor.slice(separator + 1);
  return { stage, at: at === '' ? null : at };
}

async function pullContent(input: PullInput): Promise<PullPage> {
  const { stage, at } = splitContentCursor(input.cursor);

  if (stage === 'pages') {
    const data = await graphql(
      input.fetch,
      input.credentials,
      PAGES_QUERY,
      { cursor: at },
      'your pages'
    );
    const nodes = asArray(dig(data, 'pages', 'nodes'));
    const rows = nodes
      .map((node) => contentRow(asRecord(node), 'page'))
      .filter((row): row is CanonicalRow => row !== null);
    const more = dig(data, 'pages', 'pageInfo', 'hasNextPage') === true;
    return {
      entity: 'content',
      rows,
      fetched: nodes.length,
      // When the pages run out we do not stop — we move to the blog. A tenant told
      // "your pages are in" who then finds no blog posts has been half-migrated.
      nextCursor: more ? `pages:${digText(data, 'pages', 'pageInfo', 'endCursor')}` : 'articles:',
    };
  }

  const data = await graphql(
    input.fetch,
    input.credentials,
    ARTICLES_QUERY,
    { cursor: at },
    'your blog posts'
  );
  const nodes = asArray(dig(data, 'articles', 'nodes'));
  const rows = nodes
    .map((node) => contentRow(asRecord(node), 'post'))
    .filter((row): row is CanonicalRow => row !== null);
  const more = dig(data, 'articles', 'pageInfo', 'hasNextPage') === true;
  return {
    entity: 'content',
    rows,
    fetched: nodes.length,
    nextCursor: more ? `articles:${digText(data, 'articles', 'pageInfo', 'endCursor')}` : null,
  };
}

/** Root field, query, and the flattening for each simple (single-query) resource. */
const SIMPLE: Record<
  string,
  { root: string; query: string; what: string; rows: (data: unknown) => CanonicalRow[] }
> = {
  products: {
    root: 'products',
    query: PRODUCTS_QUERY,
    what: 'your products',
    rows: (data) => shopifyInternals.mapProducts(productRows(data)),
  },
  inventory_levels: {
    root: 'productVariants',
    query: INVENTORY_QUERY,
    what: 'your stock levels',
    rows: (data) => shopifyInternals.mapInventory(inventoryRows(data)),
  },
  customers: {
    root: 'customers',
    query: CUSTOMERS_QUERY,
    what: 'your customers',
    rows: (data) => shopifyInternals.mapCustomers(customerRows(data)),
  },
  orders: {
    root: 'orders',
    query: ORDERS_QUERY,
    what: 'your orders',
    rows: (data) => shopifyInternals.mapOrders(orderRows(data)),
  },
  discounts: {
    root: 'codeDiscountNodes',
    query: DISCOUNTS_QUERY,
    what: 'your discount codes',
    rows: discountCanonical,
  },
  redirects: {
    root: 'urlRedirects',
    query: REDIRECTS_QUERY,
    what: 'your redirects',
    rows: (data) => shopifyInternals.mapRedirects(redirectRows(data)),
  },
  collections: {
    root: 'collections',
    query: COLLECTIONS_QUERY,
    what: 'your collections',
    rows: collectionRows,
  },
};

export const shopifyConnector: Connector = {
  slug: 'shopify',
  label: 'Shopify',
  vendors: ['shopify'],
  instructions: [
    'In Shopify, go to Settings → Apps and sales channels → Develop apps.',
    'Click "Create an app", give it any name — "sparx migration" does fine — and create it.',
    'Open Configuration → Admin API integration → Configure, and tick the read permissions for products, inventory, customers, orders, discounts, content and online store navigation.',
    'Save, then go to API credentials and click "Install app". Copy the Admin API access token it shows you — Shopify only shows it once.',
    'Orders older than sixty days need the "read all orders" permission, which Shopify makes you request on the same screen.',
  ],
  fields: [
    {
      key: 'shop',
      label: 'Your store address',
      help: 'The one ending .myshopify.com. You can see it in the address bar when you are in your Shopify admin.',
      placeholder: 'your-store.myshopify.com',
      secret: false,
      required: true,
    },
    {
      key: 'accessToken',
      label: 'Admin API access token',
      help: 'From API credentials on the app you just made. It starts with shpat_.',
      placeholder: 'shpat_…',
      secret: true,
      required: true,
      pattern: '^shp(at|ca)_[A-Za-z0-9]{20,}$',
      patternHint:
        'That does not look like an Admin API access token — they start with shpat_. The API key and secret next to it are different things.',
    },
  ],
  resources: [
    { entity: 'products', label: 'Products, options and images', pageSize: PAGE.products },
    { entity: 'inventory_levels', label: 'Stock, per location', pageSize: PAGE.variants },
    {
      entity: 'collections',
      label: 'Collections',
      pageSize: PAGE.simple,
      note: 'Shopify has no export for these — this is the only way they move.',
    },
    { entity: 'customers', label: 'Customers', pageSize: PAGE.customers },
    {
      entity: 'orders',
      label: 'Order history',
      pageSize: PAGE.orders,
      note: 'Anything older than sixty days needs the "read all orders" permission on your app.',
    },
    { entity: 'discounts', label: 'Discount codes', pageSize: PAGE.simple },
    {
      entity: 'content',
      label: 'Pages and blog posts',
      pageSize: PAGE.simple,
      note: 'Shopify has no export for these either.',
    },
    { entity: 'redirects', label: 'URL redirects', pageSize: 250 },
  ],

  async verify({ credentials, fetch }) {
    const data = await graphql(
      fetch,
      credentials,
      'query MigrationShop { shop { name myshopifyDomain currencyCode primaryDomain { host } } }',
      {},
      'your store'
    );
    const name = digText(data, 'shop', 'name');
    if (name === '') {
      throw new ConnectorError('We reached Shopify but it did not tell us which store.', {
        hint: 'Check the token belongs to the store address above.',
      });
    }
    return {
      account: name,
      detail:
        digText(data, 'shop', 'primaryDomain', 'host') || digText(data, 'shop', 'myshopifyDomain'),
    };
  },

  async pull(input) {
    if (input.entity === 'content') return pullContent(input);

    const resource = SIMPLE[input.entity];
    if (resource === undefined) {
      throw new ConnectorError(`We do not read ${input.entity} from Shopify.`);
    }

    const data = await graphql(
      input.fetch,
      input.credentials,
      resource.query,
      { cursor: input.cursor },
      resource.what
    );
    const more = dig(data, resource.root, 'pageInfo', 'hasNextPage') === true;

    return {
      entity: input.entity,
      rows: resource.rows(data),
      fetched: asArray(dig(data, resource.root, 'nodes')).length,
      nextCursor: more ? digText(data, resource.root, 'pageInfo', 'endCursor') : null,
    };
  },
};
