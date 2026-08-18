'use client';

// Orders data — a sale, everything that happened to it, and the one move you can
// make on it.
//
// This file OWNS the order types and the ['commerce','orders'] query key. Two
// definitions of the same row is how a list ends up reading a field the other
// one never fetched.
//
// Two things shape it beyond a normal data module.
//
// FIRST: every money column on an Order is a Prisma Decimal, and Decimal
// serializes to JSON as a STRING — "409.44", not 409.44. `Number()` at render
// time is not enough: "9.00" < "100.00" is TRUE as a string comparison, so
// anything that compares or sums raw wire values is quietly wrong. Coercion
// happens once, here, at the fetch boundary.
//
// SECOND: an order's state is genuinely two questions — has it been paid for,
// and has it been sent — and the platform stores them as two independent
// columns. So there are two state helpers, not one status enum, and the surfaces
// show both. Collapsing them loses the exact case an operator cares about most:
// paid but not yet shipped.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** How the buyer is joined onto both list rows and a single order — enough to
 *  name them without a lookup per row. */
export interface OrderCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  /** The employer they typed — not the linked company record below. */
  companyName: string | null;
  email: string | null;
  companyId: string | null;
  company: {
    id: string;
    companyName: string;
    paymentTerms: string | null;
    status: string;
  } | null;
}

/** An address exactly as it was at the moment of the sale. Frozen on the order,
 *  so editing the customer's address later never rewrites where this one went. */
export interface OrderAddress {
  recipientName?: string;
  company?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  sku: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  taxAmount: number;
  discountAmount: number;
  lineTotal: number;
  quantityFulfilled: number;
  quantityRefunded: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  propertyId: string | null;
  customerId: string;
  customer: OrderCustomer | null;

  status: string; // placed | fulfilled | delivered | cancelled | refunded
  paymentStatus: string; // unpaid | partially_paid | paid | refunded
  channel: string | null;
  source: string | null;

  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  surchargeTotal: number;
  total: number;
  amountPaid: number;
  refundTotal: number;
  currency: string;

  shippingAddress: OrderAddress | null;
  billingAddress: OrderAddress | null;

  placedAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  refundedAt: string | null;

  customerNote: string | null;
  internalNote: string | null;

  /** Only on a single order — the list route does not join items. */
  items?: OrderItem[];
}

export interface OrderPayment {
  id: string;
  processor: string;
  processorRef: string | null;
  amount: number;
  currency: string;
  status: string; // pending | authorized | captured | failed | voided | refunded
  failureReason: string | null;
  authorizedAt: string | null;
  capturedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
}

export interface OrderFulfillment {
  id: string;
  status: string; // pending | shipped | delivered | failed | cancelled
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface OrderRefund {
  id: string;
  paymentId: string | null;
  amount: number;
  currency: string;
  reason: string | null;
  status: string; // pending | completed | failed
  refundedAt: string | null;
  createdAt: string;
}

/* ── Wire coercion ──────────────────────────────────────────────────────── */

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeItem(raw: OrderItem): OrderItem {
  return {
    ...raw,
    quantity: num(raw.quantity),
    unitPrice: num(raw.unitPrice),
    lineSubtotal: num(raw.lineSubtotal),
    taxAmount: num(raw.taxAmount),
    discountAmount: num(raw.discountAmount),
    lineTotal: num(raw.lineTotal),
    quantityFulfilled: num(raw.quantityFulfilled),
    quantityRefunded: num(raw.quantityRefunded),
  };
}

export function normalizeOrder(raw: Order): Order {
  return {
    ...raw,
    subtotal: num(raw.subtotal),
    taxTotal: num(raw.taxTotal),
    shippingTotal: num(raw.shippingTotal),
    discountTotal: num(raw.discountTotal),
    surchargeTotal: num(raw.surchargeTotal),
    total: num(raw.total),
    amountPaid: num(raw.amountPaid),
    refundTotal: num(raw.refundTotal),
    ...(raw.items ? { items: raw.items.map(normalizeItem) } : {}),
  };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export const ORDERS_KEY = ['commerce', 'orders'];

/** Server-side sort. The list is paged, and a browser-side sort of the loaded
 *  window sorts ONE page and presents it as the answer — "biggest order" would
 *  hand back the biggest order on page 3. */
export type OrderSortKey = 'placedAt' | 'total';
export type SortDirection = 'asc' | 'desc';

export interface OrderQuery {
  q?: string;
  status?: string;
  paymentStatus?: string;
  /** Scope the list to one customer — the customer's-side lens on Selling. The
   *  endpoint (`GET /v1/orders?customer_id=`) is the join; there is no separate
   *  per-customer orders route. */
  customerId?: string;
  sortBy: OrderSortKey;
  order: SortDirection;
  take: number;
  skip: number;
}

export function useOrders(query: OrderQuery) {
  return useQuery({
    queryKey: [...ORDERS_KEY, query],
    queryFn: () =>
      api
        .list<Order>('/v1/orders', {
          ...(query.q ? { q: query.q } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.paymentStatus ? { payment_status: query.paymentStatus } : {}),
          ...(query.customerId ? { customer_id: query.customerId } : {}),
          sort_by: query.sortBy,
          order: query.order,
          take: query.take,
          skip: query.skip,
        })
        .then((result) => ({
          items: result.items.map(normalizeOrder),
          total: result.total,
        })),
    // Keeps the current window on screen while the next one loads, so paging and
    // re-sorting don't blink the table out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id],
    queryFn: () => api.get<Order>(`/v1/orders/${id}`).then(normalizeOrder),
  });
}

/**
 * What happened to the money, and what happened to the goods.
 *
 * Three separate endpoints rather than one fat order payload, because that is
 * how api-rest models them — payments, fulfillments and refunds are real
 * subresources with their own writes. They are fetched in parallel and each
 * failure is independent: a fulfillment service having a bad day must not blank
 * out the payment history on the same screen.
 */
export function useOrderPayments(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id, 'payments'],
    queryFn: () =>
      api
        .get<OrderPayment[]>(`/v1/orders/${id}/payments`)
        .then((rows) => rows.map((row) => ({ ...row, amount: num(row.amount) }))),
  });
}

export function useOrderFulfillments(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id, 'fulfillments'],
    queryFn: () => api.get<OrderFulfillment[]>(`/v1/orders/${id}/fulfillments`),
  });
}

export function useOrderRefunds(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id, 'refunds'],
    queryFn: () =>
      api
        .get<OrderRefund[]>(`/v1/orders/${id}/refunds`)
        .then((rows) => rows.map((row) => ({ ...row, amount: num(row.amount) }))),
  });
}

/** Cancelling is the one move this surface makes. The server refuses on a
 *  delivered or refunded order with a sentence saying so — which is worth
 *  showing verbatim rather than replacing with a guess. */
export function useCancelOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      api.post<Order>(`/v1/orders/${id}/cancel`, reason ? { reason } : {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

/**
 * Refund money already taken for an order. The server settles this through the
 * tenant's payment gateway and THEN records it (see api-rest lib/order-refund.ts), so
 * a success here means the money really moved — and a 4xx carries the gateway's own
 * reason, which `orderErrorMessage` surfaces verbatim.
 */
export function useRefundOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; reason?: string }) =>
      api.post(`/v1/orders/${id}/refunds`, {
        amount: input.amount,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

/**
 * The server's own sentence for a 4xx. These routes explain the actual problem
 * ("Cannot cancel an order in status \"delivered\"") far better than anything
 * this side could infer from a status code. A 5xx has no such sentence, so it
 * falls back to the caller's wording.
 */
export function orderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/* ── Saying what a state means ──────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Has it been sent? In the words an owner would use.
 *
 * The stored values are `placed | fulfilled | delivered | cancelled | refunded`,
 * which is a developer's vocabulary — "fulfilled" in particular reads as
 * "finished" to everyone who has not worked in commerce, when it means the
 * opposite: it has just left the building.
 */
export function shippingState(order: Order): { label: string; tone: Tone; detail: string } {
  switch (order.status) {
    case 'delivered':
      return {
        label: 'Delivered',
        tone: 'success',
        detail: 'This order reached the customer.',
      };
    case 'fulfilled':
      return {
        label: 'On the way',
        tone: 'info',
        detail: 'This order has been sent and is with the carrier.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'danger',
        detail: order.cancelledReason
          ? `This order was cancelled: ${order.cancelledReason}`
          : 'This order was cancelled and nothing more will be sent.',
      };
    case 'refunded':
      return {
        label: 'Refunded',
        tone: 'neutral',
        detail: 'The customer has had their money back on this order.',
      };
    default:
      return {
        label: 'To send',
        tone: 'warning',
        detail: 'Nothing has been sent to the customer yet.',
      };
  }
}

/** Has it been paid for? Money truth is its own axis — an order can be paid and
 *  unsent, or sent and unpaid, and both are situations someone acts on. */
export function paymentState(order: Order): { label: string; tone: Tone; detail: string } {
  switch (order.paymentStatus) {
    case 'paid':
      return { label: 'Paid', tone: 'success', detail: 'Paid in full.' };
    case 'partially_paid':
      return {
        label: 'Part paid',
        tone: 'info',
        detail: 'Some of this order has been paid for, and some is still owed.',
      };
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral', detail: 'This money has been given back.' };
    default:
      return { label: 'Not paid', tone: 'warning', detail: 'No money has come in for this order.' };
  }
}

export function paymentRecordTone(status: string): Tone {
  switch (status) {
    case 'captured':
      return 'success';
    case 'authorized':
      return 'info';
    case 'failed':
      return 'danger';
    case 'voided':
    case 'refunded':
      return 'neutral';
    default:
      return 'warning'; // pending
  }
}

export function fulfillmentTone(status: string): Tone {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'shipped':
      return 'info';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'neutral';
    default:
      return 'warning'; // pending
  }
}

export function refundTone(status: string): Tone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'warning';
  }
}

/** Plain-word labels for a payment record's own status, which uses card-industry
 *  words nobody outside payments has met. */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting',
  authorized: 'Held, not taken',
  captured: 'Taken',
  failed: 'Failed',
  voided: 'Cancelled',
  refunded: 'Given back',
};

export const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Being packed',
  shipped: 'On the way',
  delivered: 'Delivered',
  failed: 'Delivery failed',
  cancelled: 'Cancelled',
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: 'In progress',
  completed: 'Given back',
  failed: 'Failed',
};

/** How the sale came in. Defined here rather than imported from crm-schemas:
 *  the workbench is built free-standing, and these are the words a business
 *  owner uses, not the stored slugs. */
export const CHANNEL_LABELS: Record<string, string> = {
  storefront: 'Your website',
  b2b_portal: 'Trade portal',
  admin: 'Entered by your team',
  import: 'Imported',
  mcp: 'AI assistant',
  marketplace: 'Marketplace',
};

export const MARKETPLACE_SOURCE_LABELS: Record<string, string> = {
  tiktok_shop: 'TikTok Shop',
  etsy: 'Etsy',
  amazon: 'Amazon',
  walmart: 'Walmart',
  ebay: 'eBay',
  faire: 'Faire',
  meta: 'Facebook & Instagram',
  sparx_market: 'sparx.market',
};

/** Where an order came from, in one phrase. A marketplace order names the actual
 *  marketplace — "Marketplace" alone tells a seller nothing they can act on. */
export function channelLabel(order: Order): string {
  if (order.channel === 'marketplace' && order.source) {
    return MARKETPLACE_SOURCE_LABELS[order.source] ?? order.source;
  }
  if (order.channel) return CHANNEL_LABELS[order.channel] ?? order.channel;
  return 'Unknown';
}

/** The buyer in one line: a company if they trade as one, otherwise their name,
 *  otherwise their email. Never an empty cell — an order always has a buyer. */
export function customerName(customer: OrderCustomer | null): string {
  if (!customer) return 'Unknown customer';
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (customer.companyName) return customer.companyName;
  if (person) return person;
  return customer.email ?? 'Unknown customer';
}

/**
 * What is still collectable on this order.
 *
 * `total − amountPaid` alone is wrong at both ends of an order's life. A
 * refunded order has had its money handed back, and a cancelled one is never
 * going to be paid — both would otherwise report the FULL total as outstanding
 * and put a "still owed" banner on a sale nobody should be chasing. Observed on
 * a real refunded order, which read "Still owed $421.28" under a Refunded badge.
 */
export function amountDue(order: Order): number {
  if (order.status === 'cancelled' || order.status === 'refunded') return 0;
  if (order.paymentStatus === 'refunded') return 0;
  return Math.max(0, order.total - order.amountPaid - order.refundTotal);
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A frozen address as a list of lines, blanks dropped. Rendering the fields
 *  individually leaves gaps where an optional one is missing. */
export function addressLines(address: OrderAddress | null): string[] {
  if (!address) return [];
  const region = [address.city, address.region, address.postalCode].filter(Boolean).join(', ');
  return [
    address.recipientName,
    address.company,
    address.line1,
    address.line2,
    region,
    address.country,
    address.phone,
  ].filter((line): line is string => Boolean(line?.trim()));
}
