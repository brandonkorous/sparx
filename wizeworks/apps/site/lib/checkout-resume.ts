// What a checkout already holds, put back into its forms (sparx persona issue 334).
//
// A stranger typed her name, email and address, reloaded the page, and checkout
// opened empty on step one. The server had kept every word: opening checkout on
// the same basket hands back the same session, with the contact and the address
// on it. Only the page forgot them.

import type { Address, CheckoutSession } from './checkout-client';

export interface ResumedContact {
  name: string;
  email: string;
  phone: string;
}

/** The contact the session holds, as the contact form's fields. */
export function resumedContact(session: CheckoutSession): ResumedContact {
  return {
    name: session.customerName ?? '',
    email: session.customerEmail ?? '',
    phone: session.customerPhone ?? '',
  };
}

/** The delivery address the session holds, as the address form's fields, or null. */
export function resumedAddress(session: CheckoutSession): Address | null {
  const a = session.shippingAddress;
  if (!a?.line1 || !a.city || !a.country) return null;
  return {
    name: a.recipientName ?? session.customerName ?? '',
    line1: a.line1,
    ...(a.line2 ? { line2: a.line2 } : {}),
    city: a.city,
    ...(a.region ? { region: a.region } : {}),
    postalCode: a.postalCode ?? '',
    country: a.country,
    ...(a.phone ? { phone: a.phone } : {}),
  };
}

/** Whether she had finished the contact step: the session holds a name and an
 *  email. A signed-in shopper's session opens with her email alone, so that is not
 *  enough to skip the step she has not seen. */
export function contactDone(session: CheckoutSession): boolean {
  return Boolean(session.customerEmail?.trim() && session.customerName?.trim());
}

// An address typed but not yet sent with "Continue to payment" is on no session,
// so a reload lost it. It is kept in this tab while she types, under the session
// it belongs to, and given back only when the session has none of its own.
const draftKey = (sessionId: string): string => `sparx:checkout-address:${sessionId}`;

export function saveAddressDraft(sessionId: string, address: Address): void {
  try {
    if (address.line1.trim() === '' && address.city.trim() === '') {
      window.sessionStorage.removeItem(draftKey(sessionId));
      return;
    }
    window.sessionStorage.setItem(draftKey(sessionId), JSON.stringify(address));
  } catch {
    // Private mode or blocked storage: the draft is a convenience, nothing more.
  }
}

export function loadAddressDraft(sessionId: string): Address | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Address>;
    if (typeof parsed.line1 !== 'string' || typeof parsed.city !== 'string') return null;
    return {
      name: parsed.name ?? '',
      line1: parsed.line1,
      ...(parsed.line2 ? { line2: parsed.line2 } : {}),
      city: parsed.city,
      ...(parsed.region ? { region: parsed.region } : {}),
      postalCode: parsed.postalCode ?? '',
      country: parsed.country ?? 'US',
      ...(parsed.phone ? { phone: parsed.phone } : {}),
    };
  } catch {
    return null;
  }
}
