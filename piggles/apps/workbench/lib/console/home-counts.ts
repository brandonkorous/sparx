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
    // `unread`, NOT `status: 'open'`. Open is a stored word meaning "not yet
    // resolved", and a conversation you answered an hour ago is open because
    // the CUSTOMER has not come back — nothing is waiting on you. The badge
    // read 1 over a thread that had already been replied to, which is the same
    // mistake this file's header records for invoices: a filter that names a
    // stored word rather than the question being asked.
    query: { unread: true, take: 1, skip: 0 },
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
  // Somebody filled in a form on the website and nobody has opened it.
  //
  // The oldest "a stranger is waiting" channel there is, and the only one with
  // no count: orders, chat, bookings, invoices, stock and both social queues all
  // had one. An owner running seven sites had two people asking about sizing
  // seventeen days after they asked, marked New, with nothing anywhere saying so
  // (issue 629).
  //
  // The endpoint already answers `counts.new` beside every window it serves, so
  // `limit: 1` asks for the number and one row rather than the inbox.
  formReplies: {
    key: 'formReplies',
    module: 'builder',
    path: '/v1/forms/submissions',
    query: { status: 'new', limit: 1 },
    read: (data) => {
      const counts = (data as { counts?: { new?: unknown } }).counts;
      return typeof counts?.new === 'number' ? counts.new : undefined;
    },
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

/**
 * The SCREEN each count is about — the nav row that owns it.
 *
 * More than one count may name the same screen: Stock owns both "running low"
 * and "sold out". The rail sums them, which is only honest because the two
 * measurements are disjoint by construction — see `stock`'s `sellable_only`.
 *
 * Declared beside the count itself, because the count and the screen it
 * describes are one fact. The rail badges a screen from this, then sums the
 * screens into the app and the apps into the group, so all three levels are
 * derived from one line rather than declared three times
 * (components/rail/waiting.tsx).
 *
 * Home's sentence opens THIS screen too, narrowed to the count (`SIGNALS` in
 * surfaces/home/signals.ts). It used to be a separate judgement, and "3
 * bookings need confirming" opened the week's calendar, where a request for
 * next month was not on screen and nothing picked the three out from the rest.
 * Here rather than in home-data so the pairing can be tested.
 */
export const COUNT_SURFACE: Record<AttentionKey, string> = {
  orders: 'commerce.orders.list',
  bookings: 'scheduling.bookings.list',
  messages: 'chat.inbox',
  invoices: 'invoicing.invoices.list',
  formReplies: 'builder.forms',
  stock: 'inventory.stock.list',
  outOfStock: 'inventory.stock.list',
  social: 'social.inbox',
  approvals: 'social.approvals',
};
