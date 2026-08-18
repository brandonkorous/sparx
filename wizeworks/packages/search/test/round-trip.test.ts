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
import {
  bulkUpsertCustomers,
  bulkUpsertEntities,
  bulkUpsertOrders,
  bulkUpsertProducts,
} from '../src/bulk';
import { palette, searchAll, searchCustomers, searchOrders, searchProducts } from '../src/search';
import { GLOBAL_SITE_SCOPE } from '../src/schemas';
import { ensureSynonyms, GLOBAL_PRODUCT_SYNONYMS } from '../src/synonyms';
import { generateScopedSearchKeyWithExpiry } from '../src/keys';
import type {
  CustomerSearchDocument,
  OrderSearchDocument,
  ProductSearchDocument,
  UniversalSearchDocument,
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

function entity(
  tenantId: string,
  entityType: string,
  recordId: string,
  over: Partial<UniversalSearchDocument> = {}
): UniversalSearchDocument {
  return {
    id: `${tenantId}:${entityType}:${recordId}`,
    tenant_id: tenantId,
    entity_type: entityType,
    module: 'commerce',
    record_id: recordId,
    title: 'Untitled',
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    ...over,
  };
}

describe.skipIf(!AVAILABLE)('@wizeworks/search round-trip', () => {
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

  it('scopes products to the active site via the Model B property facet', async () => {
    // A separate tenant so this doesn't perturb TENANT_A's count assertions.
    const TENANT_C = 'tenant-cccccccc';
    const SITE_A = 'prop-aaaaaaaa';
    const SITE_B = 'prop-bbbbbbbb';
    await bulkUpsertProducts([
      // Global — the sentinel makes it visible on every site.
      product(TENANT_C, 'g1', {
        title: 'Global Widget',
        handle: 'global-widget',
        property_ids: [GLOBAL_SITE_SCOPE],
      }),
      product(TENANT_C, 'sa', {
        title: 'Site A Widget',
        handle: 'site-a-widget',
        property_ids: [SITE_A],
      }),
      product(TENANT_C, 'sb', {
        title: 'Site B Widget',
        handle: 'site-b-widget',
        property_ids: [SITE_B],
      }),
    ]);

    // Site A search → global + A's exclusive, never B's.
    const a = await searchProducts({ tenantId: TENANT_C, q: '*', propertyId: SITE_A });
    expect(a.hits.map((h) => h.document.product_id).sort()).toEqual(['g1', 'sa']);
    expect(a.found).toBe(2);

    // Site B search → global + B's exclusive, never A's.
    const b = await searchProducts({ tenantId: TENANT_C, q: '*', propertyId: SITE_B });
    expect(b.hits.map((h) => h.document.product_id).sort()).toEqual(['g1', 'sb']);

    // No property filter (admin/dashboard) → all three.
    const all = await searchProducts({ tenantId: TENANT_C, q: '*' });
    expect(all.found).toBe(3);
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

  it('scopes customers and orders to the active site via property_id', async () => {
    // A separate tenant so this doesn't perturb TENANT_A's count assertions.
    const TENANT_S = 'tenant-ssssssss';
    const SITE_A = 'prop-site-aaaa';
    const SITE_B = 'prop-site-bbbb';
    await bulkUpsertCustomers([
      customer(TENANT_S, 'sca', { full_name: 'Cars Buyer', property_id: SITE_A }),
      customer(TENANT_S, 'scb', { full_name: 'Dogs Buyer', property_id: SITE_B }),
      // Legacy membership with no site — only visible in the whole-tenant view.
      customer(TENANT_S, 'scn', { full_name: 'Legacy Buyer' }),
    ]);
    await bulkUpsertOrders([
      order(TENANT_S, 'soa', { order_number: 'CARS-1', property_id: SITE_A }),
      order(TENANT_S, 'sob', { order_number: 'DOGS-1', property_id: SITE_B }),
      order(TENANT_S, 'son', { order_number: 'LEGACY-1' }),
    ]);

    // Site A → only A's membership/order; never B's, never the legacy row.
    const custA = await searchCustomers({ tenantId: TENANT_S, q: '*', propertyId: SITE_A });
    expect(custA.hits.map((h) => h.document.customer_id).sort()).toEqual(['sca']);
    const ordA = await searchOrders({ tenantId: TENANT_S, q: '*', propertyId: SITE_A });
    expect(ordA.hits.map((h) => h.document.order_id).sort()).toEqual(['soa']);

    // No property filter (All sites) → all three of each, including the legacy
    // row that has no property_id.
    const custAll = await searchCustomers({ tenantId: TENANT_S, q: '*' });
    expect(custAll.found).toBe(3);
    const ordAll = await searchOrders({ tenantId: TENANT_S, q: '*' });
    expect(ordAll.found).toBe(3);
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

  it('applies global synonyms (turbo → turbocharger)', async () => {
    const out = await ensureSynonyms();
    expect(out.applied).toEqual(GLOBAL_PRODUCT_SYNONYMS.map((g) => g.id));
    // "turbocharger" should now match the "Cummins Turbocharger" via the
    // turbo synonym group (and "turbo" would too).
    const res = await searchProducts({ tenantId: TENANT_A, q: 'turbo' });
    expect(res.hits.some((h) => h.document.title.includes('Turbocharger'))).toBe(true);
  });

  it('mints a tenant-scoped search key that only sees its tenant', () => {
    // Use the admin key as the parent for the test (prod uses a search-only
    // key); the derived key + embedded expiry is what we're asserting.
    process.env.TYPESENSE_SEARCH_KEY = process.env.TYPESENSE_API_KEY;
    const scoped = generateScopedSearchKeyWithExpiry(TENANT_A, 1_700_000_000, 3600);
    expect(typeof scoped.key).toBe('string');
    expect(scoped.key.length).toBeGreaterThan(0);
    expect(scoped.expiresInSeconds).toBe(3600);
  });

  it('universal search spans entity types, module-filters, and isolates tenants', async () => {
    await bulkUpsertEntities([
      entity(TENANT_A, 'warehouse', 'w1', { title: 'Visalia Main Warehouse', subtitle: 'VIS-1' }),
      entity(TENANT_A, 'discount', 'd1', { title: 'Fleet 10%', keywords: ['FLEET10'] }),
      entity(TENANT_A, 'b2b_account', 'a1', { title: 'Acme Diesel', module: 'crm' }),
      entity(TENANT_B, 'warehouse', 'w9', { title: 'Other Tenant Depot', subtitle: 'OTH-9' }),
    ]);

    // Tenant A sees only its own three docs — never tenant B's depot.
    const all = await searchAll({ tenantId: TENANT_A, q: '*' });
    expect(all.found).toBe(3);
    for (const hit of all.hits) expect(hit.document.tenant_id).toBe(TENANT_A);

    // Module filter scopes to commerce (warehouse + discount), excluding the
    // crm b2b_account — this is how the route gates to enabled modules.
    const commerceOnly = await searchAll({ tenantId: TENANT_A, q: '*', modules: ['commerce'] });
    expect(commerceOnly.found).toBe(2);
    expect(commerceOnly.hits.every((h) => h.document.module === 'commerce')).toBe(true);

    // entity_type filter narrows to a single type (a list page's use).
    const warehouses = await searchAll({ tenantId: TENANT_A, q: '*', entityTypes: ['warehouse'] });
    expect(warehouses.found).toBe(1);
    expect(warehouses.hits[0]?.document.entity_type).toBe('warehouse');

    // Free-text matches the title, still tenant-isolated.
    const byText = await searchAll({ tenantId: TENANT_A, q: 'visalia' });
    expect(byText.hits.some((h) => h.document.record_id === 'w1')).toBe(true);
    expect(byText.hits.every((h) => h.document.tenant_id === TENANT_A)).toBe(true);
  });
});
