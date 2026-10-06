// Typed wrappers over the public customer-account API, via the same-origin
// /api/sparx proxy. The session is an httpOnly cookie set by api-rest and
// relayed by the proxy — so these calls just rely on the browser sending it
// (same-origin fetch includes cookies by default). On register/login we also
// forward the guest cart token so the server can claim the cart for the new
// session. See docs/27.

import {
  failureMessage,
  isTransientStatus,
  sessionOutcome,
  SHOP_UNREACHABLE_MESSAGE,
} from './shop-reach';
import type { ApprovedStockLine, SignOffSide, SignOffView } from './sign-off-words';

const API_BASE = '/api/sparx';
const CART_TOKEN_KEY = 'sparx_cart_token';

export interface Customer {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

/** What this shop offers THIS shopper. Read from evidence (a bookable service
 *  exists; this customer belongs to a B2B account), never from a module flag,
 *  so the account nav lists only what the shop can actually deliver. */
export interface AccountOffers {
  bookings: boolean;
  b2b: boolean;
  /** Whether THIS SITE sells. False on a site whose owner switched Selling off
   *  under "What this site shows" — Orders, Returns, Wishlist and Payment
   *  methods then have no place in its account nav, however many orders the
   *  account has on the owner's other sites. */
  selling: boolean;
  /** Same, for Customers: the pages where a visitor asks for something rather
   *  than buys it. */
  requests: boolean;
}

/** Nothing on offer until the server says otherwise — an unanswered read must
 *  not invite somebody to book at a shop that takes no bookings. */
export const NO_OFFERS: AccountOffers = {
  bookings: false,
  b2b: false,
  // These two fail OPEN, unlike the pair above. Bookings and B2B are things a
  // shop may simply not do, so an unanswered read must not invite somebody to
  // book at a shop that takes no bookings. Selling and Requests are things a
  // site HAS unless its owner said otherwise, so an unanswered read must not
  // take a signed-in shopper's own order history away from them.
  selling: true,
  requests: true,
};

export class AccountError extends Error {
  readonly status: number;
  /** The API's own error code, when it sent one. `CART_ALREADY_BOUGHT` is the
   *  one a caller acts on: the basket it named was already bought, so the cart
   *  provider starts a fresh one (sparx persona issue 087). */
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'AccountError';
    this.status = status;
    this.code = code;
  }
}

/** True when the request got no answer (the shop could not be reached, or the
 *  server failed before answering), as opposed to a refusal. A caller that sees
 *  this should wait and try again, never conclude anything about the shopper. */
export function isShopUnreachable(err: unknown): boolean {
  return err instanceof AccountError && isTransientStatus(err.status);
}

function url(path: string, tenantSlug: string, propertySlug?: string): string {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  // Active site (docs/58 D2) — register/login create/resolve the membership on
  // this site. Other endpoints omit it (the session already names the membership).
  if (propertySlug) qs.set('property', propertySlug);
  return `${API_BASE}${path}?${qs.toString()}`;
}

function cartTokenHeader(): Record<string, string> {
  try {
    const t = localStorage.getItem(CART_TOKEN_KEY);
    return t ? { 'x-cart-token': t } : {};
  } catch {
    return {};
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json || json.success === false) {
    // A response with no readable body from a server error, or the proxy's own
    // "could not reach the shop", says so in those words (persona issue 086).
    throw new AccountError(
      failureMessage(res.status, json?.error, 'Something went wrong.'),
      res.status,
      json?.error?.code ?? null
    );
  }
  return json.data as T;
}

/** A cart identity the client must adopt after login/register — returned
 *  whenever the server merged the guest cart into a different, pre-existing
 *  cart (deleting the one the client had cached) or found an existing cart
 *  the client didn't know about (a fresh browser/device). Cart ownership is
 *  token-only (no session fallback), so without this handoff the client's
 *  stale cached cart id would 404 and the cart would appear empty. */
export interface CartHandoff {
  cartId: string;
  guestToken: string;
}

/** Auth result: the profile plus `recognized` — true when the account already
 *  existed on a SISTER site and a separate membership was just created here
 *  (docs/58 D6), which the UI surfaces as a one-time notice. `cart` is set
 *  when the client needs to adopt a new cart identity post-login. */
export interface AuthResult {
  customer: Customer;
  recognized: boolean;
  cart: CartHandoff | null;
}

export async function register(
  tenantSlug: string,
  input: { email: string; password: string; firstName?: string; lastName?: string },
  propertySlug?: string
): Promise<AuthResult> {
  const res = await fetch(url('/v1/public/commerce/account/register', tenantSlug, propertySlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...cartTokenHeader() },
    body: JSON.stringify(input),
  });
  const data = await parse<{ customer: Customer; recognized?: boolean; cart?: CartHandoff | null }>(
    res
  );
  return { customer: data.customer, recognized: data.recognized ?? false, cart: data.cart ?? null };
}

export async function login(
  tenantSlug: string,
  input: { email: string; password: string },
  propertySlug?: string
): Promise<AuthResult> {
  const res = await fetch(url('/v1/public/commerce/account/login', tenantSlug, propertySlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...cartTokenHeader() },
    body: JSON.stringify(input),
  });
  const data = await parse<{ customer: Customer; recognized?: boolean; cart?: CartHandoff | null }>(
    res
  );
  return { customer: data.customer, recognized: data.recognized ?? false, cart: data.cart ?? null };
}

export async function logout(tenantSlug: string): Promise<void> {
  await fetch(url('/v1/public/commerce/account/logout', tenantSlug), { method: 'POST' });
}

/** Always resolves (enumeration-safe): the server 200s whether or not the
 *  email exists, only sending mail when it does. */
export async function requestPasswordReset(tenantSlug: string, email: string): Promise<void> {
  await fetch(url('/v1/public/commerce/account/password/forgot', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  tenantSlug: string,
  token: string,
  password: string
): Promise<void> {
  const res = await fetch(url('/v1/public/commerce/account/password/reset', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  await parse<{ ok: true }>(res);
}

/**
 * Who is signed in, as one of three answers.
 *
 * `signed-out` only for a real refusal (a 401: no cookie, or a session the
 * server no longer honors). A request that got NO answer (a network failure,
 * the proxy's 503 while api-rest restarts, any server error) is `unreachable`:
 * it says nothing about the shopper, whose cookie is untouched. Reading it as
 * signed out sent a trade buyer with a valid session to the sign-in page in
 * the middle of a rolling deploy (sparx persona issue 086).
 */
export type SessionRead =
  | { kind: 'signed-in'; customer: Customer; offers: AccountOffers }
  | { kind: 'signed-out' }
  | { kind: 'unreachable' };

export async function readSession(
  tenantSlug: string,
  // WHICH SITE they are signed in on. The account area is one screen on many
  // sites, and `offers` now answers per site — a journal with Selling switched
  // off shows no Orders. Omitted, the server answers for the primary site, which
  // is what a single-site shop has always got.
  propertySlug?: string
): Promise<SessionRead> {
  let res: Response;
  try {
    res = await fetch(url('/v1/public/commerce/account/me', tenantSlug, propertySlug), {
      cache: 'no-store',
    });
  } catch {
    return { kind: 'unreachable' };
  }
  const outcome = sessionOutcome(res.status);
  if (outcome === 'signed-out') return { kind: 'signed-out' };
  if (outcome === 'unknown') return { kind: 'unreachable' };
  try {
    const body = await parse<{ customer: Customer; offers?: AccountOffers }>(res);
    return { kind: 'signed-in', customer: body.customer, offers: body.offers ?? NO_OFFERS };
  } catch {
    // A 200 whose body could not be read answered nothing either.
    return { kind: 'unreachable' };
  }
}

/** Returns the current customer and what the shop offers them, or null if not
 *  signed in. Throws an `isShopUnreachable` error when the question got no
 *  answer, so no caller can mistake a blip for a sign-out. */
export async function getMe(
  tenantSlug: string,
  propertySlug?: string
): Promise<{ customer: Customer; offers: AccountOffers } | null> {
  const read = await readSession(tenantSlug, propertySlug);
  if (read.kind === 'signed-out') return null;
  if (read.kind === 'unreachable') throw new AccountError(SHOP_UNREACHABLE_MESSAGE, 503);
  return { customer: read.customer, offers: read.offers };
}

export async function updateProfile(
  tenantSlug: string,
  input: { firstName?: string | null; lastName?: string | null; phone?: string | null }
): Promise<Customer> {
  const res = await fetch(url('/v1/public/commerce/account/me', tenantSlug), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await parse<{ customer: Customer }>(res)).customer;
}

// ── Orders ────────────────────────────────────────────────────────────────

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  currency: string;
  placedAt: string;
}

export interface OrderFulfillmentView {
  id: string;
  status: string;
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderDetail extends Omit<OrderSummary, never> {
  subtotalCents: number;
  taxTotalCents: number;
  shippingTotalCents: number;
  discountTotalCents: number;
  /** What actually moved on this order, as opposed to what was owed. Both are
   *  maintained by the payment rollup on every payment and refund. A refund is
   *  the most important thing that can happen to an order after it is placed, so
   *  the shopper's own copy has to be able to say so (issue 292). */
  amountPaidCents: number;
  refundedTotalCents: number;
  shippingAddress: Record<string, unknown> | null;
  /** How this order leaves, in the words chosen at checkout ("Collect in
   *  person", "USPS Priority"). Null when the method was never recorded, which
   *  must render as nothing rather than as a method somebody picked. */
  shippingDescription: string | null;
  /** The buyer is coming to fetch it, so there is no address to show and none
   *  was ever asked for (issue 064). */
  collecting: boolean;
  // Lifecycle timestamps — nullable until the order reaches each stage. Drive
  // the order-status timeline.
  paidAt: string | null;
  fulfilledAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    lineSubtotalCents: number;
    /** The share of an order-level code that came off THIS line. */
    discountAmountCents: number;
    lineTotalCents: number;
    /** Refundable core deposit per unit on a rebuilt part; null = none (sparx
     *  issue 051). */
    coreChargeCents: number | null;
    /** Old parts still to send back for this line. */
    coresOwed: number;
    /** Old parts that came back, their deposits refunded. */
    coresReturned: number;
    /** Deposits the shop kept. */
    coresKept: number;
    /** Bought by sending the old part first: no deposit, and it ships when the old
     *  part arrives (sparx issue 057). */
    coreFirst: boolean;
    /** Units still held until their old part arrives. */
    waitingForOldPart: number;
  }[];
  /** Where to send an old part: the business's name and postal address. Null when
   *  nothing is owed, or the business has no street address on file. */
  coreReturnTo: { name: string; lines: string[] } | null;
  /** Refundable core deposits taken on this order, inside the total. */
  coreChargeTotalCents: number;
  fulfillments: OrderFulfillmentView[];
  /** A wholesale order held for sign-off: who it is waiting on, at the buyer's
   *  own account or the business, and who has already said yes (sparx persona
   *  issue 087). Null for every other order, and absent from an older api-rest. */
  signOff?: SignOffView | null;
  /** Approved, but the card held for it could not be charged when it was, so
   *  it has gone ahead unpaid and the page asks them to pay (sparx persona
   *  issue 087). Absent from an older api-rest. */
  cardNotCharged?: boolean;
  /** Billed to a wholesale account on terms: the terms, and the invoice once it
   *  is issued (null while the order is held). Null for an order paid at
   *  checkout, and absent from an older api-rest (sparx persona issue 087). */
  onAccount?: OrderOnAccount | null;
}

/** An order billed to a wholesale account, as its buyer's order page reads it. */
export interface OrderOnAccount {
  terms: string;
  invoice: {
    number: string | null;
    dueAt: string | null;
    totalCents: number;
    balanceCents: number;
    status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'void';
  } | null;
}

export async function getOrders(
  tenantSlug: string,
  page = 1,
  pageSize = 10
): Promise<{ orders: OrderSummary[]; total: number; totalPages: number }> {
  const res = await fetch(
    `${url('/v1/public/commerce/account/orders', tenantSlug)}&page=${page}&pageSize=${pageSize}`,
    { cache: 'no-store' }
  );
  const json = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: OrderSummary[];
    meta?: { total?: number; total_pages?: number };
  } | null;
  if (!res.ok || !json || json.success === false) {
    throw new AccountError('Could not load orders.', res.status);
  }
  return {
    orders: json.data ?? [],
    total: json.meta?.total ?? 0,
    totalPages: json.meta?.total_pages ?? 1,
  };
}

export async function getOrder(tenantSlug: string, orderId: string): Promise<OrderDetail> {
  const res = await fetch(
    url(`/v1/public/commerce/account/orders/${encodeURIComponent(orderId)}`, tenantSlug),
    { cache: 'no-store' }
  );
  return parse<OrderDetail>(res);
}

// ── Returns ─────────────────────────────────────────────────────────────────
// Self-service, because a return she cannot start herself is an email to the
// shop — and on a clothing label returns are a fifth of orders.

/** The shopper's own words for a reason, keyed by the schema's codes. Kept here
 *  rather than in the schema package: the codes are the contract, and these are
 *  copy, which is the storefront's business. */
export const RETURN_REASONS = [
  { code: 'wrong_size', label: 'It does not fit' },
  { code: 'not_as_described', label: 'It is not what I expected' },
  { code: 'defective', label: 'Something is wrong with it' },
  { code: 'damaged_in_transit', label: 'It arrived damaged' },
  { code: 'wrong_item', label: 'I was sent the wrong thing' },
  { code: 'arrived_late', label: 'It arrived too late' },
  { code: 'no_longer_needed', label: 'I changed my mind' },
  { code: 'other', label: 'Something else' },
] as const;

export type ReturnReasonCode = (typeof RETURN_REASONS)[number]['code'];

export interface ReturnableLine {
  orderItemId: string;
  name: string;
  sku: string;
  quantity: number;
  spokenFor: number;
  returnableQuantity: number;
  unitPriceCents: number;
}

export interface OrderReturnability {
  eligible: boolean;
  /** Why not, when not — so the page can say it rather than hiding the button. */
  reason: 'not_sent_yet' | 'nothing_left' | null;
  lines: ReturnableLine[];
}

export interface ReturnSummaryView {
  id: string;
  orderId: string;
  orderNumber: string | null;
  status: string;
  preferredOutcome: string;
  itemCount: number;
  requestedAt: string;
}

export interface ReturnDetailView extends ReturnSummaryView {
  approvedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  refundedAmountCents: number | null;
  /** Money kept back out of the refund. Hers, so she is told. */
  restockingFeeCents: number | null;
  /** Only ever set on a declined request — the shop's reason, so a refusal is
   *  never a dead end. Null on every other status. */
  declinedReason: string | null;
  items: {
    id: string;
    orderItemId: string;
    orderItemName: string | null;
    quantity: number;
    approvedQuantity: number;
    reasonCode: string;
    customerNote: string | null;
  }[];
  /** A return label the shop issued her, if any — tracking only. */
  labels: { trackingNumber: string | null; trackingUrl: string | null }[];
}

export async function getReturnable(
  tenantSlug: string,
  orderId: string
): Promise<OrderReturnability> {
  const res = await fetch(
    url(`/v1/public/commerce/account/orders/${encodeURIComponent(orderId)}/returnable`, tenantSlug),
    { cache: 'no-store' }
  );
  return parse<OrderReturnability>(res);
}

export async function getReturns(tenantSlug: string): Promise<ReturnSummaryView[]> {
  const res = await fetch(url('/v1/public/commerce/account/returns', tenantSlug), {
    cache: 'no-store',
  });
  const data = await parse<{ returns: ReturnSummaryView[] }>(res);
  return data.returns;
}

export async function getReturn(tenantSlug: string, returnId: string): Promise<ReturnDetailView> {
  const res = await fetch(
    url(`/v1/public/commerce/account/returns/${encodeURIComponent(returnId)}`, tenantSlug),
    { cache: 'no-store' }
  );
  return parse<ReturnDetailView>(res);
}

export async function requestReturn(
  tenantSlug: string,
  input: {
    orderId: string;
    preferredOutcome: 'refund' | 'exchange';
    items: {
      orderItemId: string;
      quantity: number;
      reasonCode: ReturnReasonCode;
      customerNote?: string;
    }[];
  }
): Promise<{ id: string }> {
  const res = await fetch(url('/v1/public/commerce/account/returns', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parse<{ id: string }>(res);
}

// ── Addresses ───────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  type: 'shipping' | 'billing' | 'both';
  label: string | null;
  recipientName: string | null;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

export type AddressInput = Omit<Address, 'id'>;

export async function getAddresses(tenantSlug: string): Promise<Address[]> {
  const res = await fetch(url('/v1/public/commerce/account/addresses', tenantSlug), {
    cache: 'no-store',
  });
  return (await parse<{ addresses: Address[] }>(res)).addresses;
}

export async function createAddress(
  tenantSlug: string,
  input: Partial<AddressInput>
): Promise<Address> {
  const res = await fetch(url('/v1/public/commerce/account/addresses', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await parse<{ address: Address }>(res)).address;
}

export async function updateAddress(
  tenantSlug: string,
  addressId: string,
  input: Partial<AddressInput>
): Promise<Address> {
  const res = await fetch(
    url(`/v1/public/commerce/account/addresses/${encodeURIComponent(addressId)}`, tenantSlug),
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }
  );
  return (await parse<{ address: Address }>(res)).address;
}

export async function deleteAddress(tenantSlug: string, addressId: string): Promise<void> {
  await fetch(
    url(`/v1/public/commerce/account/addresses/${encodeURIComponent(addressId)}`, tenantSlug),
    { method: 'DELETE' }
  );
}

// ── Wishlist ────────────────────────────────────────────────────────────────

// Wishlist items key on a variant; responses also carry the parent product so
// the UI can link + label.
export interface WishlistItem {
  variantId: string;
  productId: string;
  handle: string;
  title: string;
  imageMediaId: string | null;
  priceCents: number;
}

export async function getWishlist(tenantSlug: string): Promise<WishlistItem[]> {
  const res = await fetch(url('/v1/public/commerce/account/wishlist', tenantSlug), {
    cache: 'no-store',
  });
  if (res.status === 401) return [];
  return (await parse<{ items: WishlistItem[] }>(res)).items;
}

export async function addToWishlist(tenantSlug: string, variantId: string): Promise<void> {
  const res = await fetch(url('/v1/public/commerce/account/wishlist', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ variantId }),
  });
  await parse<{ ok: true }>(res);
}

export async function removeFromWishlist(tenantSlug: string, variantId: string): Promise<void> {
  await fetch(
    url(`/v1/public/commerce/account/wishlist/${encodeURIComponent(variantId)}`, tenantSlug),
    { method: 'DELETE' }
  );
}

// ── B2B Portal ──────────────────────────────────────────────────────────────

export interface B2bAccountEntry {
  accountId: string;
  companyName: string;
  role: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  status: string;
  paymentTerms: string | null;
}

export interface B2bInvoiceSummary {
  unpaidCount: number;
  unpaidCents: number;
  overdueCount: number;
  overdueCents: number;
  paidCount: number;
}

export interface B2bPortalSummary {
  account: B2bAccountEntry & {
    discountPercent: number;
    /** The business's own currency, for the credit figures and bill totals. */
    currency: string;
    role: string;
  };
  invoiceSummary: B2bInvoiceSummary;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    currency: string;
    createdAt: string;
  }[];
}

export interface B2bInvoiceEntry {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  /** What is still owed on it; less than `amountCents` once part is paid. */
  balanceCents: number;
  currency: string;
  status: string;
  overdueDays: number;
  /** Null when the invoice was issued without a due date. */
  dueAt: string | null;
  paidAt: string | null;
  orderId: string | null;
  /** The buyer's own purchase order number, when one was given. */
  poNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export interface B2bOrderEntry {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
}

// A quote IS a BillingDocument on the system `b2b-quotes` workflow — its state
// is the stage it's on, not a standalone status enum (docs/87 convergence).
export interface B2bQuoteStage {
  name: string;
  customerLabel: string | null;
  stageType: string;
}

export interface B2bQuoteEntry {
  id: string;
  number: string | null;
  stage: B2bQuoteStage;
  /** Null, like every amount on the quote, until the shop has priced it and
   *  made the offer: before then its figures are the shop's working copy
   *  (sparx persona issue 086). */
  totalCents: number | null;
  currency: string;
  validUntil: string | null;
  createdAt: string;
  /** The parts that make up `totalCents`; null before the offer. */
  totals: B2bQuoteTotals | null;
  /** The buyer's own purchase order number, when one was given. */
  poNumber: string | null;
  /** When and where the buyer said they need it, when they did. `neededBy` is
   *  a calendar day, `YYYY-MM-DD` (sparx persona issue 086). */
  delivery: { neededBy: string | null; deliverTo: string | null; notes: string | null } | null;
  /** The site that issued the quote. */
  shopName: string;
  /** The order an accepted quote became, or null (sparx persona issue 085).
   *  `signOff` says who a held one is waiting on, and is null unless it is
   *  held (sparx persona issue 087). */
  order: {
    id: string;
    orderNumber: string;
    status: string;
    signOff?: SignOffView | null;
  } | null;
  lines: B2bQuoteLine[];
}

export interface B2bQuoteTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  surchargeCents: number;
  /** Refundable core deposits on rebuilt parts: in the total, in no line's amount. */
  coreDepositCents: number;
}

/** A line on a quote. Its prices are placeholders until the shop has priced
 *  the quote (see `quoteStageView` in lib/trade-account-words). */
export interface B2bQuoteLine {
  id: string;
  description: string;
  quantity: number;
  /** Null before the offer, like the quote's total. */
  unitPriceCents: number | null;
  /** Quantity times unit price, before discount and tax. */
  lineSubtotalCents: number | null;
  lineTotalCents: number | null;
  /** Refundable core deposit per unit on a rebuilt part, or null. */
  coreDepositCents: number | null;
}

/** A line asked for on an estimate: what, how many, and the catalog item when
 *  picked from the catalog. */
export interface B2bQuoteLineInput {
  description: string;
  quantity: number;
  variantId?: string;
}

export interface QuoteProductResult {
  productId: string;
  variantId: string | null;
  title: string;
  priceCents: number | null;
}

/** Catalog search for the quote-request line picker — a thin client-side
 *  wrapper over the same typo-tolerant search the shop/PLP uses, trimmed to
 *  what a "which product is this?" typeahead needs. Degrades to an empty
 *  list rather than throwing (a picker that briefly shows nothing is fine;
 *  one that crashes the form is not). */
export async function searchQuoteProducts(
  tenantSlug: string,
  query: string
): Promise<QuoteProductResult[]> {
  if (!query.trim()) return [];
  const qs = new URLSearchParams({
    tenant: tenantSlug,
    q: query.trim(),
    perPage: '8',
  });
  try {
    const res = await fetch(`${API_BASE}/v1/public/commerce/search?${qs.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json().catch(() => null)) as {
      success: boolean;
      data?: {
        id: string;
        title: string;
        defaultVariantId: string | null;
        priceMinCents: number | null;
      }[];
    } | null;
    if (!json || json.success === false) return [];
    return (json.data ?? []).map((p) => ({
      productId: p.id,
      variantId: p.defaultVariantId,
      title: p.title,
      priceCents: p.priceMinCents,
    }));
  } catch {
    return [];
  }
}

function b2bPortalUrl(path: string, tenantSlug: string): string {
  return `${API_BASE}/v1/public/b2b/portal${path}?tenant=${encodeURIComponent(tenantSlug)}`;
}

export async function getB2bAccounts(tenantSlug: string): Promise<B2bAccountEntry[]> {
  const res = await fetch(b2bPortalUrl('', tenantSlug), { cache: 'no-store' });
  if (res.status === 401) return [];
  return (await parse<{ accounts: B2bAccountEntry[] }>(res)).accounts;
}

export async function getB2bSummary(
  tenantSlug: string,
  accountId: string
): Promise<B2bPortalSummary> {
  const res = await fetch(b2bPortalUrl(`/${encodeURIComponent(accountId)}/summary`, tenantSlug), {
    cache: 'no-store',
  });
  return parse<B2bPortalSummary>(res);
}

export async function getB2bInvoices(
  tenantSlug: string,
  accountId: string,
  skip = 0,
  take = 20
): Promise<{ items: B2bInvoiceEntry[]; total: number }> {
  const res = await fetch(
    `${b2bPortalUrl(`/${encodeURIComponent(accountId)}/invoices`, tenantSlug)}&skip=${skip}&take=${take}`,
    { cache: 'no-store' }
  );
  const json = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: B2bInvoiceEntry[];
    meta?: { total?: number };
  } | null;
  if (!res.ok || !json || json.success === false)
    throw new AccountError('Could not load invoices.', res.status);
  return { items: json.data ?? [], total: json.meta?.total ?? 0 };
}

export async function getB2bOrders(
  tenantSlug: string,
  accountId: string,
  skip = 0,
  take = 20
): Promise<{ items: B2bOrderEntry[]; total: number }> {
  const res = await fetch(
    `${b2bPortalUrl(`/${encodeURIComponent(accountId)}/orders`, tenantSlug)}&skip=${skip}&take=${take}`,
    { cache: 'no-store' }
  );
  const json = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: B2bOrderEntry[];
    meta?: { total?: number };
  } | null;
  if (!res.ok || !json || json.success === false)
    throw new AccountError('Could not load orders.', res.status);
  return { items: json.data ?? [], total: json.meta?.total ?? 0 };
}

// ── B2B account statement ───────────────────────────────────────────────────
//
// What the account owed at the start of a period, every invoice, payment and
// write-off in it with the buyer's own PO number, what it owes at the end, and
// how late. Money is CENTS throughout, like the invoice list.

export interface B2bStatementRow {
  kind: 'invoice' | 'payment' | 'refund' | 'write_off';
  at: string;
  documentId: string;
  documentNumber: string | null;
  poNumber: string | null;
  dueAt: string | null;
  description: string;
  chargeCents: number;
  creditCents: number;
  balanceCents: number;
}

export interface B2bStatementOpenItem {
  documentId: string;
  number: string | null;
  poNumber: string | null;
  issuedAt: string;
  dueAt: string | null;
  totalCents: number;
  openCents: number;
  /** Whole days past due at the end of the period; zero or less is not late. */
  daysLate: number;
  bucket: 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';
}

export interface B2bStatement {
  account: {
    id: string;
    companyName: string;
    billingAddress: string[];
    paymentTerms: string | null;
    paymentTermsWords: string | null;
    creditLimitCents: number;
    status: string;
  };
  period: { from: string; to: string };
  currency: string;
  generatedAt: string;
  openingCents: number;
  chargesCents: number;
  creditsCents: number;
  closingCents: number;
  dueNowCents: number;
  pastDueCents: number;
  rows: B2bStatementRow[];
  openItems: B2bStatementOpenItem[];
  aging: { key: B2bStatementOpenItem['bucket']; label: string; count: number; cents: number }[];
}

/** A statement period. Blank ends are decided by the shop's calendar: no start
 *  is the first of the month, no end is today. */
export interface B2bStatementPeriod {
  from?: string;
  to?: string;
}

function statementQuery(period: B2bStatementPeriod): string {
  const qs = new URLSearchParams();
  if (period.from) qs.set('from', period.from);
  if (period.to) qs.set('to', period.to);
  const query = qs.toString();
  return query ? `&${query}` : '';
}

export async function getB2bStatement(
  tenantSlug: string,
  accountId: string,
  period: B2bStatementPeriod
): Promise<B2bStatement> {
  const res = await fetch(
    `${b2bPortalUrl(`/${encodeURIComponent(accountId)}/statement`, tenantSlug)}${statementQuery(period)}`,
    { cache: 'no-store' }
  );
  return parse<B2bStatement>(res);
}

/** The statement as a page to print, on this site's own origin through the
 *  same proxy every other account call uses, so the sign-in cookie travels
 *  with it and the page's print button prints it. */
export function b2bStatementPrintUrl(
  tenantSlug: string,
  accountId: string,
  period: B2bStatementPeriod
): string {
  return `${b2bPortalUrl(`/${encodeURIComponent(accountId)}/statement/print`, tenantSlug)}${statementQuery(period)}`;
}

export async function getB2bQuotes(
  tenantSlug: string,
  accountId: string,
  skip = 0,
  take = 20
): Promise<{ items: B2bQuoteEntry[]; total: number }> {
  const res = await fetch(
    `${b2bPortalUrl(`/${encodeURIComponent(accountId)}/quotes`, tenantSlug)}&skip=${skip}&take=${take}`,
    { cache: 'no-store' }
  );
  const json = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: B2bQuoteEntry[];
    meta?: { total?: number };
  } | null;
  if (!res.ok || !json || json.success === false)
    throw new AccountError('Could not load quotes.', res.status);
  return { items: json.data ?? [], total: json.meta?.total ?? 0 };
}

/** What accepting a quote did. Accepting places the order (sparx persona issue
 *  085): `order` is it, `held` when it waits for someone to sign it off, and
 *  `signOff` who that is (sparx persona issue 087).
 *  `orderProblem` is the reason when the quote was accepted but its order could
 *  not be made, which the business has been told about. */
export interface AcceptedQuote {
  id: string;
  order: { id: string; orderNumber: string; held: boolean; signOff?: SignOffView | null } | null;
  orderProblem: string | null;
}

export async function acceptB2bQuote(
  tenantSlug: string,
  accountId: string,
  quoteId: string
): Promise<AcceptedQuote> {
  const res = await fetch(
    b2bPortalUrl(
      `/${encodeURIComponent(accountId)}/quotes/${encodeURIComponent(quoteId)}/accept`,
      tenantSlug
    ),
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }
  );
  return parse<AcceptedQuote>(res);
}

/** The branded page for a quote or invoice on this account, as the business
 *  prints it, for the buyer to print or save as a PDF (sparx persona issue 085).
 *  Null when it is not theirs to see or not ready yet. */
export async function getB2bDocumentHtml(
  tenantSlug: string,
  accountId: string,
  documentId: string
): Promise<string | null> {
  const res = await fetch(
    b2bPortalUrl(
      `/${encodeURIComponent(accountId)}/documents/${encodeURIComponent(documentId)}/print`,
      tenantSlug
    ),
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  return res.text();
}

export async function declineB2bQuote(
  tenantSlug: string,
  accountId: string,
  quoteId: string,
  reason?: string
): Promise<void> {
  const res = await fetch(
    b2bPortalUrl(
      `/${encodeURIComponent(accountId)}/quotes/${encodeURIComponent(quoteId)}/decline`,
      tenantSlug
    ),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(reason !== undefined ? { reason } : {}),
    }
  );
  await parse<{ id: string }>(res);
}

// ── Buying again on a trade account (sparx persona issue 086) ───────────────
//
// A quote request built up from the catalog (the account's one open request,
// kept on the server so it follows the buyer between devices), Order again, and
// the account's named saved carts. Anything that puts items into the cart sends
// the cart's own token, the same proof of ownership every cart write sends, and
// comes back with what went in and what did not.

/** Roles that can place orders on an account, and so build a quote request,
 *  keep saved carts and order again. The server checks the same two. */
export const ORDERING_ROLES: ReadonlySet<string> = new Set(['primary_contact', 'buyer']);

export interface QuoteRequestLine {
  id: string;
  /** Null for something typed in by hand. */
  variantId: string | null;
  description: string;
  quantity: number;
}

export interface QuoteRequest {
  id: string;
  /** `YYYY-MM-DD`, or null. */
  neededBy: string | null;
  deliverTo: string | null;
  deliveryNotes: string | null;
  poNumber: string | null;
  notes: string | null;
  startedBy: string | null;
  updatedAt: string;
  lines: QuoteRequestLine[];
}

export interface QuoteRequestInput {
  neededBy: string | null;
  deliverTo: string | null;
  deliveryNotes: string | null;
  poNumber: string | null;
  notes: string | null;
  lines: { variantId?: string | null; description?: string; quantity: number }[];
}

export interface RefillResult {
  added: { name: string; quantity: number; requested: number }[];
  skipped: {
    name: string;
    quantity: number;
    reason: 'not_sold' | 'out_of_stock' | 'limited';
    message: string;
  }[];
}

export interface SavedCart {
  id: string;
  name: string;
  itemCount: number;
  unitCount: number;
  savedBy: string | null;
  savedAt: string;
  updatedAt: string;
}

export interface B2bOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  placedAt: string;
  placedBy: string | null;
  poNumber: string | null;
  totals: {
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    surchargeCents: number;
    coreDepositCents: number;
    totalCents: number;
  };
  items: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    lineSubtotalCents: number;
  }[];
  /** Where a held order's sign-off stands, and whether the contact looking may
   *  approve or turn it down now (sparx persona issue 087). Null once the order
   *  is decided, and absent from an older api-rest. */
  signOff?: (SignOffView & { canDecide: boolean; limitCents: number | null }) | null;
  /** Approved, but the card held for it could not be charged, so it has gone
   *  ahead unpaid (sparx persona issue 087). Absent from an older api-rest. */
  cardNotCharged?: boolean;
}

/** One order on the account waiting for the signed-in approver's yes (sparx
 *  persona issue 087). */
export interface AccountApprovalItem {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  placedBy: string;
  poNumber: string | null;
  itemCount: number;
  /** The spending limit it went over. */
  limitCents: number | null;
  /** The business has to sign it off too. */
  businessToo: boolean;
}

/** What an approver's decision did. `placed` means theirs was the last yes
 *  needed; otherwise `waitingOn` says who is still to sign. */
export interface AccountDecisionResult {
  id: string;
  orderNumber: string;
  status: string;
  waitingOn?: SignOffSide[];
  /** Set when the yes placed the order and some of it was not in stock: which
   *  lines, and how many of each are owed (sparx persona issue 087). Null or
   *  absent when everything was there. */
  stock?: { lines: ApprovedStockLine[]; note: string } | null;
}

function accountPath(accountId: string, rest: string): string {
  return `/${encodeURIComponent(accountId)}${rest}`;
}

async function send<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  href: string,
  body?: unknown,
  withCartToken = false
): Promise<T> {
  const res = await fetch(href, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(withCartToken ? cartTokenHeader() : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  return parse<T>(res);
}

/** The account's open request (null when there is none, or for a role that
 *  cannot request quotes), and the name of the business it goes to. */
export async function getQuoteRequest(
  tenantSlug: string,
  accountId: string
): Promise<{ request: QuoteRequest | null; shopName: string | null }> {
  const res = await fetch(b2bPortalUrl(accountPath(accountId, '/quote-request'), tenantSlug), {
    cache: 'no-store',
  });
  return parse<{ request: QuoteRequest | null; shopName: string | null }>(res);
}

/** "Add to quote request" from a product page. */
export async function addToQuoteRequest(
  tenantSlug: string,
  accountId: string,
  variantId: string,
  quantity: number
): Promise<QuoteRequest> {
  const data = await send<{ request: QuoteRequest }>(
    'POST',
    b2bPortalUrl(accountPath(accountId, '/quote-request/items'), tenantSlug),
    { variantId, quantity }
  );
  return data.request;
}

export async function saveQuoteRequest(
  tenantSlug: string,
  accountId: string,
  input: QuoteRequestInput
): Promise<QuoteRequest> {
  const data = await send<{ request: QuoteRequest }>(
    'PUT',
    b2bPortalUrl(accountPath(accountId, '/quote-request'), tenantSlug),
    input
  );
  return data.request;
}

export async function discardQuoteRequest(tenantSlug: string, accountId: string): Promise<void> {
  await send('DELETE', b2bPortalUrl(accountPath(accountId, '/quote-request'), tenantSlug));
}

export async function submitQuoteRequest(
  tenantSlug: string,
  accountId: string
): Promise<{ id: string; number: string | null }> {
  return send('POST', b2bPortalUrl(accountPath(accountId, '/quote-request/submit'), tenantSlug));
}

export async function getB2bOrder(
  tenantSlug: string,
  accountId: string,
  orderId: string
): Promise<B2bOrderDetail> {
  const res = await fetch(
    b2bPortalUrl(accountPath(accountId, `/orders/${encodeURIComponent(orderId)}`), tenantSlug),
    { cache: 'no-store' }
  );
  return parse<B2bOrderDetail>(res);
}

/** The account's held orders waiting for this approver. Only an approver may
 *  ask: the server refuses every other role, so a page asks only for one. */
export async function getAccountApprovals(
  tenantSlug: string,
  accountId: string
): Promise<AccountApprovalItem[]> {
  const res = await fetch(b2bPortalUrl(accountPath(accountId, '/approvals'), tenantSlug), {
    cache: 'no-store',
  });
  return (await parse<{ items: AccountApprovalItem[] }>(res)).items;
}

/** Approve or turn down a held order for the account, with an optional reason. */
export async function decideAccountOrder(
  tenantSlug: string,
  accountId: string,
  orderId: string,
  decision: 'approve' | 'reject',
  reason?: string
): Promise<AccountDecisionResult> {
  return send(
    'POST',
    b2bPortalUrl(
      accountPath(accountId, `/orders/${encodeURIComponent(orderId)}/${decision}`),
      tenantSlug
    ),
    reason ? { reason } : {}
  );
}

/** Order again from the account's orders: the order's items into `cartId`. */
export async function reorderB2bOrder(
  tenantSlug: string,
  accountId: string,
  orderId: string,
  cartId: string
): Promise<RefillResult> {
  return send(
    'POST',
    b2bPortalUrl(
      accountPath(accountId, `/orders/${encodeURIComponent(orderId)}/reorder`),
      tenantSlug
    ),
    { cartId },
    true
  );
}

/** Order again from the shopper's own order pages. */
export async function reorderOwnOrder(
  tenantSlug: string,
  orderId: string,
  cartId: string
): Promise<RefillResult> {
  return send(
    'POST',
    url(`/v1/public/account/orders/${encodeURIComponent(orderId)}/reorder`, tenantSlug),
    { cartId },
    true
  );
}

export async function getSavedCarts(tenantSlug: string, accountId: string): Promise<SavedCart[]> {
  const res = await fetch(b2bPortalUrl(accountPath(accountId, '/saved-carts'), tenantSlug), {
    cache: 'no-store',
  });
  return (await parse<{ savedCarts: SavedCart[] }>(res)).savedCarts;
}

/** Save what is in `cartId` as one of the account's saved carts. */
export async function saveCartForAccount(
  tenantSlug: string,
  accountId: string,
  cartId: string,
  name: string
): Promise<SavedCart> {
  return send(
    'POST',
    b2bPortalUrl(accountPath(accountId, '/saved-carts'), tenantSlug),
    { cartId, name },
    true
  );
}

export async function renameSavedCart(
  tenantSlug: string,
  accountId: string,
  savedCartId: string,
  name: string
): Promise<void> {
  await send(
    'PATCH',
    b2bPortalUrl(
      accountPath(accountId, `/saved-carts/${encodeURIComponent(savedCartId)}`),
      tenantSlug
    ),
    { name }
  );
}

export async function deleteSavedCart(
  tenantSlug: string,
  accountId: string,
  savedCartId: string
): Promise<void> {
  await send(
    'DELETE',
    b2bPortalUrl(
      accountPath(accountId, `/saved-carts/${encodeURIComponent(savedCartId)}`),
      tenantSlug
    )
  );
}

/** A saved cart's items into `cartId`, priced today. */
export async function addSavedCartToCart(
  tenantSlug: string,
  accountId: string,
  savedCartId: string,
  cartId: string
): Promise<RefillResult> {
  return send(
    'POST',
    b2bPortalUrl(
      accountPath(accountId, `/saved-carts/${encodeURIComponent(savedCartId)}/add-to-cart`),
      tenantSlug
    ),
    { cartId },
    true
  );
}

// ── Estimates (direct-customer, non-B2B counterpart to B2B quotes) ───────────
// An estimate IS a BillingDocument on the system `customer-estimates` workflow
// — gated on the `invoicing` module. 404 (module disabled or route absent)
// means "not available to this tenant", not an error — callers treat it as
// an empty/unavailable state.

export interface EstimateEntry {
  id: string;
  number: string | null;
  stage: B2bQuoteStage;
  totalCents: number;
  currency: string;
  validUntil: string | null;
  createdAt: string;
}

export async function getEstimates(
  tenantSlug: string,
  skip = 0,
  take = 20
): Promise<{ items: EstimateEntry[]; total: number } | null> {
  const res = await fetch(
    `${url('/v1/public/commerce/account/estimates', tenantSlug)}&skip=${skip}&take=${take}`,
    { cache: 'no-store' }
  );
  if (res.status === 404) return null;
  const json = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: EstimateEntry[];
    meta?: { total?: number };
  } | null;
  if (!res.ok || !json || json.success === false)
    throw new AccountError('Could not load estimates.', res.status);
  return { items: json.data ?? [], total: json.meta?.total ?? 0 };
}

export async function submitEstimate(
  tenantSlug: string,
  input: { customerNote?: string; lines: B2bQuoteLineInput[] }
): Promise<{ id: string; number: string | null }> {
  const res = await fetch(url('/v1/public/commerce/account/estimates', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parse<{ id: string; number: string | null }>(res);
}

export async function acceptEstimate(tenantSlug: string, estimateId: string): Promise<void> {
  const res = await fetch(
    url(
      `/v1/public/commerce/account/estimates/${encodeURIComponent(estimateId)}/accept`,
      tenantSlug
    ),
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }
  );
  await parse<{ id: string }>(res);
}

export async function declineEstimate(
  tenantSlug: string,
  estimateId: string,
  reason?: string
): Promise<void> {
  const res = await fetch(
    url(
      `/v1/public/commerce/account/estimates/${encodeURIComponent(estimateId)}/decline`,
      tenantSlug
    ),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(reason !== undefined ? { reason } : {}),
    }
  );
  await parse<{ id: string }>(res);
}

// ── Bookings (Scheduling module portal, docs/79 §15 Phase 3c) ─────────────────

export interface CustomerBooking {
  id: string;
  serviceId: string;
  serviceName: string;
  bookingType: string;
  status: string;
  startAt: string;
  endAt: string;
  timezone: string;
  durationMinutes: number;
  partySize: number | null;
  staff: string[];
  notes: string | null;
  cancellationReason: string | null;
  canCancel: boolean;
  canReschedule: boolean;
  /** "Add to calendar" links (docs/79 §8.1); null for a cancelled/missed booking. */
  calendar: { ics: string; google: string; outlook: string } | null;
}

export async function getMyBookings(
  tenantSlug: string,
  scope: 'upcoming' | 'past' | 'all' = 'upcoming',
  page = 1,
  pageSize = 20
): Promise<{ items: CustomerBooking[]; total: number; totalPages: number }> {
  const res = await fetch(
    `${url('/v1/public/scheduling/account/bookings', tenantSlug)}&scope=${scope}&page=${page}&pageSize=${pageSize}`,
    { cache: 'no-store' }
  );
  const json = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: CustomerBooking[];
    meta?: { total?: number; total_pages?: number };
  } | null;
  if (!res.ok || !json || json.success === false) {
    throw new AccountError('Could not load bookings.', res.status);
  }
  return {
    items: json.data ?? [],
    total: json.meta?.total ?? 0,
    totalPages: json.meta?.total_pages ?? 1,
  };
}

export async function cancelMyBooking(
  tenantSlug: string,
  bookingId: string,
  reason?: string
): Promise<CustomerBooking> {
  const res = await fetch(
    url(
      `/v1/public/scheduling/account/bookings/${encodeURIComponent(bookingId)}/cancel`,
      tenantSlug
    ),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      cache: 'no-store',
    }
  );
  return parse<CustomerBooking>(res);
}

export async function rescheduleMyBooking(
  tenantSlug: string,
  bookingId: string,
  startAt: string
): Promise<CustomerBooking> {
  const res = await fetch(
    url(
      `/v1/public/scheduling/account/bookings/${encodeURIComponent(bookingId)}/reschedule`,
      tenantSlug
    ),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt }),
      cache: 'no-store',
    }
  );
  return parse<CustomerBooking>(res);
}

// ── Saved cards + repeat orders (docs/142 §9) ───────────────────────────────

// The card itself never passes through here. `beginCardSetup` returns what the
// gateway's own browser SDK needs; the SDK collects the card and hands back a
// reference, which `completeCardSetup` exchanges for a stored card. sparx only
// ever sees a token plus "Visa ending 4242".

export interface SavedCard {
  id: string;
  gatewayId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  status: string;
  isExpired: boolean;
  /** How many repeat orders renew on this card — why removing it can be refused. */
  subscriptionCount: number;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CardSetupSession {
  clientSecret: string | null;
  redirectUrl: string | null;
  publishableKey?: string;
  setupRef: string;
}

export async function getSavedCards(
  tenantSlug: string
): Promise<{ methods: SavedCard[]; canSave: boolean }> {
  const res = await fetch(url('/v1/public/commerce/account/payment-methods', tenantSlug), {
    cache: 'no-store',
  });
  return parse<{ methods: SavedCard[]; canSave: boolean }>(res);
}

export async function beginCardSetup(
  tenantSlug: string,
  returnUrl?: string
): Promise<CardSetupSession> {
  const res = await fetch(url('/v1/public/commerce/account/payment-methods/setup', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(returnUrl ? { returnUrl } : {}),
  });
  return parse<CardSetupSession>(res);
}

export async function completeCardSetup(
  tenantSlug: string,
  input: { setupRef?: string; token?: string; makeDefault?: boolean }
): Promise<SavedCard | null> {
  const res = await fetch(url('/v1/public/commerce/account/payment-methods/complete', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await parse<{ method: SavedCard | null }>(res)).method;
}

export async function setDefaultCard(tenantSlug: string, cardId: string): Promise<void> {
  await fetch(
    url(
      `/v1/public/commerce/account/payment-methods/${encodeURIComponent(cardId)}/default`,
      tenantSlug
    ),
    { method: 'POST' }
  );
}

export async function removeSavedCard(tenantSlug: string, cardId: string): Promise<void> {
  const res = await fetch(
    url(`/v1/public/commerce/account/payment-methods/${encodeURIComponent(cardId)}`, tenantSlug),
    { method: 'DELETE' }
  );
  // Parsed rather than ignored: removing a card that a repeat order depends on
  // is refused with a message naming how many, and the customer needs to read it.
  await parse<{ ok: boolean }>(res);
}

export interface MySubscription {
  id: string;
  status: string;
  nextOccurrenceAt: string | null;
  itemCount: number;
  monthlyRecurringRevenueCents: number;
  /**
   * How often it goes out, and what is charged EACH TIME.
   *
   * A customer's own page said "$29.00 a month" beside "Next order 20/01/2027"
   * about a repeat order that charges her $58.00 every two months: the monthly
   * average was the only figure the payload carried, so the page printed it
   * next to a real date (issue 795).
   */
  intervalUnit: string;
  intervalCount: number;
  cycleAmountCents: number;
  currency: string;
  billingMode: string;
  /** What is in it, so a customer recognizes it as theirs (issue 739). Optional
   *  for an api-rest that predates it. */
  lines?: { name: string; variantTitle: string | null; quantity: number }[];
  /** The saved card it renews on, when it charges one. */
  card?: { brand: string | null; last4: string | null } | null;
}

export async function getMySubscriptions(tenantSlug: string): Promise<MySubscription[]> {
  const res = await fetch(url('/v1/public/commerce/account/subscriptions', tenantSlug), {
    cache: 'no-store',
  });
  return (await parse<{ subscriptions: MySubscription[] }>(res)).subscriptions;
}

export async function setSubscriptionCard(
  tenantSlug: string,
  subscriptionId: string,
  paymentMethodId: string
): Promise<void> {
  await fetch(
    url(
      `/v1/public/commerce/account/subscriptions/${encodeURIComponent(subscriptionId)}/payment-method`,
      tenantSlug
    ),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ billingMode: 'card', paymentMethodId }),
    }
  );
}

/**
 * Pause, resume, skip the next delivery, or cancel a repeat order (issue 739).
 * Each is refused by the API unless the repeat order is the signed-in
 * customer's, and a refusal ("only a repeat order that is running can skip a
 * delivery") is thrown with its own words so the page can show them.
 */
export async function changeMySubscription(
  tenantSlug: string,
  subscriptionId: string,
  action: 'pause' | 'resume' | 'skip' | 'cancel'
): Promise<void> {
  const res = await fetch(
    url(
      `/v1/public/commerce/account/subscriptions/${encodeURIComponent(subscriptionId)}/${action}`,
      tenantSlug
    ),
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }
  );
  await parse<{ id: string }>(res);
}

/* ── Support requests (docs/144 §7) ─────────────────────────────────────────
 *
 * What a customer is allowed to know about their own request. Deliberately
 * narrower than the staff view: no reply deadline, no warn/breach stamps, no
 * assignee, no internal notes, no tags. `answered` and `settledAt` are the two
 * facts a person actually wants — has anyone got back to me, and is it done.
 * The API decides that boundary (see `toRequestDto`); this type just matches it.
 */
export interface MyRequest {
  id: string;
  number: number;
  subject: string;
  description: string | null;
  /** The business's OWN word for where it stands ("New", "Waiting on you"). */
  stage: string | null;
  /** Derived from the stage TYPE, because stage names are the tenant's words
   *  and the UI cannot branch on those. */
  state: 'open' | 'settled';
  openedAt: string;
  answered: boolean;
  settledAt: string | null;
}

export async function getMyRequests(
  tenantSlug: string,
  scope: 'open' | 'settled' | 'all' = 'open',
  page = 1,
  pageSize = 20
): Promise<{ items: MyRequest[]; total: number; totalPages: number }> {
  const res = await fetch(
    `${url('/v1/public/crm/account/requests', tenantSlug)}&scope=${scope}&page=${String(page)}&pageSize=${String(pageSize)}`,
    { cache: 'no-store' }
  );
  const json = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: MyRequest[];
    meta?: { total?: number; total_pages?: number };
  } | null;
  if (!res.ok || !json || json.success === false) {
    throw new AccountError('Could not load your requests.', res.status);
  }
  return {
    items: json.data ?? [],
    total: json.meta?.total ?? 0,
    totalPages: json.meta?.total_pages ?? 1,
  };
}

export async function openMyRequest(
  tenantSlug: string,
  input: { subject: string; message: string }
): Promise<MyRequest> {
  const res = await fetch(url('/v1/public/crm/account/requests', tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  return parse<MyRequest>(res);
}

/** Add to a request already raised. Never counts as the business replying — the
 *  service is explicit about that, so chasing an unanswered request cannot make
 *  it look answered. */
export async function replyToMyRequest(
  tenantSlug: string,
  requestId: string,
  message: string
): Promise<void> {
  const res = await fetch(
    url(`/v1/public/crm/account/requests/${encodeURIComponent(requestId)}/replies`, tenantSlug),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
      cache: 'no-store',
    }
  );
  await parse<{ recorded: boolean }>(res);
}
