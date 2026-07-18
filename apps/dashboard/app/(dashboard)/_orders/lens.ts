// Order lenses — the per-module configuration of the ONE shared order surface.
//
// Orders are a shared spine (see services/api-rest/src/lib/order-context.ts):
// Commerce checkout and B2B PO checkout both produce one, CRM reads it as
// customer history. Commerce, B2B, and CRM are three SEPARATELY BILLED modules,
// so no one of them owns the record — and a tenant paying for any one of them
// must be able to work their own orders.
//
// That's why there are three page routes (/commerce/orders, /b2b/orders,
// /crm/orders) over one API root (/v1/orders). Each route is a genuinely
// different view — its own scope, columns, filters, and panels — because the
// jobs differ: Commerce is fulfilling, B2B is collecting against terms, CRM is
// reading account history. What they are NOT is three codebases: every route
// composes the same components from this directory and varies only through the
// lens below. Add a capability once, configure it three ways.
//
// Adding a lens? Set `basePath` to a route that actually exists, and make sure
// the module owning that path lists Orders in its manifest — the shell resolves
// a page's nav owner by matching manifest section hrefs.

import type { LucideIcon } from 'lucide-react';
import { Building2, Receipt, ShoppingCart } from 'lucide-react';

/** Which module's hue + entitlement a given order surface wears. */
export type OrderModule = 'commerce' | 'b2b' | 'crm';

/** Columns the shared table knows how to render. The lens picks and orders
 *  them; the table owns the rendering so a column looks identical everywhere
 *  it appears. */
export type OrderColumnKey =
  | 'orderNumber'
  | 'customer'
  | 'account'
  | 'status'
  | 'paymentStatus'
  | 'total'
  | 'paid'
  | 'balance'
  | 'placedAt'
  | 'channel';

/** Detail panels the shared detail view knows how to render. Gating these by
 *  lens is what keeps a CRM-only tenant from seeing fulfillment/label chrome
 *  they have no entitlement to — the API enforces the same split. */
export type OrderPanelKey =
  | 'items'
  | 'payments'
  | 'refunds'
  | 'fulfillments'
  | 'labels'
  | 'terms'
  | 'customer';

export interface OrderLens {
  /** Module whose hue, entitlement, and nav own this surface. */
  module: OrderModule;
  /** Route prefix for this lens — every link the shared components emit is
   *  built from it, so a lens can never leak a link into another module. */
  basePath: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Extra query sent to /v1/orders on every request for this lens. This is
   *  what makes the B2B route a real scope rather than a cosmetic relabel. */
  scope?: Record<string, string>;
  columns: OrderColumnKey[];
  /** Filter keys surfaced in the toolbar, in order. */
  filters: ('status' | 'paymentStatus' | 'channel' | 'account')[];
  panels: OrderPanelKey[];
  /** Whether this surface can author a new order. */
  canCreate: boolean;
  emptyTitle: string;
  emptyDescription: string;
  /** Where this lens sends a click on the order's customer, if anywhere.
   *
   *  The customer record lives at /crm/customers, which is CRM-gated — so only
   *  a lens whose tenant is guaranteed to have CRM may link there. The other
   *  lenses render the name as plain text rather than shipping a link that
   *  dead-ends on a module upsell. */
  customerHref?: (customerId: string) => string;
}

// ── Commerce: the fulfillment desk ───────────────────────────────────────────
// The operator's job here is moving product: what's paid, what's unfulfilled,
// what channel it came from. Gets the full payment + fulfillment + label stack.
export const COMMERCE_ORDER_LENS: OrderLens = {
  module: 'commerce',
  basePath: '/commerce/orders',
  title: 'Orders',
  description:
    'Every order placed through your site, sales channels, or the admin — with payment, fulfillment, and shipping in one place.',
  icon: ShoppingCart,
  columns: [
    'orderNumber',
    'customer',
    'status',
    'paymentStatus',
    'total',
    'paid',
    'placedAt',
    'channel',
  ],
  filters: ['status', 'paymentStatus', 'channel'],
  panels: ['items', 'payments', 'refunds', 'fulfillments', 'labels', 'customer'],
  canCreate: true,
  emptyTitle: 'No orders match',
  emptyDescription:
    'Orders placed through your site, B2B portal, admin, or a connected sales channel appear here. Adjust the filters above, or place a new order manually.',
};

// ── B2B: the receivables desk ────────────────────────────────────────────────
// Scoped to orders from customers who belong to a B2B account. The job is
// collecting against terms, so the money columns lead (balance is the one that
// matters) and channel is dropped — it's noise when every row is an account.
export const B2B_ORDER_LENS: OrderLens = {
  module: 'b2b',
  basePath: '/b2b/orders',
  title: 'Orders',
  description:
    'Orders from your wholesale and fleet accounts — purchase orders, net terms, and outstanding balances.',
  icon: Building2,
  scope: { b2b_only: 'true' },
  columns: [
    'orderNumber',
    'account',
    'status',
    'paymentStatus',
    'total',
    'paid',
    'balance',
    'placedAt',
  ],
  filters: ['status', 'paymentStatus', 'account'],
  panels: ['items', 'payments', 'refunds', 'terms', 'fulfillments', 'customer'],
  canCreate: true,
  emptyTitle: 'No account orders match',
  emptyDescription:
    'Orders placed by customers who belong to a B2B account appear here — whether they came through the B2B portal or were entered by a rep. Adjust the filters above.',
};

// ── CRM: the account-history record ──────────────────────────────────────────
// Read-oriented. An order here is evidence about a relationship, not a job to
// work: who bought, how much, how often. No fulfillment or label machinery —
// a CRM-only tenant has no entitlement to it, and the API refuses it too.
export const CRM_ORDER_LENS: OrderLens = {
  module: 'crm',
  basePath: '/crm/orders',
  title: 'Orders',
  description:
    'Order history across your customer records — what each customer bought, when, and what it was worth.',
  icon: Receipt,
  columns: ['orderNumber', 'customer', 'status', 'paymentStatus', 'total', 'placedAt'],
  filters: ['status', 'paymentStatus'],
  panels: ['items', 'payments', 'customer'],
  canCreate: true,
  emptyTitle: 'No orders match',
  emptyDescription:
    'Orders linked to your customer records appear here, building the purchase history behind every profile. Adjust the filters above, or log an order manually.',
  // Safe here and only here: this lens only renders for a tenant with CRM.
  customerHref: (customerId) => `/crm/customers/${customerId}`,
};

/** Lens precedence for resolving a module-agnostic order link (global search, a
 *  home KPI, an email deep link) to a concrete route. Commerce leads because it
 *  is the module that actually produces orders; CRM is last because it only
 *  reads them. Callers walk this and take the first lens the tenant has enabled. */
export const ORDER_LENS_PRECEDENCE: OrderLens[] = [
  COMMERCE_ORDER_LENS,
  B2B_ORDER_LENS,
  CRM_ORDER_LENS,
];

/** Resolve the order route a tenant should land on given their enabled modules.
 *  Falls back to the commerce path — the API gate would have 404'd a tenant with
 *  none of the three, so a caller that gets here has at least one. */
export function resolveOrderBasePath(enabledModules: readonly string[]): string {
  const lens = ORDER_LENS_PRECEDENCE.find((l) => enabledModules.includes(l.module));
  return (lens ?? COMMERCE_ORDER_LENS).basePath;
}
