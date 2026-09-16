'use client';

// WHAT IS WAITING FOR A PERSON, as a list of queries.
//
// Split out of `home-data` so it can be TESTED. The rest of that file is React
// — `useQuery`, `useReachableModules` — and the console's test seat runs plain
// Node with no path aliases, so nothing importing those can be reached by a
// test. That is not a technicality: the half worth guarding here is the FILTERS,
// and every value in them is a string or a boolean handed to a query string, so
// all of them compile and any of them can be wrong.
//
// One was. The invoices count asked `status=overdue` — a stored word nothing
// rewrites when a date passes — so Home told a shop owed $986.50 across eight
// late invoices that "nothing is overdue" (issues 522, 530).
//
// Which counts appear as HOME TILES is a separate, smaller list (`SIGNALS` in
// surfaces/home/signals.ts), because a tile needs a written sentence.

export interface Source {
  key: string;
  /** The module that must be on for this to mean anything. */
  module: string;
  path: string;
  query: Record<string, string | number | boolean>;
  /**
   * For an endpoint that answers with its OWN shape rather than a paged list.
   *
   * Most of these read `total` off `api.list`. Social's two do not — the inbox
   * reports `{ open }` and approvals returns the posts themselves — and that is
   * the only reason they used to live outside this file, badging their own nav
   * row through `useBadgeCount` and therefore never reaching the rail. Returning
   * `undefined` here means UNKNOWN, never zero.
   */
  read?: (data: unknown) => number | undefined;
}

export const SOURCES = {
  orders: {
    key: 'orders',
    module: 'commerce',
    path: '/v1/orders',
    query: { status: 'placed', take: 1, skip: 0 },
  },
  bookings: {
    key: 'bookings',
    module: 'scheduling',
    path: '/v1/scheduling/bookings',
    query: { status: 'requested', take: 1, skip: 0 },
  },
  messages: {
    key: 'messages',
    module: 'chat',
    path: '/v1/chat/conversations',
    query: { status: 'open', take: 1, skip: 0 },
  },
  invoices: {
    key: 'invoices',
    module: 'invoicing',
    path: '/v1/invoicing/documents',
    // `pastDue`, NOT `status: 'overdue'`. The status column is written when
    // something is DONE to a document, and a due date passing is nobody doing
    // anything, so it goes on saying `unpaid` for ever (issue 522). Asking it
    // here made the one screen that exists to say "what needs you today" answer
    // "nothing is overdue" to a shop owed $986.50 across eight late invoices —
    // while the invoices list two panes over said "Late $986.50 · 8 invoices"
    // and Finance said the same. A silent queue is bad; a confident wrong "all
    // clear" on the first screen of the morning is worse.
    query: { pastDue: true, take: 1, skip: 0 },
  },
  stock: {
    key: 'stock',
    module: 'inventory',
    path: '/v1/inventory',
    // `sellable_only` keeps this disjoint from `outOfStock` below, so a level
    // that is both never lands in two counts the rail adds together. It is also
    // what the stock list badges "Running low" — a level at zero reads "None to
    // sell" there, never "Running low".
    query: { low_stock_only: true, sellable_only: true, take: 1, skip: 0 },
  },
  // Sizes a customer cannot buy at all. Its own count, not a stricter `stock`:
  // low needs a reorder point somebody set, out needs nothing, and an account
  // with no reorder points scores zero on low for ever while its shop shows
  // "sold out". Home said "nothing is running low" over a struck-through size.
  outOfStock: {
    key: 'outOfStock',
    module: 'inventory',
    path: '/v1/inventory',
    query: { out_of_stock_only: true, take: 1, skip: 0 },
  },
  // Somebody asked a question on a social account and nobody has answered.
  social: {
    key: 'social',
    module: 'social',
    path: '/v1/social/inbox/count',
    query: {},
    read: (data) => {
      const open = (data as { open?: unknown }).open;
      return typeof open === 'number' ? open : undefined;
    },
  },
  // Posts parked by a teammate or an automation, waiting on an admin.
  approvals: {
    key: 'approvals',
    module: 'social',
    path: '/v1/social/posts',
    query: { status: 'pending_approval' },
    read: (data) => {
      const posts = (data as { posts?: unknown }).posts;
      return Array.isArray(posts) ? posts.length : undefined;
    },
  },
  // `satisfies`, not a Record annotation: this keeps the KEYS literal, so
  // AttentionKey is the five real names and a typo in the surface is a compile
  // error rather than an `undefined` lookup at runtime.
} satisfies Record<string, Source>;

export type AttentionKey = keyof typeof SOURCES;
