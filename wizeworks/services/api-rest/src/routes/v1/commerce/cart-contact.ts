// Who to chase about a basket nobody paid for.
//
// A cart's `customer` relation is a SIGNED-IN shopper, and most shoppers are not
// — so both the carts inbox and the cart detail answered "Guest shopper" for a
// person who had typed their name, their email and their address into checkout
// two minutes earlier (issue 216). Those live on the CheckoutSession, one join
// away from the row the screen was already reading.
//
// This is the one thing the abandoned-basket screen exists to tell an owner, so
// it is read on the list as well as the detail: a follow-up list you have to open
// row by row to find out who is in it is not a follow-up list.

import type { TxClient } from '@wizeworks/db';

/** What a shopper told checkout before they stopped, or nulls when they told it
 *  nothing. Every field is independently nullable — somebody who typed a name
 *  and no email is a real state, and it is still more than "a guest". */
export interface CartContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  /** The furthest step this basket reached — `contact`, `shipping`, `payment`.
   *  How close somebody got is part of deciding whether to chase them. */
  reached: string | null;
}

function said(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  return text.length > 0 ? text : null;
}

/** Order of interest: the furthest a shopper got, then the most recent. A cart
 *  can carry several sessions — a reload opens a new one — and the abandoned
 *  half of that pair is usually the one that stopped early. */
const STEPS = ['cart_review', 'contact', 'shipping', 'payment', 'review', 'completed'];

function best(
  rows: {
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    step: string;
  }[]
): CartContact | null {
  const known = rows.filter((r) => said(r.customerName) !== null || said(r.customerEmail) !== null);
  if (known.length === 0) return null;
  const furthest = known.reduce((a, b) => (STEPS.indexOf(b.step) > STEPS.indexOf(a.step) ? b : a));
  return {
    name: said(furthest.customerName),
    email: said(furthest.customerEmail),
    phone: said(furthest.customerPhone),
    reached: furthest.step,
  };
}

const SELECT = {
  cartId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  step: true,
} as const;

/** The contacts for a page of carts, keyed by cart id. One query for the page,
 *  never one per row. */
export async function cartContacts(
  tx: TxClient,
  cartIds: string[]
): Promise<Map<string, CartContact>> {
  const out = new Map<string, CartContact>();
  if (cartIds.length === 0) return out;
  const rows = await tx.checkoutSession.findMany({
    where: { cartId: { in: cartIds } },
    orderBy: { createdAt: 'desc' },
    select: SELECT,
  });
  for (const id of cartIds) {
    const found = best(rows.filter((r) => r.cartId === id));
    if (found) out.set(id, found);
  }
  return out;
}

/** The contact for one cart. */
export async function cartContact(tx: TxClient, cartId: string): Promise<CartContact | null> {
  const rows = await tx.checkoutSession.findMany({
    where: { cartId },
    orderBy: { createdAt: 'desc' },
    select: SELECT,
  });
  return best(rows);
}
