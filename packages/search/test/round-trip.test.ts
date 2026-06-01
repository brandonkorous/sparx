// Round-trip integration test against a real Typesense.
//
// Self-skips when Typesense isn't reachable (no TYPESENSE running) so it runs
// locally after `pnpm db:up` and no-ops in CI / on machines without one.
// Covers the core contract the read path depends on: schemas create, docs
// upsert, the typed search wrappers return them, the ⌘K palette spans
// collections, status counts are tenant-scoped, and — critically — every
// query is isolated to its tenant.

import { beforeAll, describe, expect, it } from 'vitest';

import { _resetClientForTest, getClient } from '../src/client';
import { collectionStats, dropAllSchemas, ensureSchemas } from '../src/admin';
import { bulkUpsertCustomers, bulkUpsertOrders, bulkUpsertProducts } from '../src/bulk';
import { palette, searchCustomers, searchOrders, searchProducts } from '../src/search';
import type {
  CustomerSearchDocument,
  OrderSearchDocument,
  ProductSearchDocument,
} from '../src/schemas';

// Default to the docker-compose Typesense; allow env override.
process.env.TYPESENSE_HOST ??= 'localhost';
process.env.TYPESENSE_PORT ??= '8108';
process.env.TYPESENSE_PROTOCOL ??= 'http';
process.env.TYPESENSE_API_KEY ??= 'dev-typesense-key';

const TENANT_A = 'tenant-aaaaaaaa';
const TENANT_B = 'tenant-bbbbbbbb';

async function typesenseUp(): Promise<boolean> {
  try {
    _resetClientForTest();
    const health = (await getClient().health.retrieve()) as { ok?: boolean };
    return health.ok === true;
  } catch {
    return false;
  }
}

const AVAILABLE = await typesenseUp();

function product(
  tenantId: string,
  id: string,
  over: Partial<ProductSearchDocument> = {}
): ProductSearchDocument {
  return {
    id: `${tenantId}:${id}`,
    tenant_id: tenantId,
    product_id: id,
    title: 'Bosch Fuel Injector',
    handle: `bosch-injector-${id}`,
    status: 'active',
    vendor: 'Bosch',
    price_min_cents: 12_900,
    price_max_cents: 12_900,
    in_stock: true,
    currency: 'USD',
    skus: ['BOS-INJ-001'],
    best_seller_rank: 1,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    ...over,
  };
}

function customer(
  tenantId: string,
  id: string,
  over: Partial<CustomerSearchDocument> = {}
): CustomerSearchDocument {
  return {
    id: `${tenantId}:${id}`,
    tenant_id: tenantId,
    customer_id: id,
    full_name: 'Acme Fleet Services',
    email: 'fleet@acme.test',
    company: 'Acme',
    type: 'b2b',
    total_spent_cents: 500_000,
    order_count: 12,
    created_at: 1_700_000_000,
    ...over,
  };
}

function order(
  tenantId: string,
  id: string,
  over: Partial<OrderSearchDocument> = {}
): OrderSearchDocument {
  return {
    id: `${tenantId}:${id}`,
    tenant_id: tenantId,
    order_id: id,
    order_number: 'WW-1001',
    customer_name: 'Acme Fleet Services',
    customer_email: 'fleet@acme.test',
    channel: 'storefront',
    status: 'placed',
    payment_status: 'paid',
    item_titles: ['Bosch Fuel Injector'],
    item_skus: ['BOS-INJ-001'],
    total_cents: 25_800,
    currency: 'USD',
    placed_at: 1_700_000_000,
    ...over,
  };
}

describe.skipIf(!AVAILABLE)('@sparx/search round-trip', () => {
  beforeAll(async () => {
    _resetClientForTest();
    await dropAllSchemas();
    await ensureSchemas();
    await bulkUpsertProducts([
      product(TENANT_A, 'p1'),
      product(TENANT_A, 'p2', {
        title: 'Cummins Turbocharger',
        handle: 'cummins-turbo',
        vendor: 'Cummins',
        skus: ['CUM-TC-9'],
      }),
      product(TENANT_B, 'p9', { title: 'Bosch Fuel Injector', handle: 'b-other', vendor: 'Bosch' }),
    ]);
    await bulkUpsertCustomers([
      customer(TENANT_A, 'c1'),
      customer(TENANT_B, 'c9', { full_name: 'Other Tenant Co', email: 'x@other.test' }),
    ]);
    await bulkUpsertOrders([
      order(TENANT_A, 'o1'),
      order(TENANT_B, 'o9', { order_number: 'WW-9999' }),
    ]);
    // Typesense indexes are near-real-time; bulk import is synchronous on
    // return, so no sleep is needed.
  });

  it('finds products with typo tolerance, tenant-isolated', async () => {
    // "boach" → "Bosch" via Typesense typo tolerance.
    const res = await searchProducts({ tenantId: TENANT_A, q: 'boach' });
    expect(res.found).toBeGreaterThanOrEqual(1);
    for (const hit of res.hits) {
      expect(hit.document.tenant_id).toBe(TENANT_A);
    }
    // Tenant B's identical "Bosch Fuel Injector" must never appear for A.
    expect(res.hits.every((h) => h.document.product_id !== 'p9')).toBe(true);
  });

  it('returns facet counts for products', async () => {
    const res = await searchProducts({ tenantId: TENANT_A, q: '*', facetBy: 'vendor' });
    const vendorFacet = res.facetCounts.find((f) => f.fieldName === 'vendor');
    expect(vendorFacet).toBeDefined();
    const vendors = (vendorFacet?.counts ?? []).map((c) => c.value).sort();
    expect(vendors).toContain('Bosch');
    expect(vendors).toContain('Cummins');
  });

  it('searches customers and orders, tenant-isolated', async () => {
    const custs = await searchCustomers({ tenantId: TENANT_A, q: 'acme' });
    expect(custs.found).toBe(1);
    expect(custs.hits[0]?.document.tenant_id).toBe(TENANT_A);

    const orders = await searchOrders({ tenantId: TENANT_A, q: 'WW-1001' });
    expect(orders.found).toBe(1);
    expect(orders.hits[0]?.document.order_number).toBe('WW-1001');
  });

  it('palette spans collections for one tenant only', async () => {
    const res = await palette({ tenantId: TENANT_A, q: 'acme' });
    expect(res.customers.length).toBeGreaterThanOrEqual(1);
    for (const hit of [...res.products, ...res.customers, ...res.orders]) {
      expect(hit.document.tenant_id).toBe(TENANT_A);
    }
  });

  it('reports tenant-scoped collection counts', async () => {
    const stats = await collectionStats(TENANT_A);
    const byName = Object.fromEntries(stats.map((s) => [s.collection, s.documents]));
    expect(byName.products).toBe(2); // not 3 — tenant B's product is excluded
    expect(byName.customers).toBe(1);
    expect(byName.orders).toBe(1);
  });
});
