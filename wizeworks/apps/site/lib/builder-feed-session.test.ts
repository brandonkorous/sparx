// The builder's product feed, for a signed-in trade buyer (sparx persona issue 086).
//
// The feed now answers per buyer: their own price and their fleet fit. So:
//
//   1. A signed-in visitor's read carries their session and is NEVER stored in, or
//      served from, the shared per-tenant cache entry. If it were, one buyer's
//      agreed price would be shown to the next visitor, and the next visitor's
//      list price to the buyer.
//   2. A visitor who is not signed in keeps the shared, tagged cache entry.
//   3. The builder record shows the buyer's price, with the list price struck
//      through, on the card and on each version in the buy box.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ cookies: [] as { name: string; value: string }[] }));

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => jar.cookies,
      toString: () => jar.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    }),
}));
vi.mock('./site-context', () => ({ resolveActivePropertySlug: () => Promise.resolve(null) }));
vi.mock('./locale', () => ({ resolveReaderLocale: () => Promise.resolve(null) }));

import { productToBuilderRecord } from './builder-commerce-data';
import { getProductsFull, type PublicProduct } from './commerce';

const fetchMock = vi.fn();

beforeEach(() => {
  jar.cookies = [];
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function lastInit(): RequestInit {
  const call = fetchMock.mock.calls.at(-1) as [string, RequestInit] | undefined;
  if (!call) throw new Error('fetch was not called');
  return call[1];
}

describe('the builder product feed and the shared cache', () => {
  it('sends a signed-in buyer’s session and never touches the shared cache entry', async () => {
    jar.cookies = [{ name: '__Secure-sparx_customer_session', value: 'abc' }];
    await getProductsFull('gillett', { collection: 'c1' });
    const init = lastInit();
    expect(init.cache).toBe('no-store');
    expect(init.next).toBeUndefined();
    expect((init.headers as Record<string, string>).Cookie).toContain(
      '__Secure-sparx_customer_session=abc'
    );
  });

  it('keeps the shared, tagged entry for a visitor who is not signed in', async () => {
    jar.cookies = [{ name: 'theme', value: 'dark' }];
    await getProductsFull('gillett', { collection: 'c1' });
    const init = lastInit();
    expect(init.next?.tags).toContain('commerce:gillett:products');
    expect(init.headers).toBeUndefined();
  });
});

function product(over: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id: 'p1',
    title: 'Fuel filter',
    handle: 'fuel-filter',
    description: null,
    vendor: null,
    productType: null,
    tags: [],
    priceMinCents: 4900,
    priceMaxCents: 4900,
    compareAtCents: null,
    yourPriceCents: null,
    inStock: true,
    averageRating: null,
    reviewCount: 0,
    primaryImageId: null,
    primaryImageAlt: null,
    defaultVariantId: 'v1',
    seoTitle: null,
    seoDescription: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    options: [],
    images: [],
    variants: [
      {
        id: 'v1',
        sku: 'FF-1',
        title: null,
        priceCents: 4900,
        compareAtPriceCents: null,
        coreChargeCents: null,
        coreFirstOffered: false,
        yourPriceCents: null,
        isDefault: true,
        inventoryPolicy: 'deny',
        optionValueIds: [],
        available: 5,
        inStock: true,
      },
    ],
    ...over,
  } as unknown as PublicProduct;
}

describe('the builder record shows the buyer’s own price', () => {
  it('on the card and on the version, with the list price struck through', () => {
    const base = product();
    const record = productToBuilderRecord(
      {
        ...base,
        yourPriceCents: 4200,
        variants: base.variants.map((v) => ({ ...v, yourPriceCents: 4200 })),
      },
      'gillett',
      'USD'
    );
    expect(record).toMatchObject({ price: 42, compareAtPrice: 49 });
    expect(record.variants[0]).toMatchObject({ priceCents: 4200, compareAtPriceCents: 4900 });
  });

  it('shows the list price to everyone else', () => {
    const record = productToBuilderRecord(product(), 'gillett', 'USD');
    expect(record).toMatchObject({ price: 49, compareAtPrice: null });
    expect(record.variants[0]).toMatchObject({ priceCents: 4900, compareAtPriceCents: null });
  });
});
