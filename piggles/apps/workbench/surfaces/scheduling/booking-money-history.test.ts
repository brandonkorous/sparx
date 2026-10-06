// The booking's history says what happened to the money, instead of "Updated"
// (sparx persona issue 087).
import { describe, expect, it } from 'vitest';

import { forty, thirty } from './booking-money-fixtures';
import { describeTimelineEntry } from './bookings-data';

describe('the booking history', () => {
  const entry = (action: string, diff: Record<string, unknown>) => ({
    id: 'a1',
    action,
    actorId: null,
    actorType: 'system',
    diff,
    createdAt: '2026-10-06T23:00:00.000Z',
  });

  it('says a fee was not charged, and why, instead of "Updated"', () => {
    expect(
      describeTimelineEntry(
        entry('booking.payment_not_settled', {
          move: 'capture_fee',
          ending: 'no_show',
          amountCents: 4000,
          currency: 'USD',
          reason: 'Your card was declined.',
        })
      )
    ).toEqual({
      label: 'No-show fee not charged',
      detail: `${forty}. It did not go through: Your card was declined.`,
    });
  });

  it('says a deposit was refunded', () => {
    expect(
      describeTimelineEntry(
        entry('booking.payment_settled', {
          move: 'refund_deposit',
          ending: 'cancel',
          amountCents: 3000,
          currency: 'USD',
        })
      )
    ).toEqual({ label: 'Deposit refunded', detail: thirty });
  });
});
