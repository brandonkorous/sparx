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
import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from './client';
import { orderStatusWords } from '../../surfaces/commerce/orders-list-filters';

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
  /** The trade account the order belongs to. Absent from an index built before
   *  the field existed, so it is optional. */
  company?: string;
  status: string;
}
interface PaletteResult {
  products: unknown[];
  customers: CustomerDoc[];
  orders: OrderDoc[];
  /** How many matched in each collection, of which only `limit` came back.
   *  Optional: an api-rest older than this field does not send it, and an
   *  unknown count must read as unknown, never as zero. */
  found?: { products: number; customers: number; orders: number };
}

/**
 * How many rows each step of "Show more" asks for, and the most either backend
 * will hand over. The first step is what the box always asked for.
 *
 * Both backends CAP what they return, and the box used to count only what came
 * back: "12 records matched" was the number of rows it had been handed, and a
 * name matching forty things said twelve with nothing to say there were more.
 * [[feedback_never_present_absence_as_measurement]]
 */
const STEP = { all: 24, palette: 8 } as const;
const MOST = { all: 250, palette: 100 } as const;

/** How many matched beyond what came back, or null when the server did not say. */
function heldBack(returned: number, total: number | undefined): number | null {
  return typeof total === 'number' ? Math.max(0, total - returned) : null;
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
  /** How many more records matched than came back. 0 is "this is all of them";
   *  null is "nothing said", which must never be read as all of them. */
  more: number | null;
  /** Whether asking for more can bring any back. False once both backends are
   *  at their most, so the box can say "narrow it down" instead. */
  canShowMore: boolean;
  /** A backend did not answer and nothing came back from it. Empty hits then
   *  are not "nothing matched", and the box must not say they are. */
  failed: boolean;
  /** Ask both backends again. */
  retry: () => void;
}

/**
 * Live record search across every module. Fetches nothing until the query is at
 * least two characters — a one-letter query matches half the index and isn't a
 * search anyone means. `hits` is memoized on the two responses so it keeps a
 * stable reference between renders, which lets the palette memoize on it.
 */
export function useRecordSearch(query: string, pages = 1): RecordSearchResult {
  const q = query.trim();
  const enabled = q.length >= 2;
  const step = Math.max(1, Math.floor(pages));
  const perPage = Math.min(STEP.all * step, MOST.all);
  const limit = Math.min(STEP.palette * step, MOST.palette);

  // "Show more" keeps what is already on screen while the longer page loads, so
  // the list grows under the reader instead of emptying and refilling. Only for
  // the SAME words: a new query must not show the last query's records.
  const sameWords = (key: readonly unknown[] | undefined) => key?.[2] === q;

  const universal = useQuery({
    queryKey: ['search', 'all', q, perPage],
    queryFn: () => api.list<UniversalDoc>('/v1/search/all', { q, per_page: perPage }),
    enabled,
    staleTime: 30_000,
    placeholderData: (previous, previousQuery) =>
      sameWords(previousQuery?.queryKey) ? previous : undefined,
  });

  const palette = useQuery({
    queryKey: ['search', 'palette', q, limit],
    queryFn: () => api.get<PaletteResult>('/v1/search', { q, limit }),
    enabled,
    staleTime: 30_000,
    placeholderData: (previous, previousQuery) =>
      sameWords(previousQuery?.queryKey) ? previous : undefined,
  });

  const hits = useMemo<RecordHit[]>(() => {
    if (!enabled) return [];
    const out: RecordHit[] = [];

    for (const doc of universal.data?.items ?? []) {
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
        // Who bought it, which account it belongs to, and the list's own word
        // for where it is. The account is what matched when somebody typed its
        // name, so the row has to show it or it reads as a stranger's order.
        const line = [
          o.customer_name,
          o.company?.trim() ? o.company : null,
          o.status ? orderStatusWords(o.status) : null,
        ]
          .filter(Boolean)
          .join(' · ');
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

  // What each backend matched beyond what it handed back. Products are left out
  // of the palette's share on purpose: they come from the universal side, and the
  // palette's product rows are never shown, so they hide nothing.
  const allMore = heldBack(universal.data?.items.length ?? 0, universal.data?.total);
  const found = palette.data?.found;
  const customersMore = heldBack(palette.data?.customers.length ?? 0, found?.customers);
  const ordersMore = heldBack(palette.data?.orders.length ?? 0, found?.orders);
  const known = [allMore, customersMore, ordersMore].filter((n): n is number => n !== null);
  const more = !enabled || known.length === 0 ? null : known.reduce((sum, n) => sum + n, 0);
  const canShowMore =
    ((allMore ?? 0) > 0 && perPage < MOST.all) ||
    ((customersMore ?? 0) + (ordersMore ?? 0) > 0 && limit < MOST.palette);

  // A backend that failed hands back no rows, which looked exactly like no
  // rows matching. MEASURED 2026-10-06 on Gillett, with the API restarting:
  // "O-0000" said "Nothing matches that. Try a different word." and "Nothing in
  // your records matches" over fifteen orders that do.
  // [[feedback_never_present_absence_as_measurement]]
  const failed =
    enabled && ((universal.isError && !universal.data) || (palette.isError && !palette.data));

  return {
    hits,
    isLoading: enabled && (universal.isFetching || palette.isFetching),
    more,
    canShowMore,
    failed,
    retry: () => {
      void universal.refetch();
      void palette.refetch();
    },
  };
}

/* ── How much of the business this box can actually SEE ──────────────── */

export interface SearchCollectionStat {
  collection: string;
  documents: number;
}

export interface SearchStatus {
  collections: SearchCollectionStat[];
  /** Products on sale that searching cannot find. `null` means the check could
   *  not run — say nothing, never render it as none. */
  productsMissing: number | null;
  /** The same reading for the other two things this box promises to find.
   *  Customers and orders live ONLY in the palette's own collections, so
   *  nothing else on the platform was in a position to notice them missing.
   *  MEASURED 2026-09-18 on Juniper Row: 36 of 36 customers and 16 of 16
   *  orders, under an empty state reading "Nothing in your records matches". */
  customersMissing: number | null;
  ordersMissing: number | null;
}

/** The one cache entry every reader of `/v1/search/status` shares. */
const SEARCH_STATUS_KEY = ['search', 'status'] as const;

export function useSearchStatus(options: { watch?: boolean } = {}) {
  const query = useQuery({
    queryKey: SEARCH_STATUS_KEY,
    queryFn: () => api.get<SearchStatus>('/v1/search/status'),
    // A search-side hiccup must never take the products list down with it.
    retry: false,
    staleTime: 60_000,
  });

  // Asked again each time the screen holding it OPENS, if the answer is over a
  // minute old. The search box is mounted for the whole session and only opened
  // and closed, so `staleTime` alone never re-asked: the answer from page load
  // was still the answer an hour later. A buyer who signed up after it was not
  // counted as missing, and the box told the owner "Nothing in your records
  // matches" about him with no offer to put him back (sparx persona issue 086).
  const queryClient = useQueryClient();
  const opened = options.watch === true;
  useEffect(() => {
    if (!opened) return;
    void queryClient.refetchQueries({ queryKey: SEARCH_STATUS_KEY, stale: true });
  }, [opened, queryClient]);

  // `watch` is for the one screen holding this open while it CHANGES: a rebuild
  // is accepted in milliseconds and finishes seconds later, so invalidating on
  // the mutation's success re-reads a number that has not moved yet. Without
  // this the warning sat there after the fix had already worked, which reads as
  // the button having done nothing — and the obvious response to that is to
  // press it again.
  //
  // Only while there is something to watch, and only while the screen asking is
  // in front of somebody. Closed, or once the gap is gone, it is off.
  const missing =
    (query.data?.productsMissing ?? 0) +
    (query.data?.customersMissing ?? 0) +
    (query.data?.ordersMissing ?? 0);
  const shouldWatch = options.watch === true && missing > 0;
  // Pulled out of the query object: `refetch` is stable for a given key, so the
  // timer is set up once. Depending on `query` itself would tear it down and
  // rebuild it on every render.
  const { refetch } = query;
  useEffect(() => {
    if (!shouldWatch) return undefined;
    const id = setInterval(() => {
      void refetch();
    }, 8_000);
    return () => {
      clearInterval(id);
    };
  }, [shouldWatch, refetch]);

  return query;
}

/** How many of her products are on sale but cannot be found by searching, or
 *  null when nothing measured it. Distinct from a document COUNT: twelve
 *  documents look exactly like sixteen until something knows there should be
 *  sixteen, which is why the count alone left four of Devi's products silently
 *  unfindable (issue 318). */
export function unfindableProductCount(data: SearchStatus | undefined): number | null {
  return data?.productsMissing ?? null;
}

/** How many PRODUCT documents this business has in search, or null when the
 *  answer could not be fetched \u2014 which is not the same as zero and must not
 *  render as one. */
export function indexedProductCount(
  data: { collections: SearchCollectionStat[] } | undefined
): number | null {
  if (!data) return null;
  const row = data.collections.find((c) => c.collection.includes('product'));
  return row ? row.documents : null;
}

/** Rebuild this business's search index from its real records. The work happens
 *  on a worker, so this returns as soon as the request is accepted \u2014 the copy
 *  has to say "started", never "done". */
export function useReindexSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { running: 'start rebuilding your search' },
    mutationFn: () => api.post<{ runId: string }>('/v1/search/reindex'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search', 'status'] });
    },
  });
}
