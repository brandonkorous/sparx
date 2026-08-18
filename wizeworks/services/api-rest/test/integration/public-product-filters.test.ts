// Regression contract for the public product listing's FILTER + SORT + SCOPE params
// (docs/127 §8). These were silently non-functional once: `ProductListQuery` didn't parse
// `sort` / `minPriceCents` / `maxPriceCents` / `inStock`, so the storefront's PLP facets
// changed the URL but never changed the results — `sort=price-asc` returned default order.
// This locks the contract so that can't rot again, and covers the collection/category
// scoping the collection + category detail pages depend on (a bare grid before §8).
//
// Real HTTP via app.inject against a freshly-seeded tenant: three products at distinct
// prices + stock states, a collection holding two of them, and a two-level category tree
// with one product on the CHILD (to prove the rollup returns self + descendants).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { seedPrimaryProperty } from '../helpers.js';

interface Fixture {
  tenantId: string;
  slug: string;
  // Product handles, cheapest → dearest.
  cheap: string; // $10, in stock
  mid: string; // $30, OUT of stock
  dear: string; // $50, in stock
  collectionHandle: string; // holds cheap + dear
  parentCategoryHandle: string; // parent; `dear` lives on its child (rollup test)
}

async function seedFixture(): Promise<Fixture> {
  const slug = `pfilt-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: { slug, name: `Filters ${slug}`, email, plan: 'starter', status: 'active', settings: {} },
  });
  const ctx = { tenantId: tenant.id };

  const cheap = `cheap-${slug}`;
  const mid = `mid-${slug}`;
  const dear = `dear-${slug}`;
  const collectionHandle = `featured-${slug}`;
  const parentCategoryHandle = `tools-${slug}`;
  const childCategoryHandle = `drills-${slug}`;
  // Materialized dot-path: the child sits UNDER the parent (`<parentPath>.<child>`), so the
  // rollup's `path startsWith '<parentPath>.'` reaches it.
  const parentPath = `cat_${crypto.randomBytes(4).toString('hex')}`;
  const childPath = `${parentPath}.child`;

  await withTenant(ctx, async (tx) => {
    const mk = async (handle: string, price: number, inStock: boolean) => {
      const p = await tx.product.create({
        data: {
          tenantId: tenant.id,
          title: handle,
          handle,
          status: 'active',
          priceMinCents: price,
          priceMaxCents: price,
          inStock,
        },
        select: { id: true },
      });
      return p.id;
    };
    const cheapId = await mk(cheap, 1000, true);
    await mk(mid, 3000, false);
    const dearId = await mk(dear, 5000, true);

    const collection = await tx.productCollection.create({
      data: { tenantId: tenant.id, name: 'Featured', handle: collectionHandle, type: 'manual' },
      select: { id: true },
    });
    await tx.collectionProduct.create({
      data: { collectionId: collection.id, productId: cheapId, position: 0 },
    });
    await tx.collectionProduct.create({
      data: { collectionId: collection.id, productId: dearId, position: 1 },
    });

    const parent = await tx.productCategory.create({
      data: { tenantId: tenant.id, name: 'Tools', handle: parentCategoryHandle, path: parentPath },
      select: { id: true },
    });
    const child = await tx.productCategory.create({
      data: { tenantId: tenant.id, name: 'Drills', handle: childCategoryHandle, path: childPath },
      select: { id: true },
    });
    void parent;
    // `dear` is linked to the CHILD only — so a rollup on the parent must reach it.
    await tx.categoryProduct.create({
      data: { categoryId: child.id, productId: dearId, isPrimary: true, position: 0 },
    });
  });

  // Every real tenant has a primary site; without one every site-resolving read 404s.
  await seedPrimaryProperty(tenant.id, `Test ${slug}`);
  return { tenantId: tenant.id, slug, cheap, mid, dear, collectionHandle, parentCategoryHandle };
}

describe('public product listing — filters, sort, and scope', () => {
  let app: FastifyInstance;
  let f: Fixture;

  beforeAll(async () => {
    app = await createApp();
    f = await seedFixture();
  });
  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: f.tenantId } });
    await app.close();
  });

  interface ListBody {
    data: { handle: string }[];
    meta: { total: number };
    error?: { code: string };
  }
  // Typed GET against the listing — `app.inject().json()` is `any`, so cast once here
  // rather than scatter unsafe casts through every assertion.
  const get = async (query: string): Promise<{ status: number; body: ListBody }> => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/public/commerce/products?tenant=${f.slug}&${query}`,
    });
    return { status: res.statusCode, body: res.json<ListBody>() };
  };
  const handles = (body: ListBody) => body.data.map((p) => p.handle);

  it('returns all three active products by default', async () => {
    const { status, body } = await get('perPage=50');
    expect(status).toBe(200);
    expect(body.meta.total).toBe(3);
    expect(handles(body).sort()).toEqual([f.cheap, f.dear, f.mid].sort());
  });

  it('sort=price-asc orders cheapest → dearest', async () => {
    const { body } = await get('perPage=50&sort=price-asc');
    expect(handles(body)).toEqual([f.cheap, f.mid, f.dear]);
  });

  it('sort=price-desc orders dearest → cheapest', async () => {
    const { body } = await get('perPage=50&sort=price-desc');
    expect(handles(body)).toEqual([f.dear, f.mid, f.cheap]);
  });

  it('minPriceCents drops products below the floor', async () => {
    const { body } = await get('perPage=50&minPriceCents=3000');
    // $10 excluded; $30 and $50 remain.
    expect(handles(body).sort()).toEqual([f.dear, f.mid].sort());
  });

  it('maxPriceCents drops products above the ceiling', async () => {
    const { body } = await get('perPage=50&maxPriceCents=3000');
    // $50 excluded; $10 and $30 remain.
    expect(handles(body).sort()).toEqual([f.cheap, f.mid].sort());
  });

  it('inStock=true excludes out-of-stock products', async () => {
    const { body } = await get('perPage=50&inStock=true');
    // `mid` is out of stock.
    expect(handles(body).sort()).toEqual([f.cheap, f.dear].sort());
  });

  it('collection=<handle> scopes to that collection’s members', async () => {
    const { body } = await get(`perPage=50&collection=${f.collectionHandle}`);
    expect(body.meta.total).toBe(2);
    expect(handles(body).sort()).toEqual([f.cheap, f.dear].sort());
  });

  it('category=<handle> rolls up self + descendants', async () => {
    // `dear` lives on the CHILD category, so a parent-scoped listing must include it.
    const { body } = await get(`perPage=50&category=${f.parentCategoryHandle}`);
    expect(handles(body)).toEqual([f.dear]);
  });

  it('a scope handle that does not exist is a 404', async () => {
    const { status, body } = await get('collection=does-not-exist');
    expect(status).toBe(404);
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('composes a scope with a filter (collection + inStock)', async () => {
    // The collection holds cheap($10, in stock) + dear($50, in stock); both survive an
    // in-stock filter, but a min-price floor inside the collection drops the cheap one.
    const { body } = await get(`perPage=50&collection=${f.collectionHandle}&minPriceCents=3000`);
    expect(handles(body)).toEqual([f.dear]);
  });
});
