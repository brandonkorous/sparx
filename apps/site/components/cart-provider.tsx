'use client';

// Client-side cart state. Holds the cart id + guest token + line snapshot and
// exposes optimistic mutations against the public cart API (via the same-origin
// /api/sparx proxy). Cart creation issues an opaque guest token that the API
// checks via the `x-cart-token` header; we persist both id + token in
// localStorage and replay the token on every call. On mount we hydrate.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { mediaUrl } from '@/lib/media';
import { useCustomer } from '@/components/customer-provider';

// Same-origin proxy to api-rest (app/api/sparx/[...path]/route.ts) — keeps the
// cart token + future customer cookie first-party and sidesteps CORS.
const API_BASE = '/api/sparx';
const ID_KEY = 'sparx_cart_id';
const TOKEN_KEY = 'sparx_cart_token';

export interface CartLine {
  id: string;
  variantId: string;
  productHandle: string | null;
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
  // Disclosed only at checkout (docs/48 §6) once a payment method is known; the
  // cart itself carries no surcharge, so this is absent in cart context.
  surchargeTotalCents?: number;
  totalCents: number;
}

export interface CartState {
  cartId: string | null;
  lines: CartLine[];
  totals: CartTotals;
  appliedDiscountCodes: string[];
  count: number;
  currency: string;
  loading: boolean;
  drawerOpen: boolean;
}

export interface CartContextValue extends CartState {
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  applyDiscount: (code: string) => Promise<{ ok: boolean; error?: string }>;
  removeDiscount: (code: string) => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
  /** Clear local cart state after an order completes. */
  reset: () => void;
}

const EMPTY_TOTALS: CartTotals = {
  subtotalCents: 0,
  discountTotalCents: 0,
  shippingTotalCents: 0,
  taxTotalCents: 0,
  totalCents: 0,
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}

interface CartProviderProps {
  tenantSlug: string;
  /** Active site slug (docs/58 D1). Sent on cart creation so the order placed
   *  from this cart is tagged with its origin site. Omitted → no specific site. */
  propertySlug?: string;
  currency: string;
  children: React.ReactNode;
}

export function CartProvider({ tenantSlug, propertySlug, currency, children }: CartProviderProps) {
  const [state, setState] = useState<CartState>({
    cartId: null,
    lines: [],
    totals: EMPTY_TOTALS,
    appliedDiscountCodes: [],
    count: 0,
    currency,
    loading: false,
    drawerOpen: false,
  });
  const cartIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const persist = useCallback((id: string | null, token: string | null) => {
    cartIdRef.current = id;
    tokenRef.current = token;
    try {
      if (id) localStorage.setItem(ID_KEY, id);
      else localStorage.removeItem(ID_KEY);
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode / disabled storage */
    }
  }, []);

  const authHeaders = useCallback(
    (): Record<string, string> => (tokenRef.current ? { 'x-cart-token': tokenRef.current } : {}),
    []
  );

  const applyApi = useCallback(
    (data: CartApiShape) =>
      setState((s) => ({ ...s, ...fromApi(data, tenantSlug), loading: false })),
    [tenantSlug]
  );

  const refresh = useCallback(async () => {
    const id = cartIdRef.current;
    if (!id) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/cart/${id}?tenant=${encodeURIComponent(tenantSlug)}`,
        { headers: authHeaders(), cache: 'no-store' }
      );
      if (!res.ok) {
        if (res.status === 404 || res.status === 403) persist(null, null);
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const json = (await res.json()) as { data: CartApiShape };
      applyApi(json.data);
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [applyApi, authHeaders, persist, tenantSlug]);

  useEffect(() => {
    try {
      const id = localStorage.getItem(ID_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      if (id && token) {
        cartIdRef.current = id;
        tokenRef.current = token;
        void refresh();
      }
    } catch {
      /* ignore */
    }
  }, [refresh]);

  // A login/register may have consolidated this shopper's cart onto a new
  // identity server-side (CustomerProvider's cartHandoff — see its docblock):
  // adopt it so items priced retail while anonymous show correctly instead
  // of the cart silently appearing empty (its old cached id/token 404s once
  // the server has merged/deleted that cart — ownership is token-only).
  const { cartHandoff, clearCartHandoff } = useCustomer();
  useEffect(() => {
    if (!cartHandoff) return;
    persist(cartHandoff.cartId, cartHandoff.guestToken);
    void refresh();
    clearCartHandoff();
  }, [cartHandoff, clearCartHandoff, persist, refresh]);

  // Create a cart on first write, capturing the issued ownership token.
  const ensureCart = useCallback(async (): Promise<string> => {
    if (cartIdRef.current) return cartIdRef.current;
    // Tag the cart with the active site (docs/58 D1) so the resulting order
    // inherits its origin property.
    const qs = new URLSearchParams({ tenant: tenantSlug });
    if (propertySlug) qs.set('property', propertySlug);
    const res = await fetch(`${API_BASE}/v1/public/commerce/cart?${qs.toString()}`, {
      method: 'POST',
    });
    const json = (await res.json()) as { data: CartApiShape & { token: string } };
    persist(json.data.cartId, json.data.token);
    applyApi(json.data);
    return json.data.cartId;
  }, [applyApi, persist, tenantSlug, propertySlug]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      const id = await ensureCart();
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/cart/${id}/items?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ variantId, quantity }),
        }
      );
      if (res.ok) applyApi(((await res.json()) as { data: CartApiShape }).data);
      setState((s) => ({ ...s, drawerOpen: true }));
    },
    [applyApi, authHeaders, ensureCart, tenantSlug]
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      const id = cartIdRef.current;
      if (!id) return;
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/cart/${id}/items/${lineId}?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ quantity }),
        }
      );
      if (res.ok) applyApi(((await res.json()) as { data: CartApiShape }).data);
    },
    [applyApi, authHeaders, tenantSlug]
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      const id = cartIdRef.current;
      if (!id) return;
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/cart/${id}/items/${lineId}?tenant=${encodeURIComponent(tenantSlug)}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      if (res.ok) applyApi(((await res.json()) as { data: CartApiShape }).data);
    },
    [applyApi, authHeaders, tenantSlug]
  );

  const applyDiscount = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      const id = await ensureCart();
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/cart/${id}/discount?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ code }),
        }
      );
      if (res.ok) {
        applyApi(((await res.json()) as { data: CartApiShape }).data);
        return { ok: true };
      }
      const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { ok: false, error: err?.error?.message ?? 'That code can’t be applied.' };
    },
    [applyApi, authHeaders, ensureCart, tenantSlug]
  );

  const removeDiscount = useCallback(
    async (code: string) => {
      const id = cartIdRef.current;
      if (!id) return;
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/cart/${id}/discount/${encodeURIComponent(code)}?tenant=${encodeURIComponent(tenantSlug)}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      if (res.ok) applyApi(((await res.json()) as { data: CartApiShape }).data);
    },
    [applyApi, authHeaders, tenantSlug]
  );

  const openDrawer = useCallback(() => setState((s) => ({ ...s, drawerOpen: true })), []);
  const closeDrawer = useCallback(() => setState((s) => ({ ...s, drawerOpen: false })), []);

  const reset = useCallback(() => {
    persist(null, null);
    setState((s) => ({
      ...s,
      cartId: null,
      lines: [],
      totals: EMPTY_TOTALS,
      appliedDiscountCodes: [],
      count: 0,
      drawerOpen: false,
    }));
  }, [persist]);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      addItem,
      updateItem,
      removeItem,
      applyDiscount,
      removeDiscount,
      openDrawer,
      closeDrawer,
      refresh,
      reset,
    }),
    [
      state,
      addItem,
      updateItem,
      removeItem,
      applyDiscount,
      removeDiscount,
      openDrawer,
      closeDrawer,
      refresh,
      reset,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ── API shape mapping ──────────────────────────────────────────
interface CartApiShape {
  cartId: string;
  currency: string;
  appliedDiscountCodes?: string[];
  items: {
    id: string;
    variantId: string;
    productHandle?: string | null;
    title: string;
    variantTitle?: string | null;
    sku?: string;
    imageMediaId?: string | null;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  totals: {
    subtotalCents: number;
    discountTotalCents?: number;
    shippingTotalCents?: number;
    taxTotalCents?: number;
    totalCents?: number;
  };
}

function fromApi(
  data: CartApiShape,
  tenantSlug: string
): Omit<CartState, 'loading' | 'drawerOpen'> {
  const lines: CartLine[] = data.items.map((i) => ({
    id: i.id,
    variantId: i.variantId,
    productHandle: i.productHandle ?? null,
    title: i.title,
    variantTitle: i.variantTitle ?? null,
    sku: i.sku ?? '',
    imageUrl: mediaUrl(i.imageMediaId ?? null, tenantSlug),
    unitPriceCents: i.unitPriceCents,
    quantity: i.quantity,
    lineTotalCents: i.lineTotalCents,
  }));
  return {
    cartId: data.cartId,
    lines,
    appliedDiscountCodes: data.appliedDiscountCodes ?? [],
    totals: {
      subtotalCents: data.totals.subtotalCents,
      discountTotalCents: data.totals.discountTotalCents ?? 0,
      shippingTotalCents: data.totals.shippingTotalCents ?? 0,
      taxTotalCents: data.totals.taxTotalCents ?? 0,
      totalCents: data.totals.totalCents ?? data.totals.subtotalCents,
    },
    count: lines.reduce((n, l) => n + l.quantity, 0),
    currency: data.currency,
  };
}
