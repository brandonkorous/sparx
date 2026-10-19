import { describe, expect, it } from 'vitest';
import { paymentMethodLabel } from './payment-methods';

// Sparx persona issue 332: a card payment through sparx Pay read
// "$640.96 · sparx_pay" on the order, because the pane looked the processor up in
// a short list that left the gateways out.
describe('paymentMethodLabel', () => {
  it('names every card gateway a business can choose as a card', () => {
    for (const gateway of ['sparx_pay', 'stripe_direct', 'stripe', 'authorize_net', 'first_pay']) {
      expect(paymentMethodLabel(gateway)).toBe('Card');
    }
  });

  it('keeps the words a shopkeeper uses for money taken by hand', () => {
    expect(paymentMethodLabel('manual')).toBe('Cash');
    expect(paymentMethodLabel('check')).toBe('Check');
  });

  it('never prints a code name with underscores', () => {
    expect(paymentMethodLabel('some_new_way')).toBe('some new way');
  });
});
