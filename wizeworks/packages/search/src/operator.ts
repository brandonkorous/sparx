// Cross-tenant operator search (docs/apps/admin/build-plan.md §5 Slice 6). The
// per-tenant search wrappers in search.ts hard-scope every query to one
// `tenant_id`; the WizeWorks operator console needs the opposite — a lookup that
// spans EVERY tenant (find an order by number, a customer by email, without
// knowing which tenant owns it). Postgres can't do this (orders/customers are
// FORCE-RLS and `order_number`/`email` are unique per-tenant, not globally), but
// Typesense already holds every tenant's docs in one collection with a `tenant_id`
// field, so an UNFILTERED search is the natural cross-tenant seam. Each hit carries
// its `tenant_id`; the operator route resolves that to a tenant name.
//
// SERVER-ONLY. This uses the admin Typesense client (no tenant filter), so it must
// never be reachable from a browser — it is called exclusively by api-rest's
// capability-gated /internal/operator/* handlers.

import { getClient } from './client';
import {
  CUSTOMERS_COLLECTION,
  type CustomerSearchDocument,
  ORDERS_COLLECTION,
  type OrderSearchDocument,
} from './schemas';

export interface CrossTenantSearchResult<T> {
  hits: T[];
  /** Total matches across all tenants (for "showing N of M"). */
  found: number;
  page: number;
  perPage: number;
}

export interface CrossTenantSearchInput {
  /** The lookup term — an order number, customer email, name, etc. Required:
   *  this is a targeted lookup, never an unfiltered cross-tenant dump. */
  q: string;
  page?: number;
  perPage?: number;
}

interface RawSearch<T> {
  found?: number;
  hits?: { document: T }[];
}

async function runCrossTenant<T>(
  collection: string,
  input: CrossTenantSearchInput,
  queryBy: string,
  queryByWeights: string,
  sortBy: string
): Promise<CrossTenantSearchResult<T>> {
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 20;
  // No `filter_by` → the search spans every tenant's documents. Each hit still
  // carries its own `tenant_id` for the operator to attribute the result.
  const raw = (await getClient().collections(collection).documents().search({
    q: input.q,
    query_by: queryBy,
    query_by_weights: queryByWeights,
    sort_by: sortBy,
    page,
    per_page: perPage,
  })) as RawSearch<T>;
  return {
    hits: (raw.hits ?? []).map((h) => h.document),
    found: raw.found ?? 0,
    page,
    perPage,
  };
}

/** Find orders across ALL tenants by order number, customer name/email, or SKU.
 *  `order_number` is an infix field, so a partial number matches. */
export async function searchOrdersCrossTenant(
  input: CrossTenantSearchInput
): Promise<CrossTenantSearchResult<OrderSearchDocument>> {
  return runCrossTenant<OrderSearchDocument>(
    ORDERS_COLLECTION,
    input,
    'order_number,customer_name,customer_email,item_skus',
    '5,3,3,2',
    '_text_match:desc,placed_at:desc'
  );
}

/** Find customers across ALL tenants by name, email, company, or phone.
 *  `email` is an infix field, so a partial address matches. */
export async function searchCustomersCrossTenant(
  input: CrossTenantSearchInput
): Promise<CrossTenantSearchResult<CustomerSearchDocument>> {
  return runCrossTenant<CustomerSearchDocument>(
    CUSTOMERS_COLLECTION,
    input,
    'full_name,email,company,phone',
    '4,3,3,2',
    '_text_match:desc,total_spent_cents:desc'
  );
}
