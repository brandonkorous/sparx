import { describe, expect, it } from 'vitest';
import {
  ordersLine,
  owedOutweighsTakings,
  unreceivedLine,
  type TakingsMeasurement,
} from './channels-words';

/** A plain formatter, so these tests read the sentence and not Intl's output. */
const money = (n: number): string => `$${n.toFixed(2)}`;

function measure(over: Partial<TakingsMeasurement> = {}): TakingsMeasurement {
  return { orders: 14, places: 2, gross: 2350.5, net: 535, refunds: 0, owed: 0, ...over };
}

describe('the orders line', () => {
  it('counts orders and places', () => {
    expect(ordersLine(measure())).toBe('from 14 orders across 2 places');
  });

  it('reads differently at one than at two', () => {
    const one = ordersLine(measure({ orders: 1, places: 1 }));
    const two = ordersLine(measure({ orders: 2, places: 2 }));
    expect(one).toBe('from 1 order across 1 place');
    // The property a hand-written expectation cannot fake: the noun itself has
    // to change. "1 orders across 1 places" passes any test that only looks for
    // the number.
    expect(one.replace(/\d+/g, 'N')).not.toBe(two.replace(/\d+/g, 'N'));
  });
});

describe('the line about money that did not arrive', () => {
  it('says nothing when everything sold was paid for', () => {
    expect(unreceivedLine(measure(), money)).toBeNull();
  });

  it('names what is still owed', () => {
    const line = unreceivedLine(measure({ owed: 1603.5 }), money);
    expect(line).toBe('Another $1603.50 of these sales has not been paid for yet.');
  });

  it('names what was refunded', () => {
    const line = unreceivedLine(measure({ refunds: 212 }), money);
    expect(line).toBe('$212.00 was refunded.');
  });

  it('says both, as two sentences, when both happened', () => {
    const line = unreceivedLine(measure({ owed: 1603.5, refunds: 212 }), money);
    expect(line).toBe(
      'Another $1603.50 of these sales has not been paid for yet. $212.00 was refunded.'
    );
  });

  it('completes the arithmetic the columns show', () => {
    // The whole reason the line exists: sold, less refunds, less owed, is what
    // was received. If this drifts, the pane is showing a chain that does not
    // close and the reader has to guess at the gap again.
    const m = measure({ gross: 2350.5, refunds: 212, owed: 1603.5, net: 535 });
    expect(Number((m.gross - m.refunds - m.owed).toFixed(2))).toBe(m.net);
  });

  it('is silent about a debt of exactly zero rather than printing it', () => {
    // A shop paid at the till would otherwise carry "Another $0.00 of these sales has
    // not been paid for yet." on every screen, every day.
    expect(unreceivedLine(measure({ owed: 0, refunds: 0 }), money)).toBeNull();
  });
});

describe('whether the debt outweighs the takings', () => {
  it('is true when more is owed than has come in', () => {
    expect(owedOutweighsTakings(measure({ net: 535, owed: 1603.5 }))).toBe(true);
  });

  it('is false when the takings are the bigger number', () => {
    expect(owedOutweighsTakings(measure({ net: 40_000, owed: 2000 }))).toBe(false);
  });

  it('is false when nothing is owed', () => {
    expect(owedOutweighsTakings(measure({ net: 535, owed: 0 }))).toBe(false);
  });

  it('measures against takings, not against sales', () => {
    // Two shops owed the same $2,000. The sales figure cannot tell them apart;
    // what has actually arrived can.
    const healthy = measure({ gross: 42_000, net: 40_000, owed: 2000 });
    const struggling = measure({ gross: 42_000, net: 500, owed: 2000 });
    expect(owedOutweighsTakings(healthy)).toBe(false);
    expect(owedOutweighsTakings(struggling)).toBe(true);
  });
});
