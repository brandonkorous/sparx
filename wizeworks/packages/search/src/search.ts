// Search API — typed wrappers around Typesense's search() that enforce
// tenant filtering and shape the response for the storefront / dashboard.

import type { SearchParams } from 'typesense/lib/Typesense/Types';

import { getClient } from './client';
import { collectionHasField } from './live-fields';
import {
  CUSTOMERS_COLLECTION,
  type CustomerSearchDocument,
  ENTITIES_COLLECTION,
  type UniversalSearchDocument,
  GLOBAL_SITE_SCOPE,
  ORDERS_COLLECTION,
  type OrderSearchDocument,
  PRODUCTS_COLLECTION,
  type ProductSearchDocument,
} from './schemas';

// Typesense's SearchParams is generic over (TDoc, Infix). We don't need
// either to be strict here since we shape the response ourselves; use
// `object` so any field set is acceptable.
type AnySearchParams = SearchParams<object, string>;

/**
 * How many whole words a half-typed word may stand for. Every search that
 * reports how many matched sends it.
 *
 * Typesense grows the last word of a query into the indexed words it starts,
 * but only into its `max_candidates` best ones, and that defaults to 4. So the
 * count was not a count. MEASURED 2026-10-06 on Gillett, 15 orders O-000001 to
 * O-000015, all indexed: "O-0000" asking for 5 rows found 4, asking for 16
 * found 10 and never listed O-000001 to O-000005, and the box said "10 records
 * matched". At 100 it finds all 15 whatever page size is asked for. 100 is how
 * many distinct words one half-typed word can stand for before the count
 * becomes "at least": an order-number prefix covers that many orders.
 */
export const EVERY_PREFIX = { max_candidates: 100 } as const;

export interface SearchHit<T> {
  document: T;
  highlights?: Record<string, { snippet?: string; matched_tokens?: unknown }>;
  textMatch?: number;
}

export interface SearchResult<T> {
  hits: SearchHit<T>[];
  found: number;
  page: number;
  perPage: number;
  facetCounts: { fieldName: string; counts: { value: string; count: number }[] }[];
}

export interface ProductSearchInput {
  tenantId: string;
  q?: string;
  /** Active web property (docs/49 §3 Model B). When set, results are scoped to
   *  this site: global products (sentinel `*`) plus products explicitly scoped
   *  here, never another site's exclusive items. Omit for admin/dashboard search
   *  (which sees every product regardless of site). */
  propertyId?: string;
  /** Composed by the storefront ("vendor:=Bosch && tag:=injectors"). */
  filterBy?: string;
  /** Comma-separated facet field list. */
  facetBy?: string;
  sortBy?: string;
  page?: number;
  perPage?: number;
  // Fitment-specific filters; the wrapper composes them into filterBy
  // so the storefront doesn't have to learn Typesense's grammar.
  fitmentMakes?: string[];
  fitmentModels?: string[];
  fitmentEngines?: string[];
  fitmentYear?: number;
  /** Products to rank FIRST without hiding the rest: the parts that fit a
   *  signed-in trade buyer's fleet (sparx persona issue 086). Order inside each
   *  group is the normal sort. */
  boostProductIds?: string[];
  /** Restrict to exactly these products ("parts that fit Unit 12"). An empty
   *  list matches nothing; it never means "no restriction". */
  onlyProductIds?: string[];
}

/** A backtick-quoted id list in Typesense filter grammar. */
function idList(ids: string[]): string {
  return `[${ids.map((id) => `\`${id}\``).join(',')}]`;
}

// Matches no product. A bare `product_id:=[]` is a filter syntax error, so an id
// no product can have stands in for an empty restriction.
const NO_PRODUCT = '00000000-0000-0000-0000-000000000000';

function joinFilter(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' && ');
}

function buildProductFilter(input: ProductSearchInput): string {
  const parts: (string | null)[] = [`tenant_id:=${input.tenantId}`, 'status:=active'];
  // Model B site scope (docs/49 §3): match global products (the GLOBAL_SITE_SCOPE
  // sentinel) OR products scoped to the active property. Backtick-quoted so the
  // values can't break the filter grammar.
  if (input.propertyId) {
    parts.push(`property_ids:=[\`${GLOBAL_SITE_SCOPE}\`,\`${input.propertyId}\`]`);
  }
  if (input.fitmentMakes?.length) {
    parts.push(`fitment_makes:=[${input.fitmentMakes.map((s) => `\`${s}\``).join(',')}]`);
  }
  if (input.fitmentModels?.length) {
    parts.push(`fitment_models:=[${input.fitmentModels.map((s) => `\`${s}\``).join(',')}]`);
  }
  if (input.fitmentEngines?.length) {
    parts.push(`fitment_engines:=[${input.fitmentEngines.map((s) => `\`${s}\``).join(',')}]`);
  }
  if (input.fitmentYear) {
    parts.push(`fitment_years:=${input.fitmentYear}`);
  }
  if (input.onlyProductIds) {
    const ids = input.onlyProductIds.length > 0 ? input.onlyProductIds : [NO_PRODUCT];
    parts.push(`product_id:=${idList(ids)}`);
  }
  if (input.filterBy) parts.push(input.filterBy);
  return joinFilter(parts);
}

const DEFAULT_PRODUCT_SORT = '_text_match:desc,best_seller_rank:asc,updated_at:desc';

/** Typesense takes at most three sort fields, so a boost takes first place and
 *  keeps the first two of the normal sort. */
function productSort(input: ProductSearchInput): string {
  const base = input.sortBy ?? DEFAULT_PRODUCT_SORT;
  if (!input.boostProductIds || input.boostProductIds.length === 0) return base;
  const rest = base.split(',').slice(0, 2).join(',');
  return `_eval(product_id:${idList(input.boostProductIds)}):desc,${rest}`;
}

/** The search request for a product query. Exported for its tests. */
export function buildProductSearchParams(input: ProductSearchInput): AnySearchParams {
  return {
    q: input.q && input.q.length > 0 ? input.q : '*',
    query_by: 'title,description,skus,tags,vendor',
    query_by_weights: '4,2,3,2,2',
    filter_by: buildProductFilter(input),
    facet_by:
      input.facetBy ??
      'vendor,product_type,tags,option_facets,fitment_makes,fitment_models,fitment_engines',
    sort_by: productSort(input),
    page: input.page ?? 1,
    per_page: input.perPage ?? 24,
    ...EVERY_PREFIX,
  };
}

export async function searchProducts(
  input: ProductSearchInput
): Promise<SearchResult<ProductSearchDocument>> {
  const params = buildProductSearchParams(input);
  // A list of product ids can run past what a GET query string carries, so a
  // search holding one goes as a POST body through multi-search.
  if (input.boostProductIds?.length || input.onlyProductIds) {
    const multi = (await getClient().multiSearch.perform({
      searches: [{ collection: PRODUCTS_COLLECTION, ...params }],
    })) as unknown as { results: ({ error?: string } | undefined)[] };
    const first = multi.results[0];
    if (first && typeof first.error === 'string') throw new Error(`Typesense: ${first.error}`);
    return shape<ProductSearchDocument>(first ?? {}, params);
  }
  const result = await getClient().collections(PRODUCTS_COLLECTION).documents().search(params);
  return shape<ProductSearchDocument>(result, params);
}

export interface CustomerSearchInput {
  tenantId: string;
  q: string;
  /** Active site (docs/58 D2). When set, scopes results to that site's
   *  memberships (`property_id:=<id>`); omit for the whole-tenant "All sites"
   *  view. Single-valued — a customer belongs to exactly one site. */
  propertyId?: string;
  page?: number;
  perPage?: number;
}

export async function searchCustomers(
  input: CustomerSearchInput
): Promise<SearchResult<CustomerSearchDocument>> {
  const params: AnySearchParams = {
    q: input.q,
    query_by: 'full_name,email,company,phone',
    query_by_weights: '4,3,3,2',
    filter_by: joinFilter([
      `tenant_id:=${input.tenantId}`,
      input.propertyId ? `property_id:=${input.propertyId}` : null,
    ]),
    page: input.page ?? 1,
    per_page: input.perPage ?? 20,
    ...EVERY_PREFIX,
  };
  const result = await getClient().collections(CUSTOMERS_COLLECTION).documents().search(params);
  return shape<CustomerSearchDocument>(result, params);
}

export interface OrderSearchInput {
  tenantId: string;
  q: string;
  /** Origin site (docs/58 D1). When set, scopes results to orders placed on
   *  that site (`property_id:=<id>`); omit for the whole-tenant "All sites"
   *  view. Single-valued — an order has one origin site. */
  propertyId?: string;
  page?: number;
  perPage?: number;
}

export async function searchOrders(
  input: OrderSearchInput
): Promise<SearchResult<OrderSearchDocument>> {
  const params: AnySearchParams = {
    q: input.q,
    ...orderQueryBy(await ordersHaveCompany()),
    filter_by: joinFilter([
      `tenant_id:=${input.tenantId}`,
      input.propertyId ? `property_id:=${input.propertyId}` : null,
    ]),
    page: input.page ?? 1,
    per_page: input.perPage ?? 20,
    ...EVERY_PREFIX,
  };
  const result = await getClient().collections(ORDERS_COLLECTION).documents().search(params);
  return shape<OrderSearchDocument>(result, params);
}

/**
 * Whether the live orders collection can be searched by the account's name yet.
 *
 * `company` reaches a live collection when the indexer next boots, and a search
 * naming a field the collection lacks fails outright, so every orders search
 * asks first. See ./live-fields.ts.
 */
export function ordersHaveCompany(): Promise<boolean> {
  return collectionHasField(ORDERS_COLLECTION, 'company');
}

/**
 * The fields an orders search reads, strongest first, with the account's name
 * beside the buyer's once the collection has it. "Wasatch" then lists the
 * account's orders, and "Wasatch O-000014" or "Wasatch Renée" narrows them: a
 * word may match in any of these fields, and every word has to match somewhere.
 * Exported for its tests.
 */
export function orderQueryBy(withCompany: boolean): {
  query_by: string;
  query_by_weights: string;
} {
  return withCompany
    ? {
        query_by: 'order_number,customer_name,customer_email,company,item_titles,item_skus',
        query_by_weights: '5,3,3,3,2,2',
      }
    : {
        query_by: 'order_number,customer_name,customer_email,item_titles,item_skus',
        query_by_weights: '5,3,3,2,2',
      };
}

// ─── Multi-collection (⌘K palette) ────────────────────────────────────

export interface PaletteResult {
  products: SearchHit<ProductSearchDocument>[];
  customers: SearchHit<CustomerSearchDocument>[];
  orders: SearchHit<OrderSearchDocument>[];
  /** How many matched in each collection, of which only `limitPerCollection`
   *  came back. Without it the box can only count the rows it was handed, and
   *  says "8 records matched" over a ninth it never asked for. */
  found: { products: number; customers: number; orders: number };
}

export async function palette(input: {
  tenantId: string;
  q: string;
  limitPerCollection?: number;
}): Promise<PaletteResult> {
  const limit = input.limitPerCollection ?? 5;
  const ordersByCompany = await ordersHaveCompany();
  const result = (await getClient().multiSearch.perform({
    searches: [
      {
        collection: PRODUCTS_COLLECTION,
        q: input.q,
        query_by: 'title,skus,vendor,tags',
        filter_by: `tenant_id:=${input.tenantId} && status:=active`,
        per_page: limit,
        ...EVERY_PREFIX,
      },
      {
        collection: CUSTOMERS_COLLECTION,
        q: input.q,
        query_by: 'full_name,email,company',
        filter_by: `tenant_id:=${input.tenantId}`,
        per_page: limit,
        ...EVERY_PREFIX,
      },
      {
        collection: ORDERS_COLLECTION,
        q: input.q,
        // The account's name too, so typing it lists the account's orders as
        // well as the account and its people. Only once the collection has it.
        query_by: ordersByCompany
          ? 'order_number,customer_name,customer_email,company'
          : 'order_number,customer_name,customer_email',
        filter_by: `tenant_id:=${input.tenantId}`,
        per_page: limit,
        ...EVERY_PREFIX,
      },
    ],
  })) as unknown as { results: { hits?: unknown[]; found?: number }[] };
  const [productsRes, customersRes, ordersRes] = result.results;
  return {
    products: (productsRes?.hits ?? []) as unknown as SearchHit<ProductSearchDocument>[],
    customers: (customersRes?.hits ?? []) as unknown as SearchHit<CustomerSearchDocument>[],
    orders: (ordersRes?.hits ?? []) as unknown as SearchHit<OrderSearchDocument>[],
    found: {
      products: productsRes?.found ?? 0,
      customers: customersRes?.found ?? 0,
      orders: ordersRes?.found ?? 0,
    },
  };
}

// ─── Universal search (docs/39) — the `entities` collection ───────────

export interface UniversalSearchInput {
  tenantId: string;
  q?: string;
  /** Restrict to these modules — pass the tenant's ENABLED set so a disabled
   *  module's stale docs never surface (the route enforces this). */
  modules?: string[];
  /** Restrict to one or more entity types (e.g. a single list page). */
  entityTypes?: string[];
  /** Restrict to these statuses — e.g. ['active','published'] so a public
   *  storefront search never surfaces draft/archived records. */
  statuses?: string[];
  page?: number;
  perPage?: number;
}

/** `[`a`,`b`]` — Typesense exact-match list syntax, backtick-quoted so values
 *  with separators don't break the filter grammar. */
function facetList(values: string[]): string {
  return `[${values.map((v) => `\`${v}\``).join(',')}]`;
}

export async function searchAll(
  input: UniversalSearchInput
): Promise<SearchResult<UniversalSearchDocument>> {
  const parts: (string | null)[] = [`tenant_id:=${input.tenantId}`];
  if (input.modules?.length) parts.push(`module:=${facetList(input.modules)}`);
  if (input.entityTypes?.length) parts.push(`entity_type:=${facetList(input.entityTypes)}`);
  if (input.statuses?.length) parts.push(`status:=${facetList(input.statuses)}`);
  const params: AnySearchParams = {
    q: input.q && input.q.length > 0 ? input.q : '*',
    query_by: 'title,keywords,subtitle,body',
    query_by_weights: '5,4,3,1',
    filter_by: joinFilter(parts),
    facet_by: 'module,entity_type,status',
    sort_by: '_text_match:desc,updated_at:desc',
    page: input.page ?? 1,
    per_page: input.perPage ?? 20,
    ...EVERY_PREFIX,
  };
  const result = await getClient().collections(ENTITIES_COLLECTION).documents().search(params);
  return shape<UniversalSearchDocument>(result, params);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function shape<T>(raw: unknown, params: AnySearchParams): SearchResult<T> {
  const result = raw as {
    found?: number;
    hits?: { document: T; highlights?: unknown; text_match?: number }[];
    facet_counts?: {
      field_name: string;
      counts: { value: string; count: number }[];
    }[];
  };
  return {
    found: result.found ?? 0,
    page: params.page ?? 1,
    perPage: params.per_page ?? 24,
    hits: (result.hits ?? []).map((h) => ({
      document: h.document,
      highlights: h.highlights as Record<string, { snippet?: string }>,
      textMatch: h.text_match,
    })),
    facetCounts: (result.facet_counts ?? []).map((f) => ({
      fieldName: f.field_name,
      counts: f.counts,
    })),
  };
}
