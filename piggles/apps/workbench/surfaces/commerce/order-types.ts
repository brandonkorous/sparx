'use client';

// The shape of an order on the wire, and the one coercion it needs.
//
// Every money column is a Prisma Decimal, and Decimal serializes to JSON as a
// STRING — "409.44", not 409.44. `Number()` at render time is not enough:
// "9.00" < "100.00" is TRUE as a string comparison, so anything that compares or
// sums raw wire values is quietly wrong. Coercion happens once, at the fetch
// boundary, through `normalizeOrder`.

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

  /** Everything checkout froze onto the order that has no column of its own --
   *  which is where HOW THE ORDER LEAVES lives (`shippingRateRef`,
   *  `shippingProviderSlug`, `shippingDescription`). Read it through
   *  `deliveryPlan()`; nothing else should be poking at raw keys. */
  metadata?: Record<string, unknown> | null;

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

/** A Decimal off the wire, as a number. Exported because payments and refunds
 *  carry the same string amounts and are coerced where they are fetched. */
export function num(value: unknown): number {
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

/** The rate ref checkout writes when a shopper chooses to come and get it.
 *  Mirrors COLLECTION_RATE_REF in @wizeworks/commerce (collection-option.ts);
 *  copied rather than imported because that package is server-side and would
 *  drag Prisma into the browser bundle. */
const COLLECTION_RATE_REF = 'collection:in-person';

export interface DeliveryPlan {
  /** True when the customer is coming to fetch it -- so there is nothing to
   *  post, no carrier to name, and no warehouse walk that makes sense. */
  collected: boolean;
  /** What the shopper chose, in their words. Null when the order predates
   *  checkout recording it, which is NOT the same as "collection" -- an old
   *  order with no record must not be presented as one or the other. */
  description: string | null;
}

/**
 * How this order leaves, according to what the shopper picked at checkout.
 *
 * Reads the metadata checkout froze on. `collected` is deliberately keyed on
 * the RATE REF rather than the absence of a shipping address: a collection
 * order still carries an address (it is the billing address, and the shop may
 * well want it), so "no address" would call every one of them a despatch.
 */
export function deliveryPlan(order: Order): DeliveryPlan {
  const meta = order.metadata ?? {};
  const ref = typeof meta.shippingRateRef === 'string' ? meta.shippingRateRef : null;
  const described =
    typeof meta.shippingDescription === 'string' && meta.shippingDescription.trim()
      ? meta.shippingDescription.trim()
      : null;
  return { collected: ref === COLLECTION_RATE_REF, description: described };
}
