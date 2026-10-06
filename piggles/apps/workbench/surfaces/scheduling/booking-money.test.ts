// Where the money stands, in words that follow it (sparx persona issue 087): an ended
// booking says what the card was asked to do and whether it did, and an old hold or an
// unpaid deposit is never described as sitting on the card.
import { describe, expect, it } from 'vitest';

import { depositLine } from './booking-money';
import { booking, CARD_HOLD, DEPOSIT, forty, NOW, paid, thirty } from './booking-money-fixtures';
import { formatDay, formatMoney } from './bookings-data';

/** Piggles calls the payment screen How you take payment, never "payment provider". */
const REFUND_THERE =
  'on the website of the company that takes your card payments. Find which one under How you take payment.';

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
});

describe('a booking that has ended', () => {
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
    expect(line.kind === 'problem' && line.detail).toContain(`Refund it ${REFUND_THERE}`);
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
    expect(line.kind === 'problem' && line.detail).toContain(
      `If they pay it, refund it ${REFUND_THERE}`
    );
  });
});

describe('a booking that has ended', () => {
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
