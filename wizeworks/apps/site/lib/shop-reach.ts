// "Could not check" is not "no".
//
// The site talks to api-rest through its own /api/sparx proxy. When api-rest is
// restarting, mid rolling deploy, or briefly unreachable, a question like "who
// is signed in?" or "what is in this cart?" gets NO answer, and an unanswered
// question used to be read as the worst answer: signed out, empty cart. A trade
// buyer was sent to the sign-in page with a session that was valid for another
// month (sparx persona issue 086), and the same blip on /checkout drew "your cart
// is empty" over a full basket.
//
// This module holds the one set of rules every reader uses to tell the two
// apart, so the proxy, the account guard, the header, the cart and checkout all
// agree on what a blip is and what to do about it: wait, say so plainly, and try
// again by themselves.

/** The error code the proxy answers with when api-rest could not be reached. A
 *  client that sees it knows the request never got an answer, so trying again
 *  is the right move and nothing about the shopper has changed. */
export const SHOP_UNREACHABLE_CODE = 'SHOP_UNREACHABLE';

/** What a shopper reads when a request could not reach the shop. Says what
 *  happened and what to do, and does not blame them. */
export const SHOP_UNREACHABLE_MESSAGE =
  'We couldn’t reach the shop just now. Please try again in a moment.';

/** What the account area says while it waits to hear back. "Will try again" is
 *  a promise: the customer provider retries on its own (see `retryDelayMs`). */
export const ACCOUNT_UNREACHABLE_MESSAGE =
  'We couldn’t reach your account just now. This page will try again.';

/** What the cart and checkout say while the basket cannot be read. Same
 *  promise, kept by the cart provider's own retry. */
export const CART_UNREACHABLE_MESSAGE =
  'We couldn’t reach the shop to load your cart just now. This page will try again.';

/** What checkout says while it cannot open the buyer's checkout. Kept by
 *  checkout's own retry of the session it waits on. */
export const CHECKOUT_UNREACHABLE_MESSAGE =
  'We couldn’t reach the shop to start your checkout just now. This page will try again.';

/** Seconds the proxy suggests waiting before asking again. */
export const RETRY_AFTER_SECONDS = 5;

export interface UnreachableEnvelope {
  success: false;
  error: { code: typeof SHOP_UNREACHABLE_CODE; message: string };
}

/** The proxy's answer when api-rest could not be reached, in the same envelope
 *  every api-rest error uses, so every existing client that shows the
 *  envelope's message shows this one without knowing about it. */
export function unreachableEnvelope(): UnreachableEnvelope {
  return {
    success: false,
    error: { code: SHOP_UNREACHABLE_CODE, message: SHOP_UNREACHABLE_MESSAGE },
  };
}

/**
 * Whether a status means "no answer yet" rather than an answer.
 *
 * `0` stands for a request that failed before any status came back (the
 * browser's own fetch threw). 408 and 429 are the server saying "not now". Any
 * 5xx is a server that could not answer the question it was asked. None of
 * these says anything about who the shopper is or what they bought.
 */
export function isTransientStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** The gateway statuses a load balancer or ingress answers with, in its own
 *  HTML, when the service behind it is down. */
export function isGatewayStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * The words to show for a failed request.
 *
 * The server's own message wins when it wrote one, because it was written for
 * the shopper ("That item sold out"). A response that never reached api-rest,
 * or came back with no readable body from a server error, says the shop could
 * not be reached rather than something vaguer.
 */
export function failureMessage(
  status: number,
  error: { code?: unknown; message?: unknown } | null | undefined,
  fallback: string
): string {
  if (error?.code === SHOP_UNREACHABLE_CODE) return SHOP_UNREACHABLE_MESSAGE;
  const said = typeof error?.message === 'string' ? error.message.trim() : '';
  if (said) return said;
  if (isTransientStatus(status)) return SHOP_UNREACHABLE_MESSAGE;
  return fallback;
}

/** What the browser knows about the signed-in shopper. `unreachable` means the
 *  last read got no answer and nothing earlier had answered either. */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'unreachable';

/** How a session read answered: a shopper, a real "nobody", or no answer. */
export type SessionOutcome = 'signed-in' | 'signed-out' | 'unknown';

/** Only a 2xx says who is signed in and only a definite refusal says nobody is.
 *  A blip says neither. */
export function sessionOutcome(status: number): SessionOutcome {
  if (status >= 200 && status < 300) return 'signed-in';
  if (isTransientStatus(status)) return 'unknown';
  return 'signed-out';
}

/**
 * What a session read that got no answer leaves behind.
 *
 * An answer the page already has stays: somebody known to be signed in is
 * still signed in (their cookie is untouched; the server simply did not reply),
 * and somebody known to be signed out is still signed out. Only a page that has
 * never heard back moves to `unreachable`, which is what makes it say so and
 * keep trying rather than guess.
 */
export function statusAfterUnansweredRead(prev: SessionStatus): SessionStatus {
  return prev === 'authenticated' || prev === 'anonymous' ? prev : 'unreachable';
}

/** What the signed-in-only area does with the session it has. */
export type AccountGate = 'wait' | 'sign-in' | 'retrying' | 'show';

export function accountGate(status: SessionStatus, hasCustomer: boolean): AccountGate {
  if (status === 'anonymous') return 'sign-in';
  if (status === 'unreachable') return 'retrying';
  if (status === 'authenticated' && hasCustomer) return 'show';
  return 'wait';
}

/** How long to wait before asking again: soon at first, then less often, and
 *  never giving up, because the page has promised it will try again. */
export function retryDelayMs(attempt: number): number {
  const step = Math.max(0, Math.floor(attempt));
  return Math.min(30_000, 2_000 * 2 ** Math.min(step, 5));
}

/** What a cart read means for the basket the browser is holding. */
export type CartReadOutcome = 'loaded' | 'gone' | 'retry' | 'settled';

/**
 * `gone` (404, 403, 410) forgets the stored cart: it was merged into another,
 * never this browser's, or already bought. A bought basket answers 410 (sparx
 * persona issue 087); before that it answered 200 and the site went on showing
 * and changing an order that had already been placed. `retry` keeps it and asks
 * again, because a blip says nothing about the basket and reading it as empty
 * is what showed a full basket as "your cart is empty". `settled` is any other
 * refusal: stop asking, keep what is there.
 */
export function cartReadOutcome(status: number): CartReadOutcome {
  if (status >= 200 && status < 300) return 'loaded';
  if (status === 404 || status === 403 || status === 410) return 'gone';
  if (isTransientStatus(status)) return 'retry';
  return 'settled';
}
