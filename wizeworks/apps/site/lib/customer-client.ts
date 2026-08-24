// Typed wrappers over the public customer-account API, via the same-origin
// /api/sparx proxy. The session is an httpOnly cookie set by api-rest and
// relayed by the proxy — so these calls just rely on the browser sending it
// (same-origin fetch includes cookies by default). On register/login we also
// forward the guest cart token so the server can claim the cart for the new
// session. See docs/27.

const API_BASE = '/api/sparx';
const CART_TOKEN_KEY = 'sparx_cart_token';

export interface Customer {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

export class AccountError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AccountError';
    this.status = status;
  }
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
    throw new AccountError(json?.error?.message ?? 'Something went wrong.', res.status);
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

/** Returns the current customer, or null if not signed in (401). */
export async function getMe(tenantSlug: string): Promise<Customer | null> {
  const res = await fetch(url('/v1/public/commerce/account/me', tenantSlug), {
    cache: 'no-store',
  });
  if (res.status === 401) return null;
  return (await parse<{ customer: Customer }>(res)).customer;
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
    lineTotalCents: number;
  }[];
  fulfillments: OrderFulfillmentView[];
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
  status: string;
  overdueDays: number;
  dueAt: string;
  paidAt: string | null;
  orderId: string | null;
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
  totalCents: number;
  currency: string;
  validUntil: string | null;
  createdAt: string;
}

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

/** Submit a new RFQ — a draft document + its requested lines, advanced
 *  straight to "Submitted" so it lands in the merchant's queue immediately. */
export async function submitB2bQuote(
  tenantSlug: string,
  accountId: string,
  input: { customerNote?: string; lines: B2bQuoteLineInput[] }
): Promise<{ id: string; number: string | null }> {
  const res = await fetch(b2bPortalUrl(`/${encodeURIComponent(accountId)}/quotes`, tenantSlug), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parse<{ id: string; number: string | null }>(res);
}

export async function acceptB2bQuote(
  tenantSlug: string,
  accountId: string,
  quoteId: string
): Promise<void> {
  const res = await fetch(
    b2bPortalUrl(
      `/${encodeURIComponent(accountId)}/quotes/${encodeURIComponent(quoteId)}/accept`,
      tenantSlug
    ),
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }
  );
  await parse<{ id: string }>(res);
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
  currency: string;
  billingMode: string;
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
