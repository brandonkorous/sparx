'use server';

// ⌘K deep-search server action. Queries, on behalf of the signed-in staff
// session, BOTH the rich collections (products/customers/orders via the
// multi-collection palette) AND the universal `entities` collection (docs/39 —
// everything else: warehouses, discounts, gift cards, B2B accounts, quotes, …)
// in parallel, shaped for the command palette. Read-only; each source degrades
// to empty independently so one outage / disabled module never blanks the
// palette's nav/favorites/recents.

import { api } from '@/lib/api-rest-client';

import { resolveTenantOrderLens } from '../_orders/resolve-lens';

export interface PaletteHit {
  id: string;
  /** Detail-route href the palette navigates to on select. */
  href: string;
  /** Primary line (product title / customer name / order number / entity title). */
  label: string;
  /** Secondary line (vendor / email / customer name / entity type). */
  sublabel?: string;
}

export interface PaletteResults {
  products: PaletteHit[];
  customers: PaletteHit[];
  orders: PaletteHit[];
  /** Universal-collection hits (everything outside the three rich collections). */
  other: PaletteHit[];
}

interface ProductDoc {
  product_id: string;
  title: string;
  vendor?: string;
}
interface CustomerDoc {
  customer_id: string;
  full_name: string;
  email?: string;
  company?: string;
}
interface OrderDoc {
  order_id: string;
  order_number: string;
  customer_name?: string;
}

interface PaletteResponse {
  products: ProductDoc[];
  customers: CustomerDoc[];
  orders: OrderDoc[];
}

interface UniversalDoc {
  entity_type: string;
  module: string;
  record_id: string;
  title: string;
  subtitle?: string;
  url?: string;
}

const EMPTY: PaletteResults = { products: [], customers: [], orders: [], other: [] };

/** 'b2b_account' → 'B2b Account' — a human label when a doc has no subtitle. */
function humanizeType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchRich(enc: string): Promise<Omit<PaletteResults, 'other'>> {
  try {
    // Global search is module-agnostic, so an order hit has no route to infer
    // from — resolve which of the three order surfaces this tenant actually has
    // (Commerce > B2B > CRM) rather than hardcoding one and dead-ending a
    // tenant who doesn't hold that module.
    const [res, orderLens] = await Promise.all([
      api.get<PaletteResponse>(`/v1/search?q=${enc}&limit=5`),
      resolveTenantOrderLens(),
    ]);
    return {
      products: res.products.map((p) => ({
        id: p.product_id,
        href: `/commerce/products/${p.product_id}`,
        label: p.title,
        sublabel: p.vendor,
      })),
      customers: res.customers.map((c) => ({
        id: c.customer_id,
        href: `/crm/customers/${c.customer_id}`,
        label: c.full_name,
        sublabel: c.company ?? c.email,
      })),
      orders: res.orders.map((o) => ({
        id: o.order_id,
        href: `${orderLens.basePath}/${o.order_id}`,
        label: o.order_number,
        sublabel: o.customer_name,
      })),
    };
  } catch {
    return { products: [], customers: [], orders: [] };
  }
}

async function fetchUniversal(enc: string): Promise<PaletteHit[]> {
  try {
    const { data } = await api.getPaged<UniversalDoc[]>(`/v1/search/all?q=${enc}&per_page=8`);
    return data.map((d) => ({
      id: `${d.entity_type}:${d.record_id}`,
      href: d.url ?? '#',
      label: d.title,
      sublabel: d.subtitle ?? humanizeType(d.entity_type),
    }));
  } catch {
    return [];
  }
}

export async function searchEntities(query: string): Promise<PaletteResults> {
  const q = query.trim();
  if (q.length === 0) return EMPTY;
  const enc = encodeURIComponent(q);
  const [rich, other] = await Promise.all([fetchRich(enc), fetchUniversal(enc)]);
  return { ...rich, other };
}
