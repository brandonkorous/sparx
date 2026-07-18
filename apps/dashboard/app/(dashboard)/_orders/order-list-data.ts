import { api } from '@/lib/api-rest-client';
import { resolvePropertyFilter, type SiteScope } from '@/lib/sites';

import type { OrderRow } from './components/orders-selection-table';
import type { OrderLens } from './lens';

// Data layer for the shared order list. Kept apart from order-list.tsx so the
// render path stays declarative and the two fetch strategies (Typesense search
// vs. Postgres browse) sit side by side where their differences are visible.

/** The customer shape the list query joins in — mirrors the `select` in
 *  @sparx/crm's order-service list(). */
interface OrderCustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  b2bAccountId: string | null;
  b2bAccount: { id: string; companyName: string; paymentTerms: string | null } | null;
}

interface OrderApiRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: string | number;
  amountPaid: string | number;
  placedAt: string | null;
  channel: string | null;
  source: string | null;
  customer?: OrderCustomerLite | null;
}

// Typesense order search document (the subset this list needs). Returned by
// /v1/search/orders — typo-tolerant across order number + customer + items.
interface OrderSearchDoc {
  order_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  currency: string;
  total_cents: number;
  placed_at: number; // epoch seconds
  channel?: string;
  customer_name?: string;
}

/** A person's display name, falling back through company → email → short id so
 *  a row never renders blank. */
function customerName(c: OrderCustomerLite | null | undefined): string | null {
  if (!c) return null;
  // `person` is '' when the customer has no name at all — an empty string, not
  // null, so it has to be tested explicitly rather than folded into the ??
  // chain below (?? only falls through on null/undefined and would return '').
  const person = [c.firstName, c.lastName].filter(Boolean).join(' ');
  if (person !== '') return person;
  return c.company ?? c.email ?? c.id.slice(0, 8);
}

export interface OrderListFilters {
  status?: string;
  paymentStatus?: string;
  channel?: string;
  account?: string;
  q?: string;
  site?: string;
}

export interface OrderListResult {
  orders: OrderRow[];
  total: number;
}

/**
 * Load one page of orders for a lens.
 *
 * With a query, search via Typesense (typo-tolerant, matches order number +
 * customer name/email + item titles); without one, list straight from Postgres
 * with the status/payment facets. `amountPaid` isn't indexed, so search rows
 * show — for Paid and Balance; the detail view has the full picture.
 *
 * The lens's `scope` is applied to BOTH paths, so a scoped lens (B2B) can never
 * leak an out-of-scope order in through search.
 */
export async function loadOrders(
  lens: OrderLens,
  filters: OrderListFilters,
  scope: SiteScope,
  page: { page: number; perPage: number; skip: number; take: number }
): Promise<OrderListResult> {
  const propertyFilter = resolvePropertyFilter(scope, filters.site);

  if (filters.q) {
    // Search via Typesense, scoped to the active site (docs/58 D1) via the
    // orders `property_id` facet — same selection as the browse list below.
    const sq = new URLSearchParams({
      q: filters.q,
      page: String(page.page),
      per_page: String(page.perPage),
    });
    if (propertyFilter) sq.set('property', propertyFilter);
    for (const [key, value] of Object.entries(lens.scope ?? {})) sq.set(key, value);

    const { data, meta } = await api.getPaged<OrderSearchDoc[]>(
      `/v1/search/orders?${sq.toString()}`
    );
    const orders = data.map<OrderRow>((d) => ({
      id: d.order_id,
      orderNumber: d.order_number,
      status: d.status,
      paymentStatus: d.payment_status,
      currency: d.currency,
      total: d.total_cents / 100,
      amountPaid: Number.NaN, // not indexed — rendered as —
      placedAt: new Date(d.placed_at * 1000).toISOString(),
      channel: d.channel ?? null,
      // The marketplace source isn't indexed in Typesense — the browse list
      // below carries it; search rows badge by channel only.
      source: null,
      customerName: d.customer_name ?? null,
      // Not indexed. The B2B lens is already account-scoped server-side, so an
      // empty Account cell here is a display gap, not a correctness one.
      accountName: null,
    }));
    return { orders, total: (meta?.total as number | undefined) ?? orders.length };
  }

  const query = new URLSearchParams({
    take: String(page.take),
    skip: String(page.skip),
    sort_by: 'placedAt',
  });
  if (filters.status) query.set('status', filters.status);
  if (filters.paymentStatus) query.set('payment_status', filters.paymentStatus);
  if (filters.channel) query.set('channel', filters.channel);
  if (filters.account) query.set('b2b_account_id', filters.account);
  if (propertyFilter) query.set('property', propertyFilter);
  for (const [key, value] of Object.entries(lens.scope ?? {})) query.set(key, value);

  const res = await api.getPaged<OrderApiRow[]>(`/v1/orders?${query.toString()}`);
  const orders = res.data.map<OrderRow>((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    currency: o.currency,
    total: o.total,
    amountPaid: o.amountPaid,
    placedAt: o.placedAt,
    channel: o.channel,
    source: o.source,
    customerName: customerName(o.customer),
    accountName: o.customer?.b2bAccount?.companyName ?? null,
  }));
  return { orders, total: (res.meta?.total as number | undefined) ?? orders.length };
}

interface B2bAccountLite {
  id: string;
  companyName: string;
}

/** Options for the B2B lens's Account filter. Only fetched for a lens that
 *  actually surfaces that filter — the other two never pay for this call.
 *
 *  The endpoint lives in the /v1/crm namespace but is gated on CRM **or** B2B,
 *  so a B2B tenant without CRM still gets their accounts. It takes no sort
 *  param; the list is ordered server-side. */
export async function loadAccountOptions(): Promise<{ value: string; label: string }[]> {
  const accounts = await api
    .getPaged<B2bAccountLite[]>('/v1/crm/b2b-accounts?take=200')
    .then((r) => r.data)
    .catch(() => []);
  return accounts
    .map((a) => ({ value: a.id, label: a.companyName }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
