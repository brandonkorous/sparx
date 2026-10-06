import { describe, expect, it } from 'vitest';

import { depositLine } from './booking-money';
import {
  describeTimelineEntry,
  formatDay,
  formatMoney,
  type Booking,
  type BookingPayment,
} from './bookings-data';
import type { BookingPolicy } from './setup-data';

/**
 * WHERE THE MONEY STANDS, IN WORDS THAT FOLLOW IT (sparx persona issue 087).
 *
 * The line read the deposit status alone, so a no-show whose fee the card
 * refused still said "$40.00 is held on their card": the deposit stays `held`
 * because no money moved, and the hold it names may have run out a week ago.
 * Nobody reading it would know a fee was owed. What this pins:
 *
 *   1. Once the booking has ended, the line says what the card was asked to do
 *      and whether it did, and a fee or a refund that did not go through is a
 *      problem to act on, never a "held" line.
 *   2. Before it ends, a hold placed more than a week ago is not described as
 *      sitting on the card, and a deposit asked for is not called paid.
 *   3. The booking's history says the same, instead of "Updated".
 *
 * Amounts are checked against `formatMoney` rather than literals, because the
 * literal would be asserting what `Intl` does on this machine.
 */

const START = '2026-10-06T21:30:00.000Z';
const NOW = new Date('2026-10-05T12:00:00.000Z').getTime();
const forty = formatMoney(4000, 'USD');
const thirty = formatMoney(3000, 'USD');

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'bk_1',
    serviceId: 'svc_1',
    bookingType: 'appointment',
    seriesId: null,
    locationId: null,
    status: 'confirmed',
    startAt: START,
    endAt: '2026-10-06T22:30:00.000Z',
    timezone: 'UTC',
    capacity: 1,
    partySize: null,
    customerId: 'c-ana',
    companyId: null,
    assetRef: null,
    partsLinked: [],
    workOrderId: null,
    source: 'site',
    policyId: 'pol_1',
    depositStatus: 'held',
    paymentIntentId: 'pi_row',
    intakeSubmissionId: null,
    notes: null,
    staffNotes: null,
    confirmedAt: null,
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    noShowAt: null,
    // Booked two days ago: the hold is still good.
    createdAt: '2026-10-03T12:00:00.000Z',
    updatedAt: '2026-10-03T12:00:00.000Z',
    service: {
      id: 'svc_1',
      name: 'Deep tissue massage',
      bookingType: 'appointment',
      durationMinutes: 60,
      priceCents: 12_000,
      currency: 'USD',
      color: null,
    },
    resources: [],
    attendees: [],
    customer: null,
    ...over,
  };
}

/** A $40.00 no-show fee and a $25.00 late-cancellation fee, held on the card. */
const CARD_HOLD: BookingPolicy = {
  id: 'pol_1',
  name: 'Massage rules',
  depositType: 'card_hold',
  depositAmountCents: null,
  depositPercent: null,
  cancellationWindowHours: 24,
  lateCancelFeeType: 'fixed',
  lateCancelFeeValue: 2500,
  noShowFeeType: 'fixed',
  noShowFeeValue: 4000,
  policyText: null,
  reminderOffsetsMin: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const DEPOSIT: BookingPolicy = { ...CARD_HOLD, depositType: 'deposit', depositAmountCents: 3000 };

const paid = (over: Partial<BookingPayment>): BookingPayment => ({
  done: true,
  move: 'capture_fee',
  ending: 'no_show',
  amountCents: 4000,
  currency: 'USD',
  reason: null,
  at: '2026-10-06T23:00:00.000Z',
  ...over,
});

describe('a booking that has ended', () => {
  it('a no-show fee the card refused is a problem to act on, not a hold', () => {
    const line = depositLine(
      booking({
        status: 'no_show',
        payment: paid({ done: false, reason: 'Your card was declined.' }),
      }),
      CARD_HOLD,
      NOW
    );
    expect(line).toEqual({
      kind: 'problem',
      title: `The ${forty} no-show fee was not charged`,
      detail:
        'It did not go through: Your card was declined. Nothing was charged to their card, and the hold on it may have run out. Ask them for the money, or let it go.',
    });
  });

  it('a late-cancellation fee that went through says it was charged', () => {
    expect(
      depositLine(
        booking({
          status: 'cancelled',
          depositStatus: 'captured',
          payment: paid({ ending: 'cancel', amountCents: 2500 }),
        }),
        CARD_HOLD,
        NOW
      )
    ).toEqual({
      kind: 'line',
      text: `A ${formatMoney(2500, 'USD')} late-cancellation fee was charged to their card.`,
    });
  });

  it('a refund that did not go through asks for it by hand', () => {
    const line = depositLine(
      booking({
        status: 'cancelled',
        depositStatus: 'captured',
        payment: paid({
          done: false,
          move: 'refund_deposit',
          ending: 'cancel',
          amountCents: 3000,
          reason: 'insufficient balance on the account',
        }),
      }),
      DEPOSIT,
      NOW
    );
    expect(line).toMatchObject({
      kind: 'problem',
      title: `Their ${thirty} deposit was not refunded`,
    });
    expect(line.kind === 'problem' && line.detail).toContain('Nothing has been given back yet.');
  });

  it('a deposit request that could not be called off is a problem to check', () => {
    const line = depositLine(
      booking({
        status: 'cancelled',
        payment: paid({
          done: false,
          move: 'call_off',
          ending: 'cancel',
          amountCents: 3000,
          reason: 'already processing',
        }),
      }),
      DEPOSIT,
      NOW
    );
    expect(line).toMatchObject({
      kind: 'problem',
      title: `The ${thirty} deposit request is still open`,
    });
  });

  it('a hold that could not be let go needs nobody to act: it drops off', () => {
    expect(
      depositLine(
        booking({
          status: 'completed',
          payment: paid({ done: false, move: 'release_hold', ending: 'complete' }),
        }),
        CARD_HOLD,
        NOW
      )
    ).toMatchObject({
      kind: 'line',
      text: expect.stringContaining('drops off their card by itself'),
    });
  });

  it('with nothing recorded, an ended booking never says the hold is still there', () => {
    const line = depositLine(booking({ status: 'cancelled' }), CARD_HOLD, NOW);
    expect(line).toEqual({
      kind: 'line',
      text: 'Nothing was charged when this booking ended. The hold on their card drops off by itself within about 7 days of when they booked.',
    });
  });
});

describe('a booking still to come', () => {
  it('a hold placed this week is on their card', () => {
    expect(depositLine(booking(), CARD_HOLD, NOW)).toEqual({
      kind: 'line',
      text: `${forty} is held on their card. Nothing has been charged.`,
    });
  });

  it('a hold placed more than a week ago has probably dropped off, and says so', () => {
    const created = '2026-09-20T12:00:00.000Z';
    expect(depositLine(booking({ createdAt: created }), CARD_HOLD, NOW)).toEqual({
      kind: 'line',
      text: `A ${forty} hold was put on their card when they booked on ${formatDay(created, 'UTC')}. A hold only lasts about 7 days, so it has probably dropped off, and a no-show or late-cancellation fee may not go through.`,
    });
  });

  it('a deposit asked for is not a deposit paid', () => {
    expect(depositLine(booking(), DEPOSIT, NOW)).toEqual({
      kind: 'line',
      text: `They have been asked for a ${thirty} deposit and have not paid it yet.`,
    });
  });

  it('nothing up front says so', () => {
    expect(depositLine(booking({ depositStatus: null }), undefined, NOW)).toEqual({
      kind: 'line',
      text: 'Nothing was paid up front for this booking.',
    });
  });
});

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
