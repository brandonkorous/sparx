'use client';

// Live record search — the data half of the ⌘K "Search everything" box.
//
// The static surface catalog (registry.ts) answers "which SCREEN do I want";
// this answers "which RECORD do I want" — an order, a customer, a product, a
// deal — by querying the platform's Typesense index through api-rest.
//
// Two backends, because no single collection holds everything:
//   • /v1/search/all  — the universal `entities` collection: products plus ~19
//     other types (collections, discounts, deals, tasks, warehouses, CMS…),
//     already gated to the tenant's ENABLED modules server-side.
//   • /v1/search      — the rich-collection palette. The ONLY home of customers
//     and orders, which never project into `entities`.
// Products come from the universal side, so only customers + orders are lifted
// from the palette — taking products from both would list each one twice.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@wizeworks/query';
import { api } from './client';

/** A normalized hit, uniform across both backends — what the palette renders. */
export interface RecordHit {
  /** `${entityType}:${recordId}` — React key + dedup identity. */
  key: string;
  entityType: string;
  recordId: string;
  /** Primary label (product title, customer name, order number). */
  title: string;
  /** Secondary line (email, status, owner) — shown, never faded out. */
  subtitle?: string;
}

/** Shape of a /v1/search/all row (the universal `entities` document). */
interface UniversalDoc {
  entity_type: string;
  record_id: string;
  title: string;
  subtitle?: string;
}

/** The two rich-collection rows we lift from /v1/search. */
interface CustomerDoc {
  customer_id: string;
  full_name: string;
  email: string;
  company?: string;
}
interface OrderDoc {
  order_id: string;
  order_number: string;
  customer_name?: string;
  status: string;
}
interface PaletteResult {
  products: unknown[];
  customers: CustomerDoc[];
  orders: OrderDoc[];
}

/**
 * Debounces a fast-changing value so a burst of keystrokes fires one request,
 * not one per character. Surface filtering stays on the live value (it's local
 * and instant); only the network reads wait on this.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export interface RecordSearchResult {
  hits: RecordHit[];
  isLoading: boolean;
}

/**
 * Live record search across every module. Fetches nothing until the query is at
 * least two characters — a one-letter query matches half the index and isn't a
 * search anyone means. `hits` is memoized on the two responses so it keeps a
 * stable reference between renders, which lets the palette memoize on it.
 */
export function useRecordSearch(query: string): RecordSearchResult {
  const q = query.trim();
  const enabled = q.length >= 2;

  const universal = useQuery({
    queryKey: ['search', 'all', q],
    queryFn: () => api.get<UniversalDoc[]>('/v1/search/all', { q, per_page: 24 }),
    enabled,
    staleTime: 30_000,
  });

  const palette = useQuery({
    queryKey: ['search', 'palette', q],
    queryFn: () => api.get<PaletteResult>('/v1/search', { q, limit: 8 }),
    enabled,
    staleTime: 30_000,
  });

  const hits = useMemo<RecordHit[]>(() => {
    if (!enabled) return [];
    const out: RecordHit[] = [];

    for (const doc of universal.data ?? []) {
      out.push({
        key: `${doc.entity_type}:${doc.record_id}`,
        entityType: doc.entity_type,
        recordId: doc.record_id,
        title: doc.title,
        subtitle: doc.subtitle,
      });
    }

    const data = palette.data;
    if (data) {
      for (const c of data.customers ?? []) {
        const hasName = c.full_name.trim().length > 0;
        out.push({
          key: `customer:${c.customer_id}`,
          entityType: 'customer',
          recordId: c.customer_id,
          title: hasName ? c.full_name : c.email,
          // Company if we have one; otherwise the email — but only as a SECOND
          // line, never repeating the email already shown as the title.
          subtitle: c.company?.trim() ? c.company : hasName ? c.email : undefined,
        });
      }
      for (const o of data.orders ?? []) {
        const line = [o.customer_name, o.status].filter(Boolean).join(' · ');
        out.push({
          key: `order:${o.order_id}`,
          entityType: 'order',
          recordId: o.order_id,
          title: `#${o.order_number}`,
          subtitle: line.length > 0 ? line : undefined,
        });
      }
    }

    return out;
  }, [enabled, universal.data, palette.data]);

  return { hits, isLoading: enabled && (universal.isFetching || palette.isFetching) };
}
