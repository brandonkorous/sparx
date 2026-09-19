import { describe, expect, it } from 'vitest';
import { paymentState } from './format';

/**
 * "PAID", IN GREEN, ON A PAYMENT WHERE EVERY PENNY WENT BACK.
 *
 * Money → Payments, 2026-09-15:
 *
 *     Anneliese Vogt   [Paid]   $170.00
 *     O-000004                  −$170.00 back
 *
 * The badge and the line under it are three pixels apart and disagree. She was
 * paid $170 and gave back $170; the row says Paid, in the color of good news.
 *
 * The cause is the one this persona keeps finding: A STORED STATUS THAT DEPENDS
 * ON SOMETHING ELSE HAPPENING. A refund is a row in `order_refunds`.
 * `recordRefund` writes that row, flips the ORDER, and recomputes the order's
 * rollup — and never touches `order_payments.status`, which goes on saying
 * `captured` for ever. Measured: four payments on this platform have refunds
 * against their order and THREE still say `captured`. The fourth says
 * `refunded` only because a seed wrote the word directly; no product path does.
 *
 * What makes this one avoidable rather than merely wrong is that the numbers
 * were already in the caller's hand. The row renders the refunded amount two
 * lines under the badge. The badge simply was not looking at it
 * ([[feedback_fetched_but_never_rendered]]).
 */
describe('paymentState', () => {
  it('does not say Paid when all of it went back', () => {
    const state = paymentState('captured', 170, 170);
    expect(state.label).toBe('Refunded');
    // Asserted as an absence too: the whole defect was the word, and a fix that
    // changed only the color would still read "Paid" beside "−$170.00 back".
    expect(state.label).not.toBe('Paid');
    expect(state.tone).not.toBe('success');
  });

  it('tells a part refund from a whole one', () => {
    // Jo Kim, O-000005: $147.00 taken, $42.00 back. Still money she keeps.
    expect(paymentState('captured', 42, 147).label).toBe('Part refunded');
    expect(paymentState('captured', 147, 147).label).toBe('Refunded');
  });

  it('leaves an ordinary payment alone', () => {
    const state = paymentState('captured', 0, 180);
    expect(state.label).toBe('Paid');
    expect(state.tone).toBe('success');
  });

  it('keeps every other word the row can carry', () => {
    // A refund cannot reach these, so the money must not rewrite them. A failed
    // payment badged "Refunded" would be a worse lie than the one being fixed.
    expect(paymentState('failed', 0, 60).label).toBe('Failed');
    expect(paymentState('pending', 0, 60).label).toBe('Pending');
    expect(paymentState('authorized', 0, 60).label).toBe('Held');
    expect(paymentState('voided', 0, 60).label).toBe('Canceled');
  });

  it('still honors the stored word when a processor does write it', () => {
    // One row on this platform says `refunded` outright. It must not fall
    // through to the raw-status default just because its amount is unknown.
    expect(paymentState('refunded', 0, 421.28).label).toBe('Refunded');
    expect(paymentState('refunded', 421.28, 421.28).label).toBe('Refunded');
  });

  it('never invents a state from a word it does not know', () => {
    expect(paymentState('something_new', 0, 10).label).toBe('something_new');
    expect(paymentState('something_new', 0, 10).tone).toBe('neutral');
  });
});
