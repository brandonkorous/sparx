# sparx Platform — Typesense Search Specification

**Version:** 1.6.0
**Author:** Brandon Korous
**Last Updated:** 2026-10-06

---

## Implementation status (2026-05-31)

Built end-to-end across four shippable slices (branch `feat/typesense-search-phase1`). Reality differs from the original v1.0 sketch in a few places — those are the source of truth:

- **Collections** are **shared + tenant-partitioned** (one `products`/`customers`/`orders` collection each, every query forced through a `tenant_id:=<t>` filter by the `@wizeworks/search` wrappers), not a collection per tenant. The schema field names/types live in `wizeworks/packages/search/src/schemas/` and supersede the field sketches in §3 (notably `*_cents` int money fields, `handle`, `category_ids`/`collection_ids`).
- **Indexing pipeline:** real-time via Pub/Sub. Products/variants/inventory already published; **customers** flow through the CRM bus (`crm.customer.*`) and **orders** through the platform bus (`order.*`), both bridged to Google Pub/Sub by `@wizeworks/crm/pubsub` and consumed by the `commerce-indexer` Cloud Run worker. Full reindex via `POST /v1/search/reindex` → `search.reindex.requested` → worker bulk-projection from Postgres.
- **API:** `GET /v1/search/{products,customers,orders}`, `GET /v1/search` (palette), `GET /v1/search/status`, `POST /v1/search/reindex`, `GET /v1/search/key` (scoped-key), plus the public site `GET /v1/public/commerce/search` (Typesense-ranked, Postgres-hydrated cards + facet counts).
- **Surfaces:** site `/search` faceted page, dashboard ⌘K deep search, CRM orders list, and MCP tools (`search_products/customers/orders/all`, scope `read:search`).
- **Reindex is reachable by the tenant, not just the operator.** Alongside `POST /v1/search/reindex` (admin role) and the operator endpoint, the MCP tool **`rebuild_search_index`** publishes the same `search.reindex.requested` event under a dedicated **`write:search`** scope (owner/admin-grantable only, confirmation-gated). It lives in `wizeworks/services/api-mcp/src/search-admin-tools.ts` rather than `@wizeworks/search`, deliberately: publishing needs `@google-cloud/pubsub` and `@wizeworks/search` is imported by the Next apps for ⌘K. Without it, "my products are in the catalog but storefront search finds nothing" — the exact symptom of an index that never populated — had no remedy from inside the tenant.
- **Synonyms (§6):** GLOBAL only. Per-tenant custom synonyms are **NOT** possible with shared collections (they'd leak across tenants) — deferred to a future per-tenant-collection model.
- **Scoped keys:** require a search-only parent key (`TYPESENSE_SEARCH_KEY`), never the admin key; endpoint 501s until provisioned. Server-proxied search is the default; browser-direct querying is opt-in.

---

## 1. Why Typesense

Typesense is a single-binary, open-source search engine written in C++. It runs as a GKE pod with a persistent volume. No JVM, no cluster management, no index shards. Operationally equivalent to the Redis pod — just a container.

It replaces PostgreSQL tsvector as the search layer from day one because:

- Typo tolerance — "boach injector" finds "Bosch injector"
- Faceted filtering — filter by brand, price range, fitment, stock status simultaneously
- Sub-50ms queries at 100K+ products
- Relevance tuning per field
- Synonyms — "turbo" / "turbocharger" / "turbine" all match
- Geosearch — useful for service scheduling and dealer proximity

For Gillett Diesel's catalog (part numbers, engine fitments, brands, price ranges), faceted search is not optional. tsvector handles full-text but can't do multi-dimensional faceting cleanly.

---

## 2. Kubernetes Deployment

```yaml
# k8s/sparx-prod/typesense.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: typesense-data
  namespace: sparx-prod
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard-rwo
  resources:
    requests:
      storage: 5Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: typesense
  namespace: sparx-prod
  labels:
    app: typesense
spec:
  replicas: 1
  selector:
    matchLabels:
      app: typesense
  template:
    metadata:
      labels:
        app: typesense
    spec:
      containers:
        - name: typesense
          image: typesense/typesense:0.25.2
          args:
            - --data-dir=/data
            - --api-key=$(TYPESENSE_API_KEY)
            - --listen-port=8108
            - --enable-cors
          env:
            - name: TYPESENSE_API_KEY
              valueFrom:
                secretKeyRef:
                  name: sparx-secrets
                  key: TYPESENSE_API_KEY
          ports:
            - containerPort: 8108
          volumeMounts:
            - name: data
              mountPath: /data
          resources:
            requests:
              memory: '512Mi'
              cpu: '250m'
            limits:
              memory: '2Gi'
              cpu: '1000m'
          readinessProbe:
            httpGet:
              path: /health
              port: 8108
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8108
            initialDelaySeconds: 30
            periodSeconds: 10
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: typesense-data
---
apiVersion: v1
kind: Service
metadata:
  name: typesense
  namespace: sparx-prod
spec:
  selector:
    app: typesense
  ports:
    - port: 8108
      targetPort: 8108
  type: ClusterIP
```

Internal URL: `http://typesense.sparx-prod.svc.cluster.local:8108`

Cost: 5GB persistent disk at $0.04/GB/mo = **$0.20/mo**

---

## 3. Collection Schemas

### Products Collection

```typescript
// src/search/schemas/products.ts
import Typesense from 'typesense';

export const PRODUCTS_SCHEMA = {
  name: 'products',
  fields: [
    // Core fields
    { name: 'id', type: 'string' },
    { name: 'tenant_id', type: 'string', facet: true },
    { name: 'title', type: 'string', weight: 4 },
    { name: 'description', type: 'string', weight: 2 },
    { name: 'sku', type: 'string[]', facet: false },
    { name: 'tags', type: 'string[]', facet: true },
    { name: 'vendor', type: 'string', facet: true },
    { name: 'product_type', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },

    // Pricing
    { name: 'price_min', type: 'float', facet: true },
    { name: 'price_max', type: 'float', facet: true },

    // Inventory
    { name: 'in_stock', type: 'bool', facet: true },
    { name: 'total_inventory', type: 'int32' },

    // Fitment (Gillett Diesel specific — engine/vehicle compatibility)
    { name: 'fitment_makes', type: 'string[]', facet: true },
    { name: 'fitment_models', type: 'string[]', facet: true },
    { name: 'fitment_years', type: 'int32[]', facet: true },
    { name: 'fitment_engines', type: 'string[]', facet: true },

    // SEO / metadata
    { name: 'slug', type: 'string' },
    { name: 'image_url', type: 'string', optional: true },
    { name: 'created_at', type: 'int64' },
    { name: 'updated_at', type: 'int64' },
  ],
  default_sorting_field: 'created_at',
  // Synonyms applied per-tenant at query time
};
```

### Customers Collection

```typescript
export const CUSTOMERS_SCHEMA = {
  name: 'customers',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'tenant_id', type: 'string', facet: true },
    { name: 'full_name', type: 'string', weight: 4 },
    { name: 'email', type: 'string', weight: 3 },
    { name: 'phone', type: 'string', optional: true },
    // Every business the person answers to, joined with " · ": the account that
    // prices them (`companyId`), each trade account they are an ACTIVE contact on
    // (`b2b_account_contacts`), then the employer they typed (`company_name`).
    // Duplicates dropped regardless of case. See "Customers on a trade account".
    { name: 'company', type: 'string', weight: 3, optional: true },
    { name: 'type', type: 'string', facet: true }, // retail | b2b | wholesale
    { name: 'tags', type: 'string[]', facet: true },
    { name: 'total_spent', type: 'float', facet: true },
    { name: 'order_count', type: 'int32' },
    { name: 'b2b_account_id', type: 'string', optional: true, facet: true },
    { name: 'created_at', type: 'int64' },
    { name: 'last_order_at', type: 'int64', optional: true },
  ],
  default_sorting_field: 'total_spent',
};
```

#### Customers on a trade account

A person on a trade account is found by the account's name, alone or with their own: "Wasatch" finds every contact on Wasatch Front Utility Contractors, LLC, and "Wasatch Marcus" finds Marcus. Typesense matches each word in any of `full_name`, `email` and `company`, and drops words only when the whole phrase matches nothing (`drop_tokens_threshold` 1), so a two-word query naming the account and the person returns that person alone.

`company` used to be the typed employer only. A contact added from the account's screen, or filed by the customer editor, has the pointer and the membership row and nothing typed, so two of Wasatch's three contacts could not be found by its name (measured on Gillett Diesel Service, 2026-10-03).

Because the document carries account names, three writes that are not the customer row re-read it:

- adding a contact, or switching one on or off: `b2bAccountContactService.create` / `update` publish `search.entity.changed` with `entityType: 'customer'`, which the indexer routes to the customers collection;
- renaming an account: `crm.b2b_account.updated` becomes `search.entity.changed` for the `b2b_account`, and the indexer re-reads every customer filed under it or on its contact list;
- removing an account: `companyService.softDelete` publishes the same `b2b_account` signal, which deletes the account's entry and re-reads its people.

A change to what the projector writes needs `ops:reindex-search` after release, because existing documents are only rewritten when something touches them.

The pricing account is read BY ID (`pricingAccount` in `search-projection.ts`), never joined as `customer.company`. The Prisma client publishes a computed `company` on every customer (the typed employer, `packages/db/src/client.ts`) that shadows the relation: the join is accepted, runs, and returns the typed string. Until 2026-10-04 the projection joined it that way, so a buyer priced by an account and on none of its contact lists was not found by the account's name. `check:shadowed` did not see it then, because it only looked under a nested `customer: {` key, not under a top-level `tx.customer.findFirst(`. It now parses the source, traces every select to its model from the schema at any depth, judges reads like `customer.company.creditLimit`, and refuses a select on Customer it cannot read.

### Orders Collection

```typescript
export const ORDERS_SCHEMA = {
  name: 'orders',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'tenant_id', type: 'string', facet: true },
    { name: 'order_number', type: 'string', weight: 5 },
    { name: 'customer_name', type: 'string', weight: 3 },
    { name: 'customer_email', type: 'string', weight: 3 },
    // The trade account the order belongs to, by name. See "Orders on a trade account".
    { name: 'company', type: 'string', weight: 3, optional: true },
    { name: 'b2b_account_id', type: 'string', optional: true, facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'financial_status', type: 'string', facet: true },
    { name: 'total', type: 'float' },
    { name: 'item_titles', type: 'string[]', weight: 2 },
    { name: 'created_at', type: 'int64' },
  ],
  default_sorting_field: 'created_at',
};
```

#### Orders on a trade account

An order is found by the name of the trade account it belongs to: "Wasatch" lists Wasatch Front Utility Contractors, LLC's orders beside the account, its invoices, quotes and people, and "Wasatch O-000014" narrows to that order. Measured on Gillett Diesel Service, 2026-10-04: before this, "Wasatch" found none of the account's five orders.

Which account (`orderAccount` in `wizeworks/packages/commerce/src/search-projection.ts`), first one on record wins:

1. the account the order was quoted to (`orders.converted_from_document_id` → the quote's `company_id`);
2. the account its first live invoice was raised to (`billing_documents.order_id`, oldest first);
3. the buyer's pricing account today (`customers.company_id`).

The first two were settled while the order was being made, so they keep an order with the account it was placed for after the buyer moves on. Most orders have neither, and for those the pricing account is the account the sign-off rules and the B2B reports already treat as the order's. A removed account is not named, and nothing stands in for it. With no account at all, `company` is the employer the buyer typed. `b2b_account_id` is the same account's id.

What re-reads an order's document, besides its own `order.*` events:

- **An account renamed or removed.** The `b2b_account` signal re-reads every order quoted to it, invoiced to it, or bought by somebody it prices (`listOrderIdsForAccount`), in batches of 250. Only when the NAME moved: the indexer compares the account's entry in `entities` with what the account projects to now, so the routine account writes (credit limit, terms, the daily near-the-limit signal) re-read nothing. The orders are re-read before the account's entry is overwritten, so a failure leaves the old name in place for the retry. The cost is bounded by that account's own order count, paid once per rename.
- **A customer's name, email, pricing account or typed employer changed.** Compared with the customer's current document in search, so tags, phone numbers and the order counters every checkout bumps re-read nothing. Their own orders only.
- **A merge.** Every order the survivor holds is re-read, because the merge moved the duplicates' orders onto it with no order event.
- **A quote or invoice written, re-pointed or removed.** The `billing_document` / `quote` signal (and `b2b.invoice.created`) re-reads the order it bills and the order it was converted into (`listOrderIdsForBillingDocument`), at most two.

##### Rolling it out without breaking search

Typesense fails the whole search when `query_by` names a field the collection does not have ("Could not find a field named `company` in the schema", measured on Typesense 28). In a multi-search it fails just that search, so the orders group would silently read "nothing matches". The field reaches a live collection only when the indexer boots (`ensureSchemas` adds missing optional fields), and the release rolls api-rest and the event-worker side by side in no fixed order. `ensureSchemas` can also fail and only log.

So every orders search asks the live collection first (`collectionHasField` in `wizeworks/packages/search/src/live-fields.ts`): one `retrieve` per collection per minute per process, shared by concurrent searches, and "not there" when it cannot look. Until the collection has `company`, the palette, `GET /v1/search/orders` and the operator's cross-tenant lookup search exactly as before. Within a minute of the indexer adding it, they include it, with no restart. A reading of "present" also expires, so a rollback that recreated the collection without the field fails searches for at most a minute.

After the release, existing order documents carry no `company` until rewritten, so run `ops.yml` → `reindex-search` (all tenants, `apply` ticked). It does not drop anything.

---

## 4. Search Service

```typescript
// src/search/typesense.client.ts
import Typesense from 'typesense';

export const typesense = new Typesense.Client({
  nodes: [
    {
      host: 'typesense.sparx-prod.svc.cluster.local',
      port: 8108,
      protocol: 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 2,
  retryIntervalSeconds: 0.1,
  numRetries: 3,
});
```

```typescript
// src/search/product.search.ts
import { typesense } from './typesense.client';

interface ProductSearchParams {
  tenantId: string;
  query: string;
  page?: number;
  perPage?: number;
  filters?: {
    vendor?: string[];
    productType?: string[];
    inStock?: boolean;
    priceMin?: number;
    priceMax?: number;
    tags?: string[];
    fitmentMake?: string;
    fitmentModel?: string;
    fitmentYear?: number;
    fitmentEngine?: string;
  };
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  facets?: string[];
}

export async function searchProducts(params: ProductSearchParams) {
  const {
    tenantId,
    query,
    page = 1,
    perPage = 24,
    filters = {},
    sort = 'relevance',
    facets = [],
  } = params;

  // Always filter by tenant — security requirement
  const filterParts = [`tenant_id:=${tenantId}`, `status:=active`];

  if (filters.vendor?.length) filterParts.push(`vendor:[${filters.vendor.join(',')}]`);
  if (filters.productType?.length)
    filterParts.push(`product_type:[${filters.productType.join(',')}]`);
  if (filters.inStock !== undefined) filterParts.push(`in_stock:=${filters.inStock}`);
  if (filters.priceMin !== undefined) filterParts.push(`price_min:>=${filters.priceMin}`);
  if (filters.priceMax !== undefined) filterParts.push(`price_max:<=${filters.priceMax}`);
  if (filters.tags?.length) filterParts.push(`tags:[${filters.tags.join(',')}]`);

  // Fitment filtering (Gillett Diesel — engine compatibility)
  if (filters.fitmentMake) filterParts.push(`fitment_makes:=${filters.fitmentMake}`);
  if (filters.fitmentModel) filterParts.push(`fitment_models:=${filters.fitmentModel}`);
  if (filters.fitmentYear) filterParts.push(`fitment_years:=${filters.fitmentYear}`);
  if (filters.fitmentEngine) filterParts.push(`fitment_engines:=${filters.fitmentEngine}`);

  const sortBy = {
    relevance: '_text_match:desc,created_at:desc',
    price_asc: 'price_min:asc',
    price_desc: 'price_max:desc',
    newest: 'created_at:desc',
  }[sort];

  const result = await typesense
    .collections('products')
    .documents()
    .search({
      q: query || '*',
      query_by: 'title,sku,description,tags,vendor',
      query_by_weights: '4,3,2,1,2',
      filter_by: filterParts.join(' && '),
      sort_by: sortBy,
      page,
      per_page: perPage,
      facet_by: facets.join(','),
      max_facet_values: 50,
      highlight_full_fields: 'title',
      typo_tokens_threshold: 1,
      num_typos: 2,
    });

  return {
    hits:
      result.hits?.map((h) => ({
        ...h.document,
        highlight: h.highlight,
      })) ?? [],
    total: result.found,
    page: result.page,
    facets: result.facet_counts,
    searchTimeMs: result.search_time_ms,
  };
}
```

---

## 5. Sync Worker

The sync worker keeps Typesense in sync with PostgreSQL. It runs two modes:

### Mode 1: Real-time sync (Pub/Sub consumer)

Subscribes to `product.created`, `product.updated`, `product.deleted` events.
Upserts or deletes the Typesense document within seconds of the DB change.

```typescript
// src/workers/search-sync.worker.ts
import { pubsub } from '../pubsub';
import { db } from '../db';
import { typesense } from '../search/typesense.client';

pubsub.subscribe('product.updated', async (message) => {
  const { productId, tenantId } = message;

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { variants: true },
  });

  if (!product || product.deletedAt) {
    // Soft deleted or not found — remove from index
    await typesense.collections('products').documents(productId).delete();
    return;
  }

  await typesense.collections('products').documents().upsert(toTypesenseProduct(product));
});

function toTypesenseProduct(product: ProductWithVariants): TypesenseProduct {
  const prices = product.variants.map((v) => parseFloat(v.price.toString()));
  const skus = product.variants.map((v) => v.sku).filter(Boolean) as string[];
  const inStock = product.variants.some(
    (v) => v.inventoryPolicy === 'continue' || v.inventoryQuantity > 0
  );

  return {
    id: product.id,
    tenant_id: product.tenantId,
    title: product.title,
    description: product.description ?? '',
    sku: skus,
    tags: product.tags,
    vendor: product.vendor ?? '',
    product_type: product.productType ?? '',
    status: product.status,
    price_min: Math.min(...prices),
    price_max: Math.max(...prices),
    in_stock: inStock,
    total_inventory: product.variants.reduce((sum, v) => sum + (v.inventoryQuantity ?? 0), 0),
    // Fitment data from product metadata
    fitment_makes: product.metadata?.fitment?.makes ?? [],
    fitment_models: product.metadata?.fitment?.models ?? [],
    fitment_years: product.metadata?.fitment?.years ?? [],
    fitment_engines: product.metadata?.fitment?.engines ?? [],
    slug: product.slug,
    image_url: product.images?.[0]?.url,
    created_at: Math.floor(product.createdAt.getTime() / 1000),
    updated_at: Math.floor(product.updatedAt.getTime() / 1000),
  };
}
```

### Mode 2: Full reindex (on-demand or scheduled)

Used for initial population and recovery from sync drift.

```typescript
// src/search/reindex.ts
export async function reindexTenant(tenantId: string) {
  // Fetch all products for this tenant in batches
  let cursor: string | undefined;
  let indexed = 0;

  while (true) {
    const products = await db.product.findMany({
      where: { tenantId, deletedAt: null },
      include: { variants: true },
      take: 250,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (products.length === 0) break;

    // Typesense bulk import (much faster than individual upserts)
    await typesense
      .collections('products')
      .documents()
      .import(products.map(toTypesenseProduct), { action: 'upsert' });

    indexed += products.length;
    cursor = products[products.length - 1].id;
    console.log(`Reindexed ${indexed} products for tenant ${tenantId}`);

    if (products.length < 250) break;
  }

  return indexed;
}

// Full platform reindex (run once at launch, then rely on real-time sync)
export async function reindexAll() {
  const tenants = await db.tenant.findMany({ where: { status: 'active' } });
  for (const tenant of tenants) {
    await reindexTenant(tenant.id);
  }
}
```

---

## 6. Synonyms Configuration

Synonyms are configured per-tenant, allowing tenants to define their own:

```typescript
// Built-in synonyms applied to all tenants
const GLOBAL_SYNONYMS = [
  { id: 'turbo', synonyms: ['turbocharger', 'turbo', 'turbine', 'tc'] },
  { id: 'injector', synonyms: ['injector', 'fuel injector', 'nozzle'] },
  { id: 'filter', synonyms: ['filter', 'filtration', 'strainer'] },
  { id: 'pump', synonyms: ['pump', 'pumping unit'] },
];

// Applied per-collection at startup
async function applySynonyms() {
  for (const synonym of GLOBAL_SYNONYMS) {
    await typesense
      .collections('products')
      .synonyms()
      .upsert(synonym.id, { synonyms: synonym.synonyms });
  }
}
```

Tenants can add custom synonyms from their dashboard (Settings → Search → Synonyms).

---

## 7. API Endpoints

```
GET /v1/search/products?q=bosch+injector&vendor=Bosch&in_stock=true&price_max=500
GET /v1/search/customers?q=acme+fleet
GET /v1/search/orders?q=WW-1234

POST /v1/search/reindex           (staff only — trigger full reindex)
GET  /v1/search/status            (index stats per collection)

// Site-facing (no auth, tenant from domain)
GET /site/search?q=injector&facets=vendor,product_type,price_range
```

---

## 8. Dashboard Search Experience

The Typesense integration enables instant search across the entire dashboard:

```
⌘K / Ctrl+K  →  Global command palette
  Type: "1234"      → finds order WW-1234
  Type: "acme"      → finds customer Acme Fleet Services
  Type: "bosch"     → finds Bosch products
  Type: "john"      → finds customer John Smith + any orders mentioning John
```

This is a single Typesense multi-search call across all three collections, filtered to the current tenant, returning the top results per collection. The workbench's "Search everything" box also queries the universal `entities` collection (`GET /v1/search/all`).

Both calls cap what they return (24 universal rows and 8 per collection on the first page). `GET /v1/search` returns `found` per collection and `GET /v1/search/all` returns `total`, so the box counts what matched beyond what came back. When anything did, its foot line says how many more match and offers **Show more**, which asks for the next step (up to 250 universal rows and 100 per collection). Past that it asks for another word instead.

```typescript
const results = await typesense.multiSearch.perform(
  {
    searches: [
      { collection: 'products', q: query, query_by: 'title,sku', per_page: 3 },
      { collection: 'customers', q: query, query_by: 'full_name,email,company', per_page: 3 },
      // `company` only once the live collection has it (see "Rolling it out").
      {
        collection: 'orders',
        q: query,
        query_by: 'order_number,customer_name,customer_email,company',
        per_page: 3,
      },
    ],
  },
  {
    filter_by: `tenant_id:=${tenantId}`,
  }
);
```

---

## 9. Scaling Path

Typesense handles millions of documents on a single node. The GKE pod is sufficient until:

- Single tenant exceeds ~5M products (very unlikely in e-commerce)
- Search latency p95 exceeds 100ms under load
- Multiple tenants doing heavy concurrent search

At that point: Typesense Cloud ($99/mo for managed) or Typesense cluster mode (3 nodes for HA). Either is years away.

---

## 10. Initialization Checklist

On first cluster deployment:

```bash
# 1. Apply Kubernetes manifests
kubectl apply -f k8s/sparx-prod/typesense.yaml

# 2. Wait for pod ready
kubectl -n sparx-prod wait --for=condition=ready pod -l app=typesense

# 3. Create collections (run once via init script)
pnpm run search:init

# 4. Full reindex (run after first DB migration and seed)
pnpm run search:reindex

# 5. Verify
curl http://typesense.sparx-prod.svc.cluster.local:8108/health \
  -H "X-TYPESENSE-API-KEY: $TYPESENSE_API_KEY"
# → {"ok":true}
```

---

## 11. Tests Never Touch Real Collections

**The rule:** a test run must never be able to destroy a developer's working search data. Any test that creates, fills, drops or empties a Typesense collection does it ONLY to collections carrying a test prefix, which the suite creates and drops itself. A run against the local dev instance leaves every real collection exactly as it found it.

**Why:** on 2026-10-04 a run of the `@wizeworks/search` suite against a developer's local Typesense dropped every collection on it (the suite's setup called `dropAllSchemas()` on the bare names), and every tenant's search read empty until it was rebuilt by hand. The same thing had already happened on 2026-09-18.

**The one naming mechanism.** Every collection name in `@wizeworks/search` is resolved through `wizeworks/packages/search/src/schemas/naming.ts`: the `TYPESENSE_COLLECTION_PREFIX` env var, read once at load, goes in front of each base name (`products`, `customers`, `orders`, `entities`), and the `*_COLLECTION` constants every read, write and delete uses are built from it. Production never sets it, so the names there are the bare base names. Do not add a second way to name collections; extend this one.

**How a suite gets its prefix.** `wizeworks/packages/search/vitest.config.ts` sets `TYPESENSE_COLLECTION_PREFIX=test_<random>_` for each run. The round-trip suite (`test/round-trip.test.ts`) creates `test_<run>_products` and the rest, writes its fixtures there, and drops them in `afterAll`. It also sweeps test collections an earlier crashed run left behind (test-prefixed only, older than an hour, never the current run's). Any new suite that talks to a real Typesense must run under the same config, or set the same variable the same way.

**The backstop.** The destructive helpers refuse, loudly and before anything is gone, any collection without a test prefix (`/^test_[a-z0-9]+_/`):

- `dropTestCollections(names)` and `dropAllSchemas()` (both in `src/admin.ts`, test-only; nothing in production drops a collection) refuse every time.
- `dropTenantFromCollection` (`src/bulk.ts`, used for offboarding and full reindex) refuses whenever it runs under vitest (`VITEST` is set), so a test that reaches it unmocked cannot empty a real tenant's documents.
- The round-trip suite refuses to start, before its first write, unless every collection it would touch carries the test prefix.

The refusal names the collection: `REFUSED to drop Typesense collection "products": it does not carry a test prefix`. Proved on 2026-10-04 by pointing the round-trip teardown at `products`: it refused, the real `products` kept all 1,253 documents, and the run's own `test_<run>_*` collections were the only ones written.

**Where the suites run.** The round-trip suite self-skips when Typesense is unreachable and under `CI=true` (which the pre-push hook sets), because CI has no Typesense and the hook must never be stricter than CI. Run it locally with `pnpm --filter @wizeworks/search test`; point it at the local instance over IPv4 (`TYPESENSE_HOST=127.0.0.1`, the suite's default) since `localhost` can resolve to IPv6 first. The `commerce-indexer` suites and `api-rest`'s search test mock `@wizeworks/search`. `api-rest` itself only imports read functions from it (searches, counts); reindexing goes through the `search.reindex.requested` event, so no `api-rest` test writes to Typesense.

## 12. A Count Is Every Match

**The rule:** every search that reports how many matched sends `max_candidates: 100` (`EVERY_PREFIX` in `wizeworks/packages/search/src/search.ts`), so `found` is a count and not an accident of page size.

Typesense grows the last, half-typed word of a query into the indexed words it starts, but only into its `max_candidates` best ones, and the default is 4. Its `found` counts what those words match. Measured 2026-10-06 on Gillett, 15 orders O-000001 to O-000015, all indexed: "O-0000" asking for 5 rows found 4, asking for 16 found 10, and the console search box said "10 records matched" while O-000001 to O-000005 were never listed. At 50 or 100 it found all 15 at any page size, in 0 ms.

It is sent by products (including the fleet-ranked search), customers, orders, the universal search, all three searches inside the console search box, and the support searches across tenants. A match-all `q: '*'` grows no word and needs none. `search/src/every-prefix-counts.test.ts` checks each search asks with it; a new search has to be added there.

**A search that did not answer is not zero.** The console search box reports `failed` when a backend errors and gives nothing back, and says "The search could not reach your records just now, so this is not an answer." with Try again, never "Nothing in your records matches". A query past 1,000 characters is not sent at all and says it is too long, because a request that size is refused every time and "try again" could never work.
