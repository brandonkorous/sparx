// A refund says where the money goes, the same way in all three places (sparx
// persona issue 351: a cash sale's refund was confirmed as going back to a card).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { paidByHand } from './data';
import { refundWords } from './refund-words';

const PANE_FILES = ['./order-detail.tsx'];
const readPane = (): string =>
  PANE_FILES.map((f) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')).join(
    '\n'
  );

describe('refundWords', () => {
  it('names the card only when there is one', () => {
    const card = refundWords({ amount: '$15.00', orderNumber: 'O-000036', toACard: true });
    expect(card.panel).toContain('back to the card');
    expect(card.confirm).toContain('back to the card used for order O-000036');
    expect(card.done).toContain('The card has been credited.');
  });

  it('never names a card for money taken by hand', () => {
    const cash = refundWords({ amount: '$793.50', orderNumber: 'O-000033', toACard: false });
    for (const line of [cash.panel, cash.confirm, cash.done]) {
      expect(line).not.toMatch(/card/i);
    }
    expect(cash.confirm).toContain('You hand the money over yourself');
    expect(cash.done).toContain('give them the money yourself');
  });

  it('is what the order pane says, in all three places', () => {
    const pane = readPane();
    expect(pane).not.toContain('back to the card used for order');
    expect(pane).not.toContain("the customer's card has been credited");
    expect(pane).toContain('.confirm');
    expect(pane).toContain('.done');
    expect(pane).toContain('.panel');
  });
});

// Sparx persona issue 353: "paid by hand" is the server's answer on each payment.
describe('paidByHand', () => {
  it('is false only when a gateway took the payment', () => {
    expect(paidByHand({ byGateway: true })).toBe(false);
    expect(paidByHand({ byGateway: false })).toBe(true);
  });

  it('is asked of the payment, never of a list of processor names', () => {
    expect(readPane()).not.toContain('paidByHand(payment.processor)');
  });
});
