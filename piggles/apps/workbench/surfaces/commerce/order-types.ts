'use client';

// The shape of an order on the wire, and the one coercion it needs: money arrives
// as Decimal STRINGS ("9.00" < "100.00" is true as text), so `normalizeOrder`
// turns every amount into a number once, at the fetch boundary.

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
  /** The wholesale business this order is for. NOT `company`: that name is the
   *  typed employer, and a computed field shadowed the relation, so it came back
   *  null on every order (issue 751). Attached after the query instead. */
  b2bAccount: {
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
  /** Refundable core deposit per unit on a rebuilt part, or null (issue 051). */
  coreCharge: number | null;
  /** Old parts that came back, their deposits refunded. */
  coresReturned: number;
  /** Deposits the business kept: the core never came back, or could not be used. */
  coresKept: number;
  /** Bought by sending the old part first: no deposit, and the line ships only as
   *  its old parts arrive (issue 057). */
  coreFirst: boolean;
  /** When the business chose to ship a send-first line without waiting. */
  coreHoldReleasedAt: string | null;
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
  /** Refundable core deposits on the lines; in `total`, never in `subtotal`. */
  coreChargeTotal: number;
  total: number;
  amountPaid: number;
  refundTotal: number;
  /** Of `refundTotal`, how much went back as returned core deposits: the happy
   *  end of a rebuilt-part sale, not a refund anybody asked for. */
  depositsReturned: number;
  currency: string;

  shippingAddress: OrderAddress | null;
  billingAddress: OrderAddress | null;

  placedAt: string;
  /** The earliest DAY every line on this order can be handed over, as
   *  `YYYY-MM-DD` (issue 026). Null when nothing on it needed notice, which is
   *  not "ready today" and must not be shown as one. */
  readyOn: string | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  refundedAt: string | null;

  customerNote: string | null;
  internalNote: string | null;

  /** What checkout froze onto the order with no column of its own, including HOW
   *  THE ORDER LEAVES (`shippingRateRef`, `shippingProviderSlug`, …). Read it
   *  through `deliveryPlan()`, never by raw key. */
  metadata?: Record<string, unknown> | null;

  /** Only on a single order — the list route does not join items. */
  items?: OrderItem[];
}

export interface OrderPayment {
  id: string;
  processor: string;
  /** The GATEWAY's reference for this charge. Null on anything taken by hand —
   *  what a person wrote down about a cheque lives in `metadata.note`. */
  processorRef: string | null;
  metadata?: Record<string, unknown> | null;
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
    coreCharge: raw.coreCharge == null ? null : num(raw.coreCharge),
    coresReturned: num(raw.coresReturned ?? 0),
    coresKept: num(raw.coresKept ?? 0),
    coreFirst: raw.coreFirst === true,
    coreHoldReleasedAt: raw.coreHoldReleasedAt ?? null,
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
    coreChargeTotal: num(raw.coreChargeTotal ?? 0),
    total: num(raw.total),
    amountPaid: num(raw.amountPaid),
    refundTotal: num(raw.refundTotal),
    depositsReturned: num(raw.depositsReturned ?? 0),
    readyOn: calendarDay(raw.readyOn),
    ...(raw.items ? { items: raw.items.map(normalizeItem) } : {}),
  };
}

/** A DATE column arrives as an instant at UTC midnight. Take the day off the
 *  string, not through a Date: a local parse turns Saturday into Friday for
 *  anyone west of Greenwich. */
function calendarDay(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null;
}

export { deliveryPlan, type DeliveryPlan } from './order-delivery';
