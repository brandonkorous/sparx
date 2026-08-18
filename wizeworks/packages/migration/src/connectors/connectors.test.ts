import { describe, expect, it } from 'vitest';
import { ConnectorError, assertSafeUrl, requestJson } from './http';
import { shopifyConnector } from './shopify';
import { wordpressConnector } from './wordpress';
import { hubspotConnector } from './hubspot';
import { availableResources, connectorForVendor, getConnector } from './index';
import type { FetchLike, HttpRequest } from './types';

// Connectors are tested against a stubbed fetch rather than a live store, which is
// the reason network access is injected in the first place. What is worth pinning
// down here is not "does Shopify answer" — it is the half we own: the flattening of
// somebody else's JSON into the column names our mappers read, the paging, and the
// failures that have to arrive as a sentence rather than a status code.

interface Call {
  url: string;
  init: HttpRequest | undefined;
}

interface Reply {
  status?: number;
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

function stub(replies: Reply[] | ((call: Call) => Reply)): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  // An array answers in order; a function answers by URL, which is what the
  // multi-request connectors (HubSpot's pipelines, owners and batch reads) need.
  const queue = Array.isArray(replies) ? [...replies] : null;
  const answer = Array.isArray(replies) ? null : replies;

  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init });
    const reply = answer === null ? (queue?.shift() ?? { body: {} }) : answer({ url, init });
    const status = reply.status ?? 200;
    const text = reply.text ?? JSON.stringify(reply.body ?? {});
    const headers = reply.headers ?? {};
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
      text: () => Promise.resolve(text),
    });
  };

  return { fetch, calls };
}

const nap = (): Promise<void> => Promise.resolve();

// ── The guard ────────────────────────────────────────────────────────────────

describe('assertSafeUrl', () => {
  it('allows an ordinary public site', () => {
    expect(assertSafeUrl('https://example.com/wp-json').hostname).toBe('example.com');
  });

  it('refuses the cloud metadata address', () => {
    // This is the whole reason the guard exists: the WordPress connector takes an
    // address from the tenant and our server is what fetches it.
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/')).toThrow(ConnectorError);
  });

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1/',
    'http://10.1.2.3/',
    'http://192.168.0.1/',
    'http://172.20.0.5/',
    'https://api-rest.svc.internal/',
  ])('refuses %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow(ConnectorError);
  });

  it('refuses an address with a login smuggled in front of the host', () => {
    expect(() => assertSafeUrl('https://api.hubapi.com@169.254.169.254/')).toThrow(ConnectorError);
  });

  it('refuses a scheme that is not the web', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(ConnectorError);
  });
});

describe('requestJson', () => {
  it('waits the time the vendor asked for and then succeeds', async () => {
    const { fetch, calls } = stub([
      { status: 429, headers: { 'retry-after': '1' } },
      { body: { fine: true } },
    ]);
    const body = await requestJson(fetch, 'https://example.com/x', { sleep: nap });
    expect(body).toEqual({ fine: true });
    expect(calls).toHaveLength(2);
  });

  it('gives up on a wrong key immediately rather than hammering it', async () => {
    const { fetch, calls } = stub(() => ({ status: 401 }));
    await expect(
      requestJson(fetch, 'https://example.com/x', { sleep: nap, what: 'your products' })
    ).rejects.toThrow(/did not let us read your products/);
    expect(calls).toHaveLength(1);
  });

  it('says so plainly when a login page comes back with a 200', async () => {
    const { fetch } = stub([{ text: '<!doctype html><title>Log in</title>' }]);
    await expect(requestJson(fetch, 'https://example.com/x', { sleep: nap })).rejects.toThrow(
      /did not answer with data/
    );
  });
});

// ── Shopify ──────────────────────────────────────────────────────────────────

function shopifyReply(data: unknown): Reply {
  return { body: { data } };
}

const SHOPIFY = { shop: 'brandons-shop', accessToken: 'shpat_0123456789abcdefghijklmn' };

describe('the Shopify connector', () => {
  it('accepts a store address however the tenant pasted it', async () => {
    for (const shop of [
      'brandons-shop',
      'brandons-shop.myshopify.com',
      'https://brandons-shop.myshopify.com/admin',
      'https://admin.brandons-shop.myshopify.com',
    ]) {
      const { fetch, calls } = stub([shopifyReply({ shop: { name: 'Brandons Shop' } })]);
      await shopifyConnector.verify({ credentials: { ...SHOPIFY, shop }, fetch });
      expect(calls[0]?.url).toContain('https://brandons-shop.myshopify.com/admin/api/');
    }
  });

  it('refuses a custom domain, because Shopify will not answer on one', async () => {
    const { fetch } = stub([shopifyReply({})]);
    await expect(
      shopifyConnector.verify({ credentials: { ...SHOPIFY, shop: 'brandons-shop.com' }, fetch })
    ).rejects.toThrow(/not a Shopify store address/);
  });

  it('turns a missing permission into the screen you fix it on', async () => {
    const { fetch } = stub([
      {
        body: {
          errors: [
            { message: 'Access denied for products field. Required access: read_products.' },
          ],
        },
      },
    ]);

    // Shopify answers 200 with an `errors` array for a missing scope, so the status
    // proves nothing — and the fix lives in the hint, which is the line the tenant
    // acts on. Every caller has to surface it, which is why it is asserted here
    // rather than folded into the message.
    let caught: unknown = null;
    try {
      await shopifyConnector.pull({
        credentials: SHOPIFY,
        entity: 'products',
        cursor: null,
        fetch,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConnectorError);
    const hint = caught instanceof ConnectorError ? caught.hint : undefined;
    expect(hint).toMatch(/Admin API scopes/);
    expect(hint).toContain('read_products');
  });

  it('turns one product with two variants and three images into one product', async () => {
    const { fetch } = stub([
      shopifyReply({
        products: {
          pageInfo: { hasNextPage: false, endCursor: 'end' },
          nodes: [
            {
              handle: 'merino-beanie',
              title: 'Merino Beanie',
              descriptionHtml: '<p>Warm.</p>',
              vendor: 'Northmill',
              productType: 'Hats',
              tags: ['winter', 'wool'],
              status: 'ACTIVE',
              isGiftCard: false,
              seo: { title: 'Merino Beanie', description: 'A warm hat' },
              options: [{ name: 'Size' }],
              images: {
                nodes: [
                  { url: 'https://cdn/1.jpg', altText: 'Front' },
                  { url: 'https://cdn/2.jpg', altText: '' },
                  { url: 'https://cdn/3.jpg', altText: '' },
                ],
              },
              variants: {
                nodes: [
                  {
                    sku: 'BEANIE-S',
                    price: '24.00',
                    compareAtPrice: '30.00',
                    barcode: '5012345678900',
                    inventoryQuantity: 12,
                    taxable: true,
                    selectedOptions: [{ name: 'Size', value: 'Small' }],
                    image: { url: 'https://cdn/1.jpg' },
                    inventoryItem: {
                      tracked: true,
                      requiresShipping: true,
                      unitCost: { amount: '9.10' },
                      measurement: { weight: { unit: 'KILOGRAMS', value: 0.2 } },
                    },
                  },
                  {
                    sku: 'BEANIE-L',
                    price: '24.00',
                    inventoryQuantity: 4,
                    taxable: true,
                    selectedOptions: [{ name: 'Size', value: 'Large' }],
                    inventoryItem: { tracked: true, requiresShipping: true },
                  },
                ],
              },
            },
          ],
        },
      }),
    ]);

    const page = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'products',
      cursor: null,
      fetch,
    });

    expect(page.fetched).toBe(1);
    expect(page.nextCursor).toBeNull();
    expect(page.rows).toHaveLength(2);

    const [small, large] = page.rows;
    expect(small?.handle).toBe('merino-beanie');
    expect(large?.handle).toBe('merino-beanie');
    expect(small?.option1_name).toBe('Size');
    expect(small?.option1_value).toBe('Small');
    expect(large?.option1_value).toBe('Large');
    expect(small?.compare_at_price).toBe('30.00');
    // 0.2 kg has to reach the importer as 200 g — the mapper owns that conversion,
    // and this is the assertion that proves the connector fed it the unit.
    expect(small?.weight_grams).toBe('200');
    expect(small?.cost_per_item).toBe('9.10');
    expect(small?.status).toBe('active');
    // The gallery is re-gathered from the continuation rows onto the first variant.
    expect(small?.images).toBe('https://cdn/1.jpg, https://cdn/2.jpg, https://cdn/3.jpg');
    expect(large?.images).toBeUndefined();
  });

  it('does not lose a product that has no variants at all', async () => {
    const { fetch } = stub([
      shopifyReply({
        products: {
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              handle: 'gift',
              title: 'Gift',
              options: [],
              images: { nodes: [] },
              variants: { nodes: [] },
            },
          ],
        },
      }),
    ]);
    const page = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'products',
      cursor: null,
      fetch,
    });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.title).toBe('Gift');
  });

  it('hands back a cursor while there is more', async () => {
    const { fetch } = stub([
      shopifyReply({
        products: { pageInfo: { hasNextPage: true, endCursor: 'abc123' }, nodes: [] },
      }),
    ]);
    const page = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'products',
      cursor: null,
      fetch,
    });
    expect(page.nextCursor).toBe('abc123');
  });

  it('unpivots stock per location, skipping variants with no SKU to match on', async () => {
    const { fetch } = stub([
      shopifyReply({
        productVariants: {
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              sku: 'BEANIE-S',
              inventoryItem: {
                inventoryLevels: {
                  nodes: [
                    {
                      location: { name: 'Shop floor' },
                      quantities: [
                        { name: 'on_hand', quantity: 12 },
                        { name: 'available', quantity: 10 },
                        { name: 'incoming', quantity: 5 },
                      ],
                    },
                    {
                      location: { name: 'Back room' },
                      quantities: [{ name: 'on_hand', quantity: 3 }],
                    },
                  ],
                },
              },
            },
            {
              sku: '',
              inventoryItem: { inventoryLevels: { nodes: [{ location: { name: 'X' } }] } },
            },
          ],
        },
      }),
    ]);

    const page = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'inventory_levels',
      cursor: null,
      fetch,
    });

    expect(page.rows).toEqual([
      { sku: 'BEANIE-S', location: 'Shop floor', quantity: '12', available: '10', incoming: '5' },
      { sku: 'BEANIE-S', location: 'Back room', quantity: '3' },
    ]);
  });

  it('keeps an order together and puts the totals on its first line only', async () => {
    const { fetch } = stub([
      shopifyReply({
        orders: {
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              name: '#1001',
              email: 'sam@example.com',
              createdAt: '2025-03-04T10:00:00Z',
              currencyCode: 'GBP',
              displayFinancialStatus: 'PAID',
              displayFulfillmentStatus: 'FULFILLED',
              totalPriceSet: { shopMoney: { amount: '48.00' } },
              discountCodes: ['SPRING10'],
              shippingAddress: { name: 'Sam Reed', city: 'Leeds' },
              lineItems: {
                nodes: [
                  {
                    sku: 'BEANIE-S',
                    name: 'Merino Beanie - Small',
                    quantity: 1,
                    originalUnitPriceSet: { shopMoney: { amount: '24.00' } },
                  },
                  {
                    sku: 'BEANIE-L',
                    name: 'Merino Beanie - Large',
                    quantity: 1,
                    originalUnitPriceSet: { shopMoney: { amount: '24.00' } },
                  },
                ],
              },
            },
          ],
        },
      }),
    ]);

    const page = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'orders',
      cursor: null,
      fetch,
    });

    expect(page.rows).toHaveLength(2);
    expect(page.rows[0]?.order_number).toBe('#1001');
    expect(page.rows[0]?.total).toBe('48.00');
    expect(page.rows[1]?.order_number).toBe('#1001');
    // Repeating the total on the second line would double this order's revenue.
    expect(page.rows[1]?.total).toBeUndefined();
    expect(page.rows[1]?.line_sku).toBe('BEANIE-L');
  });

  it('reads a percentage discount as a percentage', async () => {
    const { fetch } = stub([
      shopifyReply({
        codeDiscountNodes: {
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              codeDiscount: {
                __typename: 'DiscountCodeBasic',
                title: 'Spring sale',
                status: 'ACTIVE',
                usageLimit: 100,
                codes: { nodes: [{ code: 'SPRING10' }] },
                customerGets: { value: { percentage: 0.1 } },
              },
            },
          ],
        },
      }),
    ]);

    const page = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'discounts',
      cursor: null,
      fetch,
    });

    // Shopify writes 0.1; a tenant means 10% off.
    expect(page.rows[0]).toMatchObject({ code: 'SPRING10', type: 'percentage', value: '10' });
  });

  it('brings collections, which Shopify has no export for', async () => {
    const { fetch } = stub([
      shopifyReply({
        collections: {
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              handle: 'winter',
              title: 'Winter warmers',
              descriptionHtml: '<p>Cold days.</p>',
              image: { url: 'https://cdn/winter.jpg' },
              products: { nodes: [{ handle: 'merino-beanie' }, { handle: 'wool-scarf' }] },
            },
          ],
        },
      }),
    ]);

    const page = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'collections',
      cursor: null,
      fetch,
    });

    expect(page.rows[0]).toEqual({
      name: 'Winter warmers',
      slug: 'winter',
      published: 'true',
      description: '<p>Cold days.</p>',
      image_url: 'https://cdn/winter.jpg',
      products: 'merino-beanie, wool-scarf',
    });
  });

  it('walks pages and then the blog, rather than stopping at the pages', async () => {
    const { fetch, calls } = stub([
      shopifyReply({
        pages: {
          pageInfo: { hasNextPage: false },
          nodes: [{ handle: 'about', title: 'About us', body: '<p>Hello.</p>', isPublished: true }],
        },
      }),
      shopifyReply({
        articles: {
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              handle: 'first-post',
              title: 'Our first post',
              body: '<p>Hi.</p>',
              isPublished: true,
              author: { name: 'Sam' },
              blog: { title: 'News' },
              tags: ['hello'],
            },
          ],
        },
      }),
    ]);

    const first = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'content',
      cursor: null,
      fetch,
    });
    expect(first.rows[0]).toMatchObject({
      type: 'page',
      slug: 'about',
      source_url: '/pages/about',
    });
    // The pages ran out but the pull has not — this is the handover to the blog.
    expect(first.nextCursor).toBe('articles:');

    const second = await shopifyConnector.pull({
      credentials: SHOPIFY,
      entity: 'content',
      cursor: first.nextCursor,
      fetch,
    });
    expect(second.rows[0]).toMatchObject({
      type: 'post',
      slug: 'first-post',
      author: 'Sam',
      categories: 'News',
    });
    expect(second.nextCursor).toBeNull();
    expect(calls).toHaveLength(2);
  });
});

// ── WordPress / WooCommerce ──────────────────────────────────────────────────

const WP = { siteUrl: 'https://kilnandclay.com' };
const WOO = {
  ...WP,
  consumerKey: 'ck_0123456789abcdefghijklmnopqrstuv',
  consumerSecret: 'cs_0123456789abcdefghijklmnopqrstuv',
};

describe('the WordPress connector', () => {
  it('finds the REST root however the address was pasted', async () => {
    for (const siteUrl of [
      'kilnandclay.com',
      'https://kilnandclay.com',
      'https://kilnandclay.com/',
      'https://kilnandclay.com/wp-json',
      'https://kilnandclay.com/wp-admin/options.php',
    ]) {
      const { fetch, calls } = stub([{ body: { name: 'Kiln & Clay', namespaces: ['wp/v2'] } }]);
      await wordpressConnector.verify({ credentials: { siteUrl }, fetch });
      expect(calls[0]?.url).toBe('https://kilnandclay.com/wp-json');
    }
  });

  it('keeps a subdirectory install, because its REST root lives under it', async () => {
    const { fetch, calls } = stub([{ body: { name: 'Blog', namespaces: ['wp/v2'] } }]);
    await wordpressConnector.verify({
      credentials: { siteUrl: 'https://kilnandclay.com/blog' },
      fetch,
    });
    expect(calls[0]?.url).toBe('https://kilnandclay.com/blog/wp-json');
  });

  it('tells a publisher their shop is there if they want it', async () => {
    const { fetch } = stub([{ body: { name: 'Kiln & Clay', namespaces: ['wp/v2', 'wc/v3'] } }]);
    const account = await wordpressConnector.verify({ credentials: WP, fetch });
    expect(account.account).toBe('Kiln & Clay');
    expect(account.detail).toMatch(/add the two keys/i);
  });

  it('proves the shop keys during verify rather than halfway through a catalogue', async () => {
    const { fetch, calls } = stub([
      { body: { name: 'Kiln & Clay', namespaces: ['wp/v2', 'wc/v3'] } },
      { body: [{ id: 1 }] },
    ]);
    await wordpressConnector.verify({ credentials: WOO, fetch });
    expect(calls[1]?.url).toContain('/wp-json/wc/v3/products');
  });

  it('falls back to key-in-the-query when the host eats the Authorization header', async () => {
    // A real and common shared-hosting failure. Without this the connector simply
    // does not work on those hosts, and the tenant is told their key is wrong.
    const { fetch, calls } = stub([{ status: 401 }, { body: [] }]);
    await wordpressConnector.pull({
      credentials: WOO,
      entity: 'customers',
      cursor: null,
      fetch,
    });
    expect(calls[0]?.init?.headers?.Authorization).toMatch(/^Basic /);
    expect(calls[1]?.url).toContain('consumer_key=ck_');
  });

  it('asks for the keys rather than 401-ing when a publisher picks products', async () => {
    const { fetch } = stub([]);
    await expect(
      wordpressConnector.pull({ credentials: WP, entity: 'products', cursor: null, fetch })
    ).rejects.toThrow(/needs your WooCommerce keys/);
  });

  it('joins a variable product back to its variations', async () => {
    const { fetch } = stub([
      {
        body: [
          {
            id: 12,
            type: 'variable',
            sku: 'MUG',
            name: 'Stoneware mug',
            description: '<p>Hand thrown.</p>',
            status: 'publish',
            categories: [{ name: 'Mugs' }],
            images: [{ src: 'https://kilnandclay.com/mug.jpg' }],
            attributes: [{ name: 'Glaze', options: ['Cobalt', 'Ash'] }],
          },
        ],
      },
      {
        body: [
          {
            id: 13,
            sku: 'MUG-COBALT',
            regular_price: '28.00',
            sale_price: '22.00',
            stock_quantity: 6,
            attributes: [{ name: 'Glaze', option: 'Cobalt' }],
          },
          {
            id: 14,
            sku: 'MUG-ASH',
            regular_price: '28.00',
            stock_quantity: 2,
            attributes: [{ name: 'Glaze', option: 'Ash' }],
          },
        ],
      },
    ]);

    const page = await wordpressConnector.pull({
      credentials: WOO,
      entity: 'products',
      cursor: null,
      fetch,
    });

    expect(page.fetched).toBe(1);
    expect(page.rows).toHaveLength(2);
    expect(page.rows[0]).toMatchObject({
      handle: 'MUG',
      title: 'Stoneware mug',
      sku: 'MUG-COBALT',
      option1_name: 'Glaze',
      option1_value: 'Cobalt',
      // The sale price is what the customer pays; the regular price is the one shown
      // struck through. Reading the columns at face value un-discounts the catalogue.
      price: '22.00',
      compare_at_price: '28.00',
    });
    expect(page.rows[1]).toMatchObject({ sku: 'MUG-ASH', price: '28.00', option1_value: 'Ash' });
    expect(page.rows[1]?.compare_at_price).toBeUndefined();
  });

  it('turns a WooCommerce order status into the two statuses we keep', async () => {
    const { fetch } = stub([
      {
        body: [
          {
            id: 501,
            number: '501',
            status: 'completed',
            date_created: '2025-02-02T09:00:00',
            date_paid: '2025-02-02T09:01:00',
            currency: 'GBP',
            total: '44.00',
            billing: { email: 'ada@example.com', first_name: 'Ada', last_name: 'Vaughan' },
            shipping: { city: 'Bristol' },
            line_items: [
              { sku: 'MUG-ASH', name: 'Stoneware mug - Ash', quantity: 2, total: '44.00' },
            ],
          },
        ],
      },
    ]);

    const page = await wordpressConnector.pull({
      credentials: WOO,
      entity: 'orders',
      cursor: null,
      fetch,
    });

    expect(page.rows[0]).toMatchObject({
      order_number: '501',
      email: 'ada@example.com',
      financial_status: 'paid',
      fulfillment_status: 'fulfilled',
      line_quantity: '2',
      // WooCommerce writes the line total; everything downstream expects the unit.
      line_price: '22',
    });
  });

  it('keeps the old permalink so the redirect can be built from it', async () => {
    const { fetch } = stub([
      {
        body: [
          {
            slug: 'glazing-in-winter',
            title: { rendered: 'Glazing in winter' },
            content: { rendered: '<p>Keep it warm.</p>' },
            excerpt: { rendered: 'Keep it warm.' },
            status: 'publish',
            date_gmt: '2025-01-08T11:00:00',
            link: 'https://kilnandclay.com/2025/01/08/glazing-in-winter/',
            _embedded: {
              author: [{ name: 'Ada Vaughan' }],
              'wp:term': [
                [{ name: 'Studio notes', taxonomy: 'category' }],
                [{ name: 'winter', taxonomy: 'post_tag' }],
              ],
              'wp:featuredmedia': [{ source_url: 'https://kilnandclay.com/kiln.jpg' }],
            },
          },
        ],
      },
    ]);

    const page = await wordpressConnector.pull({
      credentials: WP,
      entity: 'content',
      cursor: null,
      fetch,
    });

    expect(page.rows[0]).toMatchObject({
      title: 'Glazing in winter',
      type: 'post',
      status: 'published',
      author: 'Ada Vaughan',
      categories: 'Studio notes',
      tags: 'winter',
      featured_image_url: 'https://kilnandclay.com/kiln.jpg',
      // Not `/glazing-in-winter` — WordPress permalinks almost never are, and the
      // redirect has to point at the URL the search engines actually have.
      source_url: '/2025/01/08/glazing-in-winter/',
    });
    // Posts exhausted; move to pages rather than declaring the content done.
    expect(page.nextCursor).toBe('pages:1');
  });

  it('only asks for drafts when it has a login that could read them', async () => {
    const withLogin = stub([{ body: [] }]);
    await wordpressConnector.pull({
      credentials: { ...WP, username: 'ada', applicationPassword: 'abcd efgh ijkl mnop' },
      entity: 'content',
      cursor: null,
      fetch: withLogin.fetch,
    });
    expect(withLogin.calls[0]?.url).toContain('draft');
    expect(withLogin.calls[0]?.init?.headers?.Authorization).toMatch(/^Basic /);

    const anonymous = stub([{ body: [] }]);
    await wordpressConnector.pull({
      credentials: WP,
      entity: 'content',
      cursor: null,
      fetch: anonymous.fetch,
    });
    expect(anonymous.calls[0]?.url).toContain('status=publish');
    expect(anonymous.calls[0]?.url).not.toContain('draft');
  });

  it('pages by number and stops on a short page', async () => {
    const { fetch } = stub([
      {
        body: Array.from({ length: 100 }, (_v, i) => ({
          source_url: `https://kilnandclay.com/${i}.jpg`,
        })),
      },
    ]);
    const page = await wordpressConnector.pull({
      credentials: WP,
      entity: 'media',
      cursor: null,
      fetch,
    });
    expect(page.rows).toHaveLength(100);
    expect(page.nextCursor).toBe('2');
    expect(page.rows[0]?.filename).toBe('0.jpg');
  });
});

// ── HubSpot ──────────────────────────────────────────────────────────────────

const HUBSPOT = { accessToken: 'pat-eu1-0000-1111-2222' };

describe('the HubSpot connector', () => {
  it('reads a contact through the same column names the export uses', async () => {
    const { fetch } = stub(() => ({
      body: {
        results: [
          {
            id: '1',
            properties: {
              email: 'ada@example.com',
              firstname: 'Ada',
              lastname: 'Vaughan',
              phone: '+44 7700 900123',
              lifecyclestage: 'customer',
              hs_lead_status: 'OPEN',
              hs_marketable_status: 'false',
              city: 'Bristol',
            },
            associations: { companies: { results: [{ id: '99' }] } },
          },
        ],
      },
    }));

    const page = await hubspotConnector.pull({
      credentials: HUBSPOT,
      entity: 'customers',
      cursor: null,
      fetch,
    });

    expect(page.rows[0]).toMatchObject({
      email: 'ada@example.com',
      first_name: 'Ada',
      last_name: 'Vaughan',
      city: 'Bristol',
      tags: 'customer, OPEN',
      // hs_marketable_status: false is HubSpot's way of saying not opted in.
      accepts_marketing: 'false',
    });
  });

  it('translates a deal stage id back into the words the team uses', async () => {
    // The reason this connector exists at all: the API says `closedwon`, which the
    // mapper cannot recognise as a win — every deal would land open.
    const { fetch } = stub((call) => {
      if (call.url.includes('/crm/v3/pipelines/deals')) {
        return {
          body: {
            results: [
              {
                id: 'default',
                label: 'Sales pipeline',
                stages: [
                  { id: 'appointmentscheduled', label: 'Appointment scheduled' },
                  { id: 'closedwon', label: 'Closed Won' },
                ],
              },
            ],
          },
        };
      }
      if (call.url.includes('/crm/v3/owners')) {
        return { body: { results: [{ id: '7', email: 'sam@kilnandclay.com' }] } };
      }
      if (call.url.includes('/companies/batch/read')) {
        return { body: { results: [{ id: '99', properties: { name: 'Bristol Ceramics' } }] } };
      }
      if (call.url.includes('/contacts/batch/read')) {
        return { body: { results: [{ id: '1', properties: { email: 'ada@example.com' } }] } };
      }
      return {
        body: {
          results: [
            {
              id: '55',
              properties: {
                dealname: 'Studio refit',
                pipeline: 'default',
                dealstage: 'closedwon',
                amount: '4200',
                deal_currency_code: 'GBP',
                hubspot_owner_id: '7',
              },
              associations: {
                companies: { results: [{ id: '99' }] },
                contacts: { results: [{ id: '1' }] },
              },
            },
          ],
          paging: { next: { after: '55' } },
        },
      };
    });

    const page = await hubspotConnector.pull({
      credentials: HUBSPOT,
      entity: 'deals',
      cursor: null,
      fetch,
    });

    expect(page.rows[0]).toMatchObject({
      name: 'Studio refit',
      pipeline: 'Sales pipeline',
      stage: 'Closed Won',
      status: 'won',
      amount: '4200',
      owner_email: 'sam@kilnandclay.com',
      company: 'Bristol Ceramics',
      contact_email: 'ada@example.com',
    });
    expect(page.nextCursor).toBe('55');
  });

  it('still migrates when the token cannot read pipeline names', async () => {
    const { fetch } = stub((call) => {
      if (call.url.includes('/crm/v3/pipelines/')) return { status: 403 };
      if (call.url.includes('/crm/v3/owners')) return { status: 403 };
      if (call.url.includes('batch/read')) return { status: 403 };
      return {
        body: {
          results: [{ id: '55', properties: { dealname: 'Studio refit', dealstage: 'closedwon' } }],
        },
      };
    });

    const page = await hubspotConnector.pull({
      credentials: HUBSPOT,
      entity: 'deals',
      cursor: null,
      fetch,
    });

    // Worse, but not broken: the raw id is still something a person recognises, and
    // failing the whole move over a label lookup would be the wrong trade.
    expect(page.rows[0]).toMatchObject({ name: 'Studio refit', stage: 'closedwon' });
  });

  it('reads a ticket priority HubSpot spells its own way', async () => {
    const { fetch } = stub((call) =>
      call.url.includes('/crm/v3/objects/tickets')
        ? {
            body: {
              results: [
                {
                  id: '3',
                  properties: {
                    subject: 'Kiln not reaching temperature',
                    content: 'Stops at 900C.',
                    hs_ticket_priority: 'HIGH',
                    hs_pipeline_stage: '2',
                  },
                },
              ],
            },
          }
        : { body: { results: [] } }
    );

    const page = await hubspotConnector.pull({
      credentials: HUBSPOT,
      entity: 'tickets',
      cursor: null,
      fetch,
    });

    expect(page.rows[0]).toMatchObject({
      subject: 'Kiln not reaching temperature',
      priority: 'high',
    });
  });

  it('stops when HubSpot stops paging', async () => {
    const { fetch } = stub(() => ({ body: { results: [] } }));
    const page = await hubspotConnector.pull({
      credentials: HUBSPOT,
      entity: 'companies',
      cursor: null,
      fetch,
    });
    expect(page.nextCursor).toBeNull();
    expect(page.rows).toEqual([]);
  });
});

// ── The registry ─────────────────────────────────────────────────────────────

describe('the connector registry', () => {
  it('serves WooCommerce and WordPress from one connector', () => {
    expect(connectorForVendor('woocommerce')?.slug).toBe('wordpress');
    expect(connectorForVendor('wordpress')?.slug).toBe('wordpress');
    expect(connectorForVendor('shopify')?.slug).toBe('shopify');
  });

  it('has nothing for a vendor whose API is not open to its own customers', () => {
    for (const vendor of ['wix', 'squarespace', 'webflow', 'klaviyo', 'etsy']) {
      expect(connectorForVendor(vendor)).toBeUndefined();
    }
  });

  it('offers a publisher only what their credentials can actually reach', () => {
    const connector = getConnector('wordpress');
    expect(connector).toBeDefined();
    if (connector === undefined) return;

    const contentOnly = availableResources(connector, { siteUrl: 'https://kilnandclay.com' }).map(
      (resource) => resource.entity
    );
    expect(contentOnly).toEqual(['content', 'media']);

    const withShop = availableResources(connector, WOO).map((resource) => resource.entity);
    expect(withShop).toContain('products');
    expect(withShop).toContain('orders');
  });

  it('gives every checkable field a pattern that compiles and a hint to go with it', () => {
    for (const connector of [shopifyConnector, wordpressConnector, hubspotConnector]) {
      for (const field of connector.fields) {
        if (field.pattern === undefined) continue;
        // A pattern that does not compile would silently reject everything typed.
        expect(() => new RegExp(field.pattern ?? '')).not.toThrow();
        expect(field.patternHint).toBeDefined();
      }
    }
  });
});
