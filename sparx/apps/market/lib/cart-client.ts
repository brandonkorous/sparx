'use client';

// Client-side marketplace cart. sparx.market carts are SINGLE-MERCHANT (docs/72
// §5 Phase 1): a cart lives on one seller's tenant, and every cart/checkout call
// carries `?merchant=<merchantSlug>`. We persist {merchantSlug, cartId, token}
// in localStorage and replay `x-cart-token` on every request (the API issues an
// opaque ownership token at cart creation).
//
// All calls go through the same-origin /api/sparx proxy (app/api/sparx) so the
// browser never hits api-rest cross-origin (no CORS). The proxy forwards the
// query string + x-cart-token verbatim.

const API_BASE = '/api/sparx/v1/public/market';
const STORE_KEY = 'sparx_market_cart';

export interface CartItem {
  id: string;
  variantId: string;
  productSlug: string | null;
  title: string;
  variantTitle: string | null;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface CartTotals {
  subtotalCents: number;
  discountTotalCents: number;
  shippingTotalCents: number;
  taxTotalCents: number;
  surchargeTotalCents?: number;
  totalCents: number;
}

/** The cart shape returned by the market cart endpoints (post-resolution). */
export interface Cart {
  merchantSlug: string;
  cartId: string;
  token: string;
  items: CartItem[];
  totals: CartTotals;
  currency: string;
  appliedDiscountCodes: string[];
}

/** What we persist in localStorage — the ownership triple. The full line
 *  snapshot is always re-fetched from the API, never trusted from storage. */
export interface StoredCart {
  merchantSlug: string;
  cartId: string;
  token: string;
}

// ── Local persistence ────────────────────────────────────────────────────────

export function readStoredCart(): StoredCart | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCart>;
    if (parsed.merchantSlug && parsed.cartId && parsed.token) {
      return { merchantSlug: parsed.merchantSlug, cartId: parsed.cartId, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredCart(stored: StoredCart | null): void {
  try {
    if (stored) localStorage.setItem(STORE_KEY, JSON.stringify(stored));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode / disabled storage */
  }
}

export function clearStoredCart(): void {
  writeStoredCart(null);
}

// ── Transport ──────────────────────────────────────────────────────────────

interface RawCartItem {
  id: string;
  variantId: string;
  productSlug?: string | null;
  productHandle?: string | null;
  title: string;
  variantTitle?: string | null;
  sku?: string;
  imageUrl?: string | null;
  imageMediaId?: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

interface RawCart {
  cartId: string;
  token?: string;
  items: RawCartItem[];
  appliedDiscountCodes?: string[];
  totals: {
    subtotalCents: number;
    discountTotalCents?: number;
    shippingTotalCents?: number;
    taxTotalCents?: number;
    surchargeTotalCents?: number;
    totalCents?: number;
  };
  currency: string;
}

function withMerchant(path: string, merchantSlug: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${API_BASE}${path}${sep}merchant=${encodeURIComponent(merchantSlug)}`;
}

async function call<T>(
  url: string,
  token: string | null,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    cache: 'no-store',
    headers: {
      ...(token ? { 'x-cart-token': token } : {}),
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  const body = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: { message: string; code: string } }
    | null;
  if (!res.ok || !body || body.success === false) {
    const message = body?.success === false ? body.error.message : `Request failed (${res.status})`;
    throw new CartRequestError(message, res.status);
  }
  return body.data;
}

export class CartRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CartRequestError';
    this.status = status;
  }
}

function toCart(raw: RawCart, merchantSlug: string, token: string): Cart {
  return {
    merchantSlug,
    cartId: raw.cartId,
    token,
    currency: raw.currency,
    appliedDiscountCodes: raw.appliedDiscountCodes ?? [],
    items: raw.items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productSlug: i.productSlug ?? i.productHandle ?? null,
      title: i.title,
      variantTitle: i.variantTitle ?? null,
      sku: i.sku ?? '',
      // The market cart endpoint resolves images to absolute URLs server-side;
      // pass any value straight through (a bare id with no merchant context
      // can't be resolved here, so it's left as-is for the API to have filled).
      imageUrl: i.imageUrl ?? null,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.lineTotalCents,
    })),
    totals: {
      subtotalCents: raw.totals.subtotalCents,
      discountTotalCents: raw.totals.discountTotalCents ?? 0,
      shippingTotalCents: raw.totals.shippingTotalCents ?? 0,
      taxTotalCents: raw.totals.taxTotalCents ?? 0,
      ...(raw.totals.surchargeTotalCents !== undefined
        ? { surchargeTotalCents: raw.totals.surchargeTotalCents }
        : {}),
      totalCents: raw.totals.totalCents ?? raw.totals.subtotalCents,
    },
  };
}

// ── Operations ───────────────────────────────────────────────────────────────

/** Create a cart for a merchant and add the first item. Persists the issued
 *  ownership triple. */
export async function createCart(
  merchantSlug: string,
  variantId: string,
  quantity = 1
): Promise<Cart> {
  const raw = await call<RawCart & { token: string }>(withMerchant('/cart', merchantSlug), null, {
    method: 'POST',
    json: { variantId, quantity },
  });
  const cart = toCart(raw, merchantSlug, raw.token);
  writeStoredCart({ merchantSlug, cartId: cart.cartId, token: raw.token });
  return cart;
}

/** Fetch the current cart snapshot. Returns null on 404/403 (and clears the
 *  stale local pointer) so a purged cart silently resets. */
export async function fetchCart(stored: StoredCart): Promise<Cart | null> {
  try {
    const raw = await call<RawCart>(
      withMerchant(`/cart/${encodeURIComponent(stored.cartId)}`, stored.merchantSlug),
      stored.token,
      { method: 'GET' }
    );
    return toCart(raw, stored.merchantSlug, stored.token);
  } catch (err) {
    if (err instanceof CartRequestError && (err.status === 404 || err.status === 403)) {
      clearStoredCart();
      return null;
    }
    throw err;
  }
}

export async function addCartItem(
  stored: StoredCart,
  variantId: string,
  quantity = 1
): Promise<Cart> {
  const raw = await call<RawCart>(
    withMerchant(`/cart/${encodeURIComponent(stored.cartId)}/items`, stored.merchantSlug),
    stored.token,
    { method: 'POST', json: { variantId, quantity } }
  );
  return toCart(raw, stored.merchantSlug, stored.token);
}

export async function updateCartItem(
  stored: StoredCart,
  itemId: string,
  quantity: number
): Promise<Cart> {
  const raw = await call<RawCart>(
    withMerchant(
      `/cart/${encodeURIComponent(stored.cartId)}/items/${encodeURIComponent(itemId)}`,
      stored.merchantSlug
    ),
    stored.token,
    { method: 'PATCH', json: { quantity } }
  );
  return toCart(raw, stored.merchantSlug, stored.token);
}

export async function removeCartItem(stored: StoredCart, itemId: string): Promise<Cart> {
  const raw = await call<RawCart>(
    withMerchant(
      `/cart/${encodeURIComponent(stored.cartId)}/items/${encodeURIComponent(itemId)}`,
      stored.merchantSlug
    ),
    stored.token,
    { method: 'DELETE' }
  );
  return toCart(raw, stored.merchantSlug, stored.token);
}

/** Apply a discount code to the cart. Throws CartRequestError (400) with the API's
 *  message when the code is invalid/expired/ineligible. */
export async function applyDiscount(stored: StoredCart, code: string): Promise<Cart> {
  const raw = await call<RawCart>(
    withMerchant(`/cart/${encodeURIComponent(stored.cartId)}/discount`, stored.merchantSlug),
    stored.token,
    { method: 'POST', json: { code } }
  );
  return toCart(raw, stored.merchantSlug, stored.token);
}

/** Remove a previously-applied discount code from the cart. */
export async function removeDiscount(stored: StoredCart, code: string): Promise<Cart> {
  const raw = await call<RawCart>(
    withMerchant(
      `/cart/${encodeURIComponent(stored.cartId)}/discount/${encodeURIComponent(code)}`,
      stored.merchantSlug
    ),
    stored.token,
    { method: 'DELETE' }
  );
  return toCart(raw, stored.merchantSlug, stored.token);
}

export function cartItemCount(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.items.reduce((n, i) => n + i.quantity, 0);
}
