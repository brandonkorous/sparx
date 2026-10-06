// Sparx persona issue 087: a healthy order read red on a shop whose brand color
// is red, and an order on account terms showed "Payment confirmed" as the next
// thing to happen, ahead of the goods it is paid for afterwards.

import { describe, expect, it } from 'vitest';

import {
  invoiceStep,
  orderedWord,
  orderStatusLabel,
  orderStatusTone,
  paymentComesFirst,
  type OnAccountFacts,
} from './order-status-words';

describe('order status tone', () => {
  it('colors healthy orders as healthy, never with the brand color', () => {
    expect(orderStatusTone('placed')).toBe('info');
    expect(orderStatusTone('fulfilled')).toBe('success');
    expect(orderStatusTone('delivered')).toBe('success');
    expect(orderStatusTone('something_new')).toBe('info');
  });

  it('keeps waiting as warning and failure as danger', () => {
    expect(orderStatusTone('pending_approval')).toBe('warning');
    expect(orderStatusTone('refunded')).toBe('warning');
    expect(orderStatusTone('cancelled')).toBe('danger');
  });

  it('never answers primary or neutral', () => {
    for (const status of [
      'placed',
      'fulfilled',
      'delivered',
      'cancelled',
      'refunded',
      'pending_approval',
      'x',
    ]) {
      expect(['primary', 'neutral']).not.toContain(orderStatusTone(status));
    }
  });
});

describe('order status label', () => {
  it('reads statuses in the shopper’s words', () => {
    expect(orderStatusLabel('fulfilled')).toBe('On its way');
    expect(orderStatusLabel('cancelled')).toBe('Canceled');
    expect(orderStatusLabel('pending_approval')).toBe('Waiting for approval');
    expect(orderStatusLabel('on_hold')).toBe('On hold');
  });
});

describe('the word before an order’s date', () => {
  it('says Ordered for an order that was never placed', () => {
    expect(orderedWord('pending_approval')).toBe('Ordered');
    expect(orderedWord('cancelled')).toBe('Ordered');
  });

  it('says Placed for an order that went ahead', () => {
    expect(orderedWord('placed')).toBe('Placed');
    expect(orderedWord('fulfilled')).toBe('Placed');
    expect(orderedWord('delivered')).toBe('Placed');
  });
});

describe('where the payment sits in the timeline', () => {
  const at = (day: number) => `2026-10-0${day}T12:00:00.000Z`;

  it('comes straight after the order for a card paid at checkout', () => {
    expect(paymentComesFirst({ paymentStatus: 'paid', paidAt: at(1), fulfilledAt: null })).toBe(
      true
    );
    expect(paymentComesFirst({ paymentStatus: 'paid', paidAt: at(1), fulfilledAt: at(3) })).toBe(
      true
    );
  });

  it('comes last for an order not paid yet, such as one on account terms', () => {
    expect(paymentComesFirst({ paymentStatus: 'unpaid', paidAt: null, fulfilledAt: null })).toBe(
      false
    );
    expect(paymentComesFirst({ paymentStatus: 'unpaid', paidAt: null, fulfilledAt: at(3) })).toBe(
      false
    );
  });

  it('stays after the goods once an invoice is paid after it shipped', () => {
    expect(paymentComesFirst({ paymentStatus: 'paid', paidAt: at(9), fulfilledAt: at(3) })).toBe(
      false
    );
  });
});

// An order on account terms ends with its invoice: due when, what is left to
// pay, overdue marked, paid once it is, and promised once a held order is
// approved (sparx persona issue 087).
describe('the invoice at the end of a terms order', () => {
  const NOV_3 = '2026-11-03T12:00:00.000Z';
  function onAccount(
    invoice: Partial<NonNullable<OnAccountFacts['invoice']>> | null
  ): OnAccountFacts {
    return {
      terms: 'net30',
      invoice:
        invoice === null
          ? null
          : {
              number: 'INV-000014',
              dueAt: NOV_3,
              totalCents: 120_800,
              balanceCents: 120_800,
              status: 'unpaid',
              ...invoice,
            },
    };
  }
  const step = (a: OnAccountFacts, held = false) =>
    invoiceStep({ onAccount: a, held, currency: 'USD' });

  it('says what is due and when while it is open', () => {
    expect(step(onAccount({}))).toEqual({
      label: 'Invoice INV-000014',
      when: 'Due November 3, 2026',
      detail: '$1,208.00 to pay',
      complete: false,
      overdue: false,
    });
  });

  it('says what is still to pay on a part-paid invoice', () => {
    expect(step(onAccount({ status: 'partial', balanceCents: 60_400 })).detail).toBe(
      '$604.00 of $1,208.00 still to pay'
    );
  });

  it('marks an overdue invoice as a problem', () => {
    expect(step(onAccount({ status: 'overdue' }))).toEqual({
      label: 'Invoice INV-000014 is overdue',
      when: 'Was due November 3, 2026',
      detail: '$1,208.00 to pay',
      complete: false,
      overdue: true,
    });
  });

  it('says it is paid once it is', () => {
    expect(step(onAccount({ status: 'paid', balanceCents: 0 }))).toEqual({
      label: 'Invoice paid',
      when: null,
      detail: 'Invoice INV-000014 · $1,208.00',
      complete: true,
      overdue: false,
    });
  });

  it('says a held order gets its invoice once it is approved, and how long to pay', () => {
    expect(step(onAccount(null), true)).toEqual({
      label: 'Invoice',
      when: null,
      detail: 'We send your invoice once this order is approved. You have 30 days to pay it.',
      complete: false,
      overdue: false,
    });
  });

  it('never claims a held order when it is not held', () => {
    expect(step(onAccount(null), false).detail).toBe(
      'Your invoice has not been sent yet. You have 30 days to pay it.'
    );
  });

  it('names an invoice with no number plainly', () => {
    expect(step(onAccount({ number: null })).label).toBe('Your invoice');
  });
});
