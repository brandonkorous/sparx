import { describe, expect, it } from 'vitest';
import { discountUsageLine, givenAwayCell } from './discount-words';

/**
 * "USED 4 TIMES", OVER $91.20 SHE COULD NOT SEE.
 *
 * Sell -> Discounts -> Spring sale, 2026-09-16. The header said:
 *
 *     Live    Used 4 times
 *
 * True, and useless. The four redemptions took $91.20 off her prices, on orders
 * worth $563.90, and every one of those figures was already in the database:
 * `commerce_discount_usages.applied_cents`, one row per redemption.
 *
 * `reporting-service.discountPerformance` had been summing exactly this since
 * 2026-06-15, behind `GET /v1/commerce/reports/discount-performance`, and the
 * docs marked it shipped. Measured: NO console has ever called that route. The
 * endpoint existed for three months; the capability did not.
 *
 * A shop owner does not go looking for a report to find out what her own offer
 * cost her. She opens the offer.
 */
describe('discountUsageLine', () => {
  it('says the money beside the count, because the money is the point', () => {
    expect(discountUsageLine(4, 9120)).toBe('Used 4 times · $91.20 given away');
  });

  it('reads naturally for a single use', () => {
    expect(discountUsageLine(1, 630)).toBe('Used once · $6.30 given away');
  });

  it('says nothing at all about an offer nobody has used', () => {
    // NOT "$0.00 given away". On a brand new offer that reads as a failure
    // rather than as an absence.
    expect(discountUsageLine(0, 0)).toBeNull();
  });

  it('keeps the count when a real use took nothing off', () => {
    // Free delivery on an order with no delivery charge. It happened; it cost
    // nothing. Inventing a figure would be worse than leaving it out.
    expect(discountUsageLine(2, 0)).toBe('Used 2 times');
  });

  it('honors the shop currency rather than assuming dollars', () => {
    expect(discountUsageLine(1, 1500, 'EUR')).toContain('15.00');
  });
});

describe('givenAwayCell', () => {
  it('shows the money for an offer that has been used', () => {
    expect(givenAwayCell(4, 9120)).toBe('$91.20');
  });

  it('shows an em-dash, never $0.00, for an offer nobody has used', () => {
    // A column of $0.00 reads as "these offers gave away nothing", which is a
    // measurement. Nobody measured anything: nothing happened.
    expect(givenAwayCell(0, 0)).toBe('—');
  });

  it('shows a real zero when a use genuinely took nothing off', () => {
    expect(givenAwayCell(3, 0)).toBe('$0.00');
  });
});
