'use client';

// Client-side cart state. Holds the cart id + guest token + line snapshot and
// exposes optimistic mutations against the public cart API (via the same-origin
// /api/sparx proxy). Cart creation issues an opaque guest token that the API
// checks via the `x-cart-token` header; we persist both id + token in
// localStorage and replay the token on every call. On mount we hydrate.
//
// A basket that has already been bought answers 410 `CART_ALREADY_BOUGHT` to a
// read and to every change (sparx persona issue 087). That is not an error to
// show: the provider forgets it, and the next thing added starts a fresh one.
// An add, a code or a refill that met it is tried once more on the new basket,
// so the buyer's click still does what they asked.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { RepeatCadence } from '@wizeworks/commerce-schemas';

import type { CartAccountRules } from '@/lib/account-buying-rules';
import { errorCodeOf, isBoughtCart, isBoughtCartError } from '@/lib/bought-cart';
import { mediaUrl } from '@/lib/media';
import { stockRefusalOf, stockRefusalSentence } from '@/lib/stock-refusal-words';
import {
  cartReadOutcome,
  failureMessage,
  isTransientStatus,
  retryDelayMs,
  SHOP_UNREACHABLE_MESSAGE,
} from '@/lib/shop-reach';
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
  /** Refundable core deposit per unit on a rebuilt part, on top of the price and
   *  not in `lineTotalCents`; null = no core (sparx issue 051). */
  coreChargeCents: number | null;
  /** Bought by sending the old part first: no deposit, and it ships when the old
   *  part arrives (issue 057). */
  coreFirst: boolean;
  /** Set when the part can be bought EITHER way, so the basket can offer the
   *  switch; `depositCents` is what paying the deposit costs per unit. */
  coreChoice: { depositCents: number } | null;
  /** Delivered again on this schedule; null = bought once (issue 739). */
  repeat: RepeatCadence | null;
  /** Schedules this line can switch to. Empty = buy once only. */
  repeatOptions: RepeatCadence[];
}

export interface CartTotals {
  subtotalCents: number;
  discountTotalCents: number;
  shippingTotalCents: number;
  taxTotalCents: number;
  /** Already SUBTRACTED inside totalCents. Kept as its own figure so a summary
   *  can name the money rather than leave a gap: rows that do not add up to the
   *  total under them read as a broken page, and this is what closed it. */
  giftCardAppliedCents: number;
  accountCreditAppliedCents: number;
  /** Refundable core deposits on rebuilt parts. INSIDE totalCents, never in the
   *  subtotal: named so the rows add up to the total under them. */
  coreChargeTotalCents: number;
  // Disclosed only at checkout (docs/48 §6) once a payment method is known; the
  // cart itself carries no surcharge, so this is absent in cart context.
  surchargeTotalCents?: number;
  totalCents: number;
}

/** Made to order (issue 026). An ordinary basket reads as no notice and the
 *  whole total due now, which is what every screen assumed before this. */
export interface CartMadeToOrder {
  /** `YYYY-MM-DD` in the SHOP's zone, or null when nothing needs notice. Null
   *  is not "ready today" and must not be rendered as one. */
  readyOn: string | null;
  noticeDays: number | null;
  dueNowCents: number;
  balanceCents: number;
  depositCents: number;
}

export const NOTHING_MADE_TO_ORDER: CartMadeToOrder = {
  readyOn: null,
  noticeDays: null,
  dueNowCents: 0,
  balanceCents: 0,
  depositCents: 0,
};

export interface CartState {
  cartId: string | null;
  lines: CartLine[];
  totals: CartTotals;
  /** Made to order (issue 026) — the day the basket can be collected and how
   *  the money splits between checkout and collection. */
  madeToOrder: CartMadeToOrder;
  /** A signed-in trade contact's account rules on this basket: whether they may
   *  order, each line's minimum, maximum and case pack, and any shortfall under
   *  the account minimum. Null for everybody else (sparx persona issue 086). */
  accountRules: CartAccountRules | null;
  appliedDiscountCodes: string[];
  /** The gift card reserved against this basket. A list because the discount
   *  codes beside it are one and the two are read together; the basket models a
   *  single card. */
  appliedGiftCardCodes: string[];
  count: number;
  currency: string;
  loading: boolean;
  /**
   * Whether the cart has been LOOKED FOR yet.
   *
   * `cartId === null` is two different facts wearing one face: "this shopper
   * has no cart" and "we have not read storage yet". Checkout read it as the
   * second and waited forever — a shopper who opened /checkout with nothing in
   * the basket got the whole form, a $0.00 total, and a submit button stuck on
   * "Saving…" with no message, because the session it waits for cannot be
   * opened without a cart. This is the fact that tells them apart.
   */
  known: boolean;
  /**
   * The last read of the cart got no answer (api-rest restarting, a network
   * blip). Says nothing about the basket: the stored cart is kept and read
   * again on its own. Before this, a blip on page load set `known` over no
   * lines, and checkout drew "your cart is empty" over a full basket (sparx
   * persona issue 086).
   */
  unreachable: boolean;
  drawerOpen: boolean;
}

export interface CartContextValue extends CartState {
  /** `repeat` asks for this to be delivered again on a schedule (issue 739);
   *  `coreFirst` buys a rebuilt part by sending the old part first (issue 057). */
  addItem: (
    variantId: string,
    quantity?: number,
    repeat?: RepeatCadence,
    coreFirst?: boolean
  ) => Promise<void>;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
  /** Change how often a line repeats; null makes it a one-off again. */
  setRepeat: (lineId: string, repeat: RepeatCadence | null) => Promise<void>;
  /** Switch a rebuilt part between paying the core deposit (false) and sending the
   *  old part first (true). Only offered on a line whose `coreChoice` is set. */
  setCoreFirst: (lineId: string, coreFirst: boolean) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  /** Apply whatever is printed on the code the shopper is holding. The server
   *  decides whether it is a discount or a gift card, because she cannot and
   *  should not have to. */
  applyCode: (
    code: string
  ) => Promise<{ ok: boolean; kind?: 'discount' | 'gift_card'; error?: string }>;
  removeDiscount: (code: string) => Promise<void>;
  removeGiftCard: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
  /** This shopper's cart id, creating the cart when there is none yet. For a
   *  caller that fills the cart on the server (Order again, a saved cart, sparx
   *  persona issue 086) and then calls `refresh`. */
  ensureCart: () => Promise<string>;
  /** Run a server-side fill (Order again, a saved cart) against this shopper's
   *  cart. When the cart it had turns out to be already bought, it is
   *  forgotten and the fill runs once more on a fresh one (sparx persona issue
   *  087). */
  fillCart: <T>(run: (cartId: string) => Promise<T>) => Promise<T>;
  /** Clear local cart state after an order completes. */
  reset: () => void;
}

/** Thrown by cart mutations when the API rejects the change, so callers can show
 *  the shopper a real message instead of failing silently. `status` is the HTTP
 *  status — 409 means the variant went out of stock under a `deny` policy. */
export class CartError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CartError';
    this.status = status;
  }
}

/** The server's own words out of a 422 envelope, when it wrote any. Null on
 *  anything unreadable, so the caller falls back to its generic line rather
 *  than showing a shopper an empty message or a parse error. */
async function validationMessage(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } };
    const said = body.error?.message;
    return typeof said === 'string' && said.trim() !== '' ? said : null;
  } catch {
    return null;
  }
}

/** Why a cart change was refused, in words the shopper can act on: the server's
 *  own on a 422, "could not reach the shop" when the request got no answer, and
 *  the caller's line otherwise. */
async function refusal(res: Response, fallback: string): Promise<string> {
  if (res.status === 422) {
    const said = await validationMessage(res);
    if (said) return said;
  }
  // Refused for stock: "sold out" only when nothing is left, and how many are
  // when some are (see stock-refusal-words.ts).
  if (res.status === 409) {
    const stock = stockRefusalOf(await res.json().catch(() => null));
    if (stock) return stockRefusalSentence(stock);
  }
  return isTransientStatus(res.status) ? SHOP_UNREACHABLE_MESSAGE : fallback;
}

/** Whether a refused cart call means the basket was already bought. Read off a
 *  clone, so the caller can still read the body for its own message. */
async function boughtCartAnswer(res: Response): Promise<boolean> {
  if (res.status !== 410) return false;
  const body: unknown = await res
    .clone()
    .json()
    .catch(() => null);
  return isBoughtCart(res.status, errorCodeOf(body));
}

/** `fetch`, with a request that never left the browser reported as the shop
 *  being out of reach rather than as "Failed to fetch". */
async function send(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new CartError(SHOP_UNREACHABLE_MESSAGE, 0);
  }
}

const EMPTY_TOTALS: CartTotals = {
  subtotalCents: 0,
  discountTotalCents: 0,
  shippingTotalCents: 0,
  taxTotalCents: 0,
  giftCardAppliedCents: 0,
  accountCreditAppliedCents: 0,
  coreChargeTotalCents: 0,
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
    madeToOrder: NOTHING_MADE_TO_ORDER,
    accountRules: null,
    appliedDiscountCodes: [],
    appliedGiftCardCodes: [],
    count: 0,
    currency,
    loading: false,
    known: false,
    unreachable: false,
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

  // Drop the stored cart and everything drawn from it, leaving the drawer as it
  // is. What `reset` does after an order completes in this tab, and what a
  // basket found bought, from another tab or another device, needs too: before
  // this a cart read that came back gone forgot the id and left its lines on
  // screen.
  const forget = useCallback(() => {
    persist(null, null);
    setState((s) => ({
      ...s,
      cartId: null,
      lines: [],
      totals: EMPTY_TOTALS,
      madeToOrder: NOTHING_MADE_TO_ORDER,
      accountRules: null,
      appliedDiscountCodes: [],
      appliedGiftCardCodes: [],
      count: 0,
      loading: false,
      known: true,
      unreachable: false,
    }));
  }, [persist]);

  const authHeaders = useCallback(
    (): Record<string, string> => (tokenRef.current ? { 'x-cart-token': tokenRef.current } : {}),
    []
  );

  const applyApi = useCallback(
    (data: CartApiShape) =>
      setState((s) => ({
        ...s,
        ...fromApi(data, tenantSlug),
        loading: false,
        known: true,
        unreachable: false,
      })),
    [tenantSlug]
  );

  // Reads in a row that got no answer; what schedules the next retry below.
  const [misses, setMisses] = useState(0);

  const refresh = useCallback(async () => {
    const id = cartIdRef.current;
    if (!id) return;
    setState((s) => ({ ...s, loading: true }));
    let outcome: ReturnType<typeof cartReadOutcome>;
    try {
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/cart/${id}?tenant=${encodeURIComponent(tenantSlug)}`,
        { headers: authHeaders(), cache: 'no-store' }
      );
      outcome = cartReadOutcome(res.status);
      if (outcome === 'loaded') {
        applyApi(((await res.json()) as { data: CartApiShape }).data);
        setMisses(0);
        return;
      }
    } catch {
      outcome = 'retry';
    }
    if (outcome === 'retry') {
      // No answer is not an empty basket. Keep the stored cart, leave `known`
      // as it was, and ask again (persona issue 086).
      setState((s) => ({ ...s, loading: false, unreachable: true }));
      setMisses((n) => n + 1);
      return;
    }
    setMisses(0);
    if (outcome === 'gone') {
      forget();
      return;
    }
    setState((s) => ({ ...s, loading: false, known: true, unreachable: false }));
  }, [applyApi, authHeaders, forget, tenantSlug]);

  // Cart and checkout say "this page will try again" while the read has no
  // answer, and this keeps that promise: a backing-off timer, plus at once when
  // the browser comes back online or the tab is looked at again.
  useEffect(() => {
    if (!state.unreachable) return;
    const timer = window.setTimeout(() => void refresh(), retryDelayMs(misses - 1));
    const now = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', now);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', now);
      document.removeEventListener('visibilitychange', now);
    };
  }, [state.unreachable, misses, refresh]);

  useEffect(() => {
    let stored = false;
    try {
      const id = localStorage.getItem(ID_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      if (id && token) {
        stored = true;
        cartIdRef.current = id;
        tokenRef.current = token;
        void refresh();
      }
    } catch {
      /* ignore */
    }
    // Nothing stored is an ANSWER, not a gap: this shopper has no cart. Said
    // out loud so checkout can stop waiting for one.
    if (!stored) setState((s) => ({ ...s, known: true }));
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
    const res = await send(`${API_BASE}/v1/public/commerce/cart?${qs.toString()}`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new CartError(
        await refusal(res, 'Sorry, we couldn’t start your cart. Please try again.'),
        res.status
      );
    }
    const json = (await res.json()) as { data: CartApiShape & { token: string } };
    persist(json.data.cartId, json.data.token);
    applyApi(json.data);
    return json.data.cartId;
  }, [applyApi, persist, tenantSlug, propertySlug]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1, repeat?: RepeatCadence, coreFirst = false) => {
      const post = async () =>
        send(
          `${API_BASE}/v1/public/commerce/cart/${await ensureCart()}/items?tenant=${encodeURIComponent(tenantSlug)}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              variantId,
              quantity,
              ...(repeat ? { repeat } : {}),
              ...(coreFirst ? { coreFirst: true } : {}),
            }),
          }
        );
      let res = await post();
      // The basket this browser held was already bought: start a fresh one and
      // put the item in that, which is what the buyer asked for.
      if (await boughtCartAnswer(res)) {
        forget();
        res = await post();
      }
      if (!res.ok) {
        // Surface the failure — do NOT open the drawer or resolve as if it worked.
        // The silica buy-box form behavior awaits this promise and settles its
        // visible state (success/error) from it, and <ProductDetail> catches it to
        // show an inline message. Swallowing the error here (the old `if (res.ok)`
        // + unconditional drawer-open) is exactly what made a sold-out add read as
        // a false "Submitted." with an empty cart — BUG-001. The server's 409
        // message is developer-facing, so map to shopper-friendly copy.
        // A 422 carries a message written FOR the shopper — "only 4 left for
        // today, there will be more tomorrow" (issue 026). Replacing it with
        // "please try again" sends somebody to retry a thing that cannot work
        // until tomorrow, which is worse than saying nothing.
        throw new CartError(
          await refusal(
            res,
            res.status === 409
              ? 'Sorry, this item just sold out.'
              : 'Sorry, we couldn’t add that to your cart. Please try again.'
          ),
          res.status
        );
      }
      applyApi(((await res.json()) as { data: CartApiShape }).data);
      setState((s) => ({ ...s, drawerOpen: true }));
    },
    [applyApi, authHeaders, ensureCart, forget, tenantSlug]
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      const id = cartIdRef.current;
      if (!id) return;
      const res = await send(
        `${API_BASE}/v1/public/commerce/cart/${id}/items/${lineId}?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ quantity }),
        }
      );
      if (res.ok) {
        applyApi(((await res.json()) as { data: CartApiShape }).data);
        return;
      }
      // Already bought: the line belongs to an order now, so there is nothing
      // here to change. The basket empties instead of showing an error.
      if (await boughtCartAnswer(res)) {
        forget();
        return;
      }
      // Raising a quantity can be refused for the same reason adding one can
      // (issue 026). The stepper's caller shows this; without it the number
      // silently snapped back with no explanation.
      throw new CartError(
        await refusal(res, 'Sorry, we couldn’t change that. Please try again.'),
        res.status
      );
    },
    [applyApi, authHeaders, forget, tenantSlug]
  );

  const setRepeat = useCallback(
    async (lineId: string, repeat: RepeatCadence | null) => {
      const id = cartIdRef.current;
      if (!id) return;
      const line = state.lines.find((l) => l.id === lineId);
      if (!line) return;
      const res = await send(
        `${API_BASE}/v1/public/commerce/cart/${id}/items/${lineId}?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ quantity: line.quantity, repeat }),
        }
      );
      if (res.ok) {
        applyApi(((await res.json()) as { data: CartApiShape }).data);
        return;
      }
      if (await boughtCartAnswer(res)) {
        forget();
        return;
      }
      throw new CartError(
        await refusal(res, 'Sorry, we couldn’t change that. Please try again.'),
        res.status
      );
    },
    [applyApi, authHeaders, forget, state.lines, tenantSlug]
  );

  const setCoreFirst = useCallback(
    async (lineId: string, coreFirst: boolean) => {
      const id = cartIdRef.current;
      if (!id) return;
      const line = state.lines.find((l) => l.id === lineId);
      if (!line) return;
      const res = await send(
        `${API_BASE}/v1/public/commerce/cart/${id}/items/${lineId}?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ quantity: line.quantity, coreFirst }),
        }
      );
      if (res.ok) {
        applyApi(((await res.json()) as { data: CartApiShape }).data);
        return;
      }
      if (await boughtCartAnswer(res)) {
        forget();
        return;
      }
      // The business can stop offering the send-first way after the part went in
      // the basket; the cart says so in words a shopper can act on.
      throw new CartError(
        await refusal(res, 'Sorry, we couldn’t change that. Please try again.'),
        res.status
      );
    },
    [applyApi, authHeaders, forget, state.lines, tenantSlug]
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      const id = cartIdRef.current;
      if (!id) return;
      const res = await send(
        `${API_BASE}/v1/public/commerce/cart/${id}/items/${lineId}?tenant=${encodeURIComponent(tenantSlug)}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      if (res.ok) applyApi(((await res.json()) as { data: CartApiShape }).data);
      else if (await boughtCartAnswer(res)) forget();
    },
    [applyApi, authHeaders, forget, tenantSlug]
  );

  // One box, either kind of code. A shopper handed a gift card types it into the
  // only code box on the page; when that box was a DISCOUNT box she was told
  // there was no such discount, and the money on a live card was unreachable.
  // The server tries both and says which it was, so the reply can name what
  // happened instead of just changing a number.
  const applyCode = useCallback(
    async (
      code: string
    ): Promise<{ ok: boolean; kind?: 'discount' | 'gift_card'; error?: string }> => {
      const post = async () =>
        send(
          `${API_BASE}/v1/public/commerce/cart/${await ensureCart()}/code?tenant=${encodeURIComponent(tenantSlug)}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ code }),
          }
        );
      let res = await post();
      // The basket was already bought: the code goes on a fresh one.
      if (await boughtCartAnswer(res)) {
        forget();
        res = await post();
      }
      if (res.ok) {
        const data = ((await res.json()) as { data: CartApiShape & { kind?: string } }).data;
        applyApi(data);
        return { ok: true, kind: data.kind === 'gift_card' ? 'gift_card' : 'discount' };
      }
      const err = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      // A blip is not a bad code: "That code can’t be applied" sent somebody
      // holding a good one away from it (persona issue 086).
      return {
        ok: false,
        error: failureMessage(res.status, err?.error, 'That code can’t be applied.'),
      };
    },
    [applyApi, authHeaders, ensureCart, forget, tenantSlug]
  );

  const removeGiftCard = useCallback(async () => {
    const id = cartIdRef.current;
    if (!id) return;
    const res = await send(
      `${API_BASE}/v1/public/commerce/cart/${id}/gift-card?tenant=${encodeURIComponent(tenantSlug)}`,
      { method: 'DELETE', headers: authHeaders() }
    );
    if (res.ok) applyApi(((await res.json()) as { data: CartApiShape }).data);
    else if (await boughtCartAnswer(res)) forget();
  }, [applyApi, authHeaders, forget, tenantSlug]);

  const removeDiscount = useCallback(
    async (code: string) => {
      const id = cartIdRef.current;
      if (!id) return;
      const res = await send(
        `${API_BASE}/v1/public/commerce/cart/${id}/discount/${encodeURIComponent(code)}?tenant=${encodeURIComponent(tenantSlug)}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      if (res.ok) applyApi(((await res.json()) as { data: CartApiShape }).data);
      else if (await boughtCartAnswer(res)) forget();
    },
    [applyApi, authHeaders, forget, tenantSlug]
  );

  // Order again and a saved cart fill the basket on the server. A basket found
  // already bought is forgotten and the fill runs once more on a fresh one, so
  // "Order again" right after an order still fills a basket.
  const fillCart = useCallback(
    async <T,>(run: (cartId: string) => Promise<T>): Promise<T> => {
      try {
        return await run(await ensureCart());
      } catch (err) {
        if (!isBoughtCartError(err)) throw err;
        forget();
        return run(await ensureCart());
      }
    },
    [ensureCart, forget]
  );

  const openDrawer = useCallback(() => setState((s) => ({ ...s, drawerOpen: true })), []);
  const closeDrawer = useCallback(() => setState((s) => ({ ...s, drawerOpen: false })), []);

  const reset = useCallback(() => {
    forget();
    setState((s) => ({ ...s, drawerOpen: false }));
  }, [forget]);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      addItem,
      updateItem,
      setRepeat,
      setCoreFirst,
      removeItem,
      applyCode,
      removeDiscount,
      removeGiftCard,
      openDrawer,
      closeDrawer,
      refresh,
      ensureCart,
      fillCart,
      reset,
    }),
    [
      state,
      addItem,
      updateItem,
      setRepeat,
      setCoreFirst,
      removeItem,
      applyCode,
      removeDiscount,
      removeGiftCard,
      openDrawer,
      closeDrawer,
      refresh,
      ensureCart,
      fillCart,
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
  appliedGiftCardCodes?: string[];
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
    coreChargeCents?: number | null;
    coreFirst?: boolean;
    coreChoice?: { depositCents: number } | null;
    repeat?: RepeatCadence | null;
    repeatOptions?: RepeatCadence[];
  }[];
  totals: {
    subtotalCents: number;
    discountTotalCents?: number;
    shippingTotalCents?: number;
    taxTotalCents?: number;
    giftCardAppliedCents?: number;
    accountCreditAppliedCents?: number;
    coreChargeTotalCents?: number;
    totalCents?: number;
  };
  madeToOrder?: Partial<CartMadeToOrder>;
  accountRules?: CartAccountRules | null;
}

function fromApi(
  data: CartApiShape,
  tenantSlug: string
): Omit<CartState, 'loading' | 'drawerOpen' | 'known' | 'unreachable'> {
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
    coreChargeCents: i.coreChargeCents ?? null,
    coreFirst: i.coreFirst ?? false,
    coreChoice: i.coreChoice ?? null,
    repeat: i.repeat ?? null,
    repeatOptions: i.repeatOptions ?? [],
  }));
  return {
    cartId: data.cartId,
    lines,
    appliedDiscountCodes: data.appliedDiscountCodes ?? [],
    appliedGiftCardCodes: data.appliedGiftCardCodes ?? [],
    totals: {
      subtotalCents: data.totals.subtotalCents,
      discountTotalCents: data.totals.discountTotalCents ?? 0,
      shippingTotalCents: data.totals.shippingTotalCents ?? 0,
      taxTotalCents: data.totals.taxTotalCents ?? 0,
      giftCardAppliedCents: data.totals.giftCardAppliedCents ?? 0,
      accountCreditAppliedCents: data.totals.accountCreditAppliedCents ?? 0,
      coreChargeTotalCents: data.totals.coreChargeTotalCents ?? 0,
      totalCents: data.totals.totalCents ?? data.totals.subtotalCents,
    },
    // Defaults mean "no deposit, everything due now" — the shape every cart had
    // before this existed, so an older response reads as an ordinary basket
    // rather than as one with nothing to pay.
    madeToOrder: {
      readyOn: data.madeToOrder?.readyOn ?? null,
      noticeDays: data.madeToOrder?.noticeDays ?? null,
      dueNowCents:
        data.madeToOrder?.dueNowCents ?? data.totals.totalCents ?? data.totals.subtotalCents,
      balanceCents: data.madeToOrder?.balanceCents ?? 0,
      depositCents: data.madeToOrder?.depositCents ?? 0,
    },
    // Absent from an older api-rest, which reads as "no account rules", the
    // same as every basket before them (sparx persona issue 086).
    accountRules: data.accountRules ?? null,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    currency: data.currency,
  };
}
