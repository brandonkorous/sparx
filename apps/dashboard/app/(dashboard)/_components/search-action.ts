'use server';

// ⌘K deep-search server action. Calls api-rest's multi-collection palette
// endpoint (Typesense) on behalf of the signed-in staff session, returning the
// top hits per collection shaped for the command palette. Read-only; failures
// degrade to empty groups so the palette's nav/favorites/recents still work.

import { api } from '@/lib/api-rest-client';

export interface PaletteHit {
  id: string;
  /** Detail-route href the palette navigates to on select. */
  href: string;
  /** Primary line (product title / customer name / order number). */
  label: string;
  /** Secondary line (vendor / email / customer name). */
  sublabel?: string;
}

export interface PaletteResults {
  products: PaletteHit[];
  customers: PaletteHit[];
  orders: PaletteHit[];
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

const EMPTY: PaletteResults = { products: [], customers: [], orders: [] };

export async function searchEntities(query: string): Promise<PaletteResults> {
  const q = query.trim();
  if (q.length === 0) return EMPTY;
  try {
    const res = await api.get<PaletteResponse>(`/v1/search?q=${encodeURIComponent(q)}&limit=5`);
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
        href: `/crm/orders/${o.order_id}`,
        label: o.order_number,
        sublabel: o.customer_name,
      })),
    };
  } catch {
    // Module disabled, Typesense down, etc. — deep search just yields nothing.
    return EMPTY;
  }
}
