// What a failed account action says (sparx persona issue 086, item 24). During
// an API restart, "Order again" said "Nothing was added to your cart. Please try
// again." with nothing about why: the proxy's "could not reach the shop" is a
// 503, and every button kept the server's words only under 500.

import { describe, expect, it } from 'vitest';
import { AccountError, accountFailureWords } from './customer-client';
import { SHOP_UNREACHABLE_CODE, SHOP_UNREACHABLE_MESSAGE } from './shop-reach';

const FALLBACK = 'Nothing was added to your cart. Please try again.';

describe('accountFailureWords', () => {
  it('says the shop could not be reached, after what did not happen', () => {
    const err = new AccountError(SHOP_UNREACHABLE_MESSAGE, 503, SHOP_UNREACHABLE_CODE);
    expect(accountFailureWords(err, FALLBACK)).toBe(
      `Nothing was added to your cart. ${SHOP_UNREACHABLE_MESSAGE}`
    );
  });

  it('keeps a refusal the buyer can act on in the server words', () => {
    const err = new AccountError('Ask Renée to place orders.', 403, 'FORBIDDEN');
    expect(accountFailureWords(err, FALLBACK)).toBe('Ask Renée to place orders.');
  });

  it('never shows a server fault its own words', () => {
    // Every 5xx is "no answer worth reading" on the site (shop-reach.ts), so a
    // raw "Internal Server Error" reads as the shop not answering.
    const err = new AccountError('Internal Server Error', 500, null);
    expect(accountFailureWords(err, FALLBACK)).toBe(
      `Nothing was added to your cart. ${SHOP_UNREACHABLE_MESSAGE}`
    );
  });

  it('reads the cart error "Order again" can throw while starting a cart', () => {
    // CartError lives in a client component; its shape is all that matters here.
    const err = Object.assign(new Error(SHOP_UNREACHABLE_MESSAGE), { status: 0 });
    expect(accountFailureWords(err, FALLBACK)).toBe(
      `Nothing was added to your cart. ${SHOP_UNREACHABLE_MESSAGE}`
    );
  });

  it('falls back on an error with no status', () => {
    expect(accountFailureWords(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });
});
