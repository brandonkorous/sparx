// A shop that cannot be paid on its website says so before checkout asks for
// anything (sparx persona issue 131).
//
// MEASURED 2026-10-06 on Gillett Diesel: a stranger typed his name, email, phone
// and street address and chose a delivery option before the payment step said
// the order could not be finished. The cart, the cart drawer and the first step
// of checkout now say it first. A source check for the three places, since this
// app keeps no render tests.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ORDERS_CLOSED_MESSAGE, ordersClosed } from './orders-closed';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (path: string) => readFileSync(join(APP, path), 'utf8');

describe('ordersClosed', () => {
  it('closes checkout only for a shop that cannot be paid here', () => {
    expect(ordersClosed('unavailable')).toBe(ORDERS_CLOSED_MESSAGE);
    expect(ordersClosed('card')).toBeNull();
    // Paying when the order is handed over is still an order placed here.
    expect(ordersClosed('in_person')).toBeNull();
    expect(ordersClosed(undefined)).toBeNull();
  });

  it('stays open to a trade account billed on day terms (issue 136)', () => {
    expect(ordersClosed('unavailable', 'net30')).toBeNull();
    // Prepay or no terms yet: such an account pays by card like anyone else.
    expect(ordersClosed('unavailable', 'prepay')).toBe(ORDERS_CLOSED_MESSAGE);
    expect(ordersClosed('unavailable', null)).toBe(ORDERS_CLOSED_MESSAGE);
  });
});

describe('where a shopper meets it', () => {
  it('blocks the cart page and the cart drawer before Checkout', () => {
    for (const file of ['components/cart-view.tsx', 'components/mini-cart.tsx']) {
      expect(source(file), file).toMatch(
        /const closed = ordersClosed\(paymentMode, accountRules\?\.paymentTerms\);\s+const blocked = checkoutBlock\(accountRules\) \?\? closed;/
      );
    }
  });

  it('hands the shop’s payment mode to the drawer', () => {
    expect(source('app/layout.tsx')).toMatch(
      /<MiniCart paymentMode=\{site\.commerce\.paymentMode\} \/>/
    );
  });

  it('sends an account on terms straight to Bill to my account (issue 136)', () => {
    const payment = source('components/checkout/payment-step.tsx');
    expect(payment).toMatch(
      /const billOnly = netTermsEligible && session\.paymentMode === 'unavailable';/
    );
    expect(payment).toMatch(/billOnly \? 'account' : netTermsEligible \? 'choose' : 'card'/);
  });

  it('stops checkout at its first step', () => {
    expect(source('components/checkout/checkout-flow.tsx')).toMatch(
      /if \(ordersClosed\(shopPaymentMode, cart\.accountRules\?\.paymentTerms\) && step === 'contact'\) \{\s*return <OrdersClosed \/>;/
    );
  });
});
