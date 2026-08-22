'use client';

// Carts data — an order someone started but has not paid for, including the ones
// they walked away from.
//
// This file OWNS the cart types and the ['commerce','carts'] query key. A cart is
// created by a shopper, never authored by staff, so this is a READ surface with
// one honest staff move on it: an abandoned cart can be marked recovered.
//
// Money is integer CENTS here (cached totals on the cart row), NOT the
// Decimal-as-string orders use — so the surfaces divide by 100 at the render
// edge and reuse `formatMoney` from ./data as the single money formatter.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** The buyer joined onto a cart, when the cart belongs to a signed-in customer.
 *  A guest cart has none — it is identified by a token instead. */
export interface CartCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
}

/** A row in the carts list. */
export interface CartRow {
  id: string;
  channel: string;
  currency: string;
  customerId: string | null;
  guestToken: string | null;
  subtotalCents: number;
  totalCents: number;
  itemCount: number;
  abandonedAt: string | null;
  recoveredAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  customer: CartCustomer | null;
}

export interface CartItemDetail {
  cartItemId: string;
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface CartTotalsDetail {
  subtotalCents: number;
  discountTotalCents: number;
  shippingTotalCents: number;
  taxTotalCents: number;
  giftCardAppliedCents: number;
  accountCreditAppliedCents: number;
  totalCents: number;
}

/** The full cart — its lines and priced totals. Returned by the detail read.
 *  `abandonedAt` distinguishes a live cart from a walked-away one; the list row
 *  carries `recoveredAt` too, which the detail read does not, so state on the
 *  detail pane is derived from `abandonedAt` plus what the list already knew. */
export interface CartDetail {
  cartId: string;
  customerId: string | null;
  customerName: string | null;
  channel: string;
  currency: string;
  items: CartItemDetail[];
  appliedDiscountCodes: string[];
  appliedGiftCardCodes: string[];
  accountCreditAppliedCents: number;
  totals: CartTotalsDetail;
  expiresAt: string;
  abandonedAt: string | null;
  /** Set when an abandoned cart was later recovered. The storefront snapshot
   *  omits this; the admin detail endpoint merges it in so a recovered cart
   *  reads correctly here instead of looking live again. */
  recoveredAt: string | null;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export const CARTS_KEY = ['commerce', 'carts'];

/** The three states the list filters by. `active` is a live, in-progress cart;
 *  `abandoned` was left without paying; `recovered` was abandoned and then came
 *  back. They map one-to-one onto the server's filter. */
export type CartFilter = 'active' | 'abandoned' | 'recovered';

export interface CartsQuery {
  filter: CartFilter;
  take: number;
  skip: number;
}

export function useCarts(query: CartsQuery) {
  return useQuery({
    queryKey: [...CARTS_KEY, 'list', query],
    queryFn: () =>
      api.list<CartRow>('/v1/commerce/carts', {
        filter: query.filter,
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useCart(id: string) {
  return useQuery({
    queryKey: [...CARTS_KEY, 'detail', id],
    // The endpoint answers `null` for a cart that does not exist rather than a
    // 404; the surface treats null as "not found" so a stale link degrades to a
    // clear message instead of a blank pane.
    queryFn: () => api.get<CartDetail | null>(`/v1/commerce/carts/${id}`),
    enabled: id !== '',
  });
}

/** Mark an abandoned cart as recovered — the one staff move on a cart. The
 *  server refuses on a cart that was never abandoned, so the surface only offers
 *  it where it applies. */
export function useRecoverCart(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/v1/commerce/carts/${id}/recovered`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CARTS_KEY });
    },
  });
}

export function cartErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/* ── Saying what a state means ──────────────────────────────────────────── */

export interface CartState {
  label: string;
  tone: Tone;
  detail: string;
}

/**
 * What has become of a cart. A cart carries three timestamps that resolve to one
 * state: recovered wins over abandoned (it came back), abandoned means left
 * without paying, and an expired-but-not-abandoned cart is simply past its
 * hold. Everything else is a live cart still being filled.
 */
export function cartStateFrom(input: {
  abandonedAt: string | null;
  recoveredAt?: string | null;
  expiresAt: string | null;
}): CartState {
  if (input.recoveredAt) {
    return {
      label: 'Came back',
      tone: 'success',
      detail: 'This cart was abandoned and the shopper returned to it.',
    };
  }
  if (input.abandonedAt) {
    return {
      label: 'Walked away',
      tone: 'warning',
      detail: 'The shopper filled this cart but left without paying.',
    };
  }
  if (input.expiresAt && new Date(input.expiresAt).getTime() < Date.now()) {
    return {
      label: 'Expired',
      tone: 'neutral',
      detail: 'This cart sat untouched past its hold and is no longer being kept.',
    };
  }
  return {
    label: 'In progress',
    tone: 'info',
    detail: 'A shopper is still filling this cart.',
  };
}

/** Where the cart was started, in one phrase. Kept local — these are the words
 *  an owner uses, not the stored slugs. */
export const CART_CHANNEL_LABELS: Record<string, string> = {
  storefront: 'Your website',
  b2b_portal: 'Trade portal',
  admin: 'Entered by your team',
  mcp: 'AI assistant',
};

export function cartChannelLabel(channel: string): string {
  return CART_CHANNEL_LABELS[channel] ?? channel;
}

/** A cart's buyer in one line, or a clear "guest" when there is no account. A
 *  cart, unlike an order, genuinely may have no customer. */
export function cartShopperName(
  customer: CartCustomer | null,
  fallbackName?: string | null
): string {
  if (customer) {
    if (customer.company) return customer.company;
    const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    if (person) return person;
    if (customer.email) return customer.email;
  }
  if (fallbackName) return fallbackName;
  return 'Guest shopper';
}
