// A return's refund is worded from the same answer that sends it (sparx persona
// issue 178). Doty's counter sale was recorded by hand, the refund dialog said it
// "moves real money", and nothing moved.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { gatewayChargeOf, shopperRefundRoute } from './refund-source';

describe('gatewayChargeOf', () => {
  it('finds no charge on money taken at the counter', () => {
    expect(gatewayChargeOf({ id: 'p1', processor: 'manual', processorRef: null })).toBeNull();
  });

  it('finds no charge on a cheque, whatever the reference box says', () => {
    expect(
      gatewayChargeOf({ id: 'p1', processor: 'check', processorRef: 'Cheque 4471' })
    ).toBeNull();
  });

  it('finds no charge when nothing was paid', () => {
    expect(gatewayChargeOf(null)).toBeNull();
  });

  it('finds the charge a gateway holds', () => {
    expect(gatewayChargeOf({ id: 'p1', processor: 'stripe', processorRef: 'ch_3Q' })).toBe('ch_3Q');
  });
});

describe('shopperRefundRoute', () => {
  it('does not say sent back for money handed over at the counter', () => {
    expect(shopperRefundRoute('original_payment', true)).toBe('by_hand');
  });

  it('says sent back only when a gateway sent it', () => {
    expect(shopperRefundRoute('original_payment', false)).toBe('payment');
  });

  it('calls store credit store credit, however they paid', () => {
    expect(shopperRefundRoute('account_credit', true)).toBe('store_credit');
    expect(shopperRefundRoute('account_credit', false)).toBe('store_credit');
  });

  it('claims nothing before the refund is settled', () => {
    expect(shopperRefundRoute(null, true)).toBeNull();
  });
});

describe('the return detail and the refund ask the same question', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./return-service.ts', import.meta.url)),
    'utf8'
  );

  it('sends the screen whether the refund is handed over by a person', () => {
    // Without this field the dialog can only guess, and it guessed "moves real money".
    expect(source).toMatch(/refundsByHand:\s*gatewayChargeOf\(/);
  });

  it('decides the refund from the same function, never a copy of the rule', () => {
    expect(source).toMatch(/chargeRef:\s*gatewayChargeOf\(/);
    expect(source).not.toMatch(/takenByGateway\(/);
  });
});
