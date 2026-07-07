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

/** Auth result: the profile plus `recognized` — true when the account already
 *  existed on a SISTER site and a separate membership was just created here
 *  (docs/58 D6), which the UI surfaces as a one-time notice. */
export interface AuthResult {
  customer: Customer;
  recognized: boolean;
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
  const data = await parse<{ customer: Customer; recognized?: boolean }>(res);
  return { customer: data.customer, recognized: data.recognized ?? false };
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
  const data = await parse<{ customer: Customer; recognized?: boolean }>(res);
  return { customer: data.customer, recognized: data.recognized ?? false };
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

export interface B2bQuoteEntry {
  id: string;
  quoteNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  validUntil: string | null;
  createdAt: string;
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

// ── B2B Appointments ─────────────────────────────────────────────────────────

export interface B2bAppointmentEntry {
  id: string;
  serviceTypeId: string;
  serviceTypeName: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  vehicleRef: Record<string, unknown> | null;
  notes: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  customerName: string | null;
}

export async function getB2bAppointments(
  tenantSlug: string,
  accountId: string,
  skip = 0,
  take = 20,
  status?: string
): Promise<{ items: B2bAppointmentEntry[]; total: number }> {
  let url = `${b2bPortalUrl(`/${encodeURIComponent(accountId)}/appointments`, tenantSlug)}&skip=${skip}&take=${take}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: B2bAppointmentEntry[];
    meta?: { total?: number };
  } | null;
  if (!res.ok || !json || json.success === false)
    throw new AccountError('Could not load appointments.', res.status);
  return { items: json.data ?? [], total: json.meta?.total ?? 0 };
}

export async function cancelB2bAppointment(
  tenantSlug: string,
  accountId: string,
  appointmentId: string,
  reason?: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/v1/public/b2b/portal/${encodeURIComponent(accountId)}/appointments/${encodeURIComponent(appointmentId)}/cancel?tenant=${encodeURIComponent(tenantSlug)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new AccountError('Could not cancel appointment.', res.status);
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
