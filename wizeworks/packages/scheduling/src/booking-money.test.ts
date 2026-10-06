// What a booking's card needs when the booking ends, and that every way of
// ending one hands it back (sparx persona issue 087).
//
// Only the console's own routes used to settle the card. A booking an AI
// assistant canceled, marked a no-show or completed, and every booking in a
// canceled series, kept the hold, never got an on-time deposit back and was
// never charged a fee. The decision now comes back from the lifecycle function
// itself, worked out inside its transaction, so a transport cannot end a booking
// without being handed what its card needs. What this pins:
//
//   1. The rules: a fee from a hold on a no-show or a late cancellation (never
//      more than is held), the hold let go otherwise; a deposit called off,
//      refunded, kept, or left alone on completion; `waiveFee` honored.
//   2. Nothing to decide: no rules, no payment, a deposit already settled.
//   3. Each ending hands its decision back, from the deposit as it was.
//   4. Exactly once: completing a completed booking or marking a no-show twice
//      decides nothing.
//   5. A canceled series hands back every booking's decision, with its waiver.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decideBookingMoney, type BookingMoneyFacts } from './booking-money';

interface Row {
  id: string;
  status: string;
  depositStatus: string | null;
  startAt: Date;
  timezone: string;
  customerId: string | null;
  paymentIntentId: string | null;
  service: { name: string; priceCents: number; currency: string };
  policy: Record<string, unknown> | null;
}

const state = vi.hoisted(() => ({
  rows: new Map<string, Row>(),
  seriesChildren: [] as string[],
}));

vi.mock('@wizeworks/db', () => ({
  Prisma: { DbNull: Symbol('DbNull') },
  withTenant: (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      booking: {
        findFirst: ({ where }: { where: { id: string } }) =>
          Promise.resolve(state.rows.get(where.id) ?? null),
        findUnique: ({ where }: { where: { id: string } }) =>
          Promise.resolve(state.rows.get(where.id) ?? null),
        findMany: () => Promise.resolve(state.seriesChildren.map((id) => ({ id }))),
        update: ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
          const next = { ...state.rows.get(where.id)!, ...data };
          state.rows.set(where.id, next);
          return Promise.resolve(next);
        },
      },
      bookingResource: { updateMany: () => Promise.resolve({ count: 1 }) },
      bookingSeries: {
        findUnique: () => Promise.resolve({ id: 'series-1' }),
        update: () => Promise.resolve({}),
      },
      paymentIntent: {
        findUnique: () => Promise.resolve({ externalId: 'pi_ana', amount: 4000 }),
      },
    }),
}));
vi.mock('./booking-history', () => ({ recordBookingEvent: () => Promise.resolve() }));
vi.mock('./notifications', () => ({
  cancelBookingNotifications: () => Promise.resolve(),
  dropPendingBookingNotifications: () => Promise.resolve(),
  rescheduleBookingNotifications: () => Promise.resolve(),
  scheduleBookingNotifications: () => Promise.resolve(),
}));

const { cancelBooking, completeBooking, noShowBooking } = await import('./booking-service');
const { cancelBookingSeries } = await import('./series');

const START = new Date('2026-10-06T21:30:00Z');
/** Two hours before it starts: inside a 24-hour window. */
const LATE = new Date('2026-10-06T19:30:00Z');
/** Three days before: in good time. */
const EARLY = new Date('2026-10-03T21:30:00Z');

/** A $40.00 no-show fee and a $25.00 late-cancellation fee, held on the card. */
const CARD_HOLD = {
  depositType: 'card_hold',
  depositAmountCents: null,
  depositPercent: null,
  cancellationWindowHours: 24,
  lateCancelFeeType: 'fixed',
  lateCancelFeeValue: 2500,
  noShowFeeType: 'fixed',
  noShowFeeValue: 4000,
};
/** A $30.00 deposit, charged when they book. */
const DEPOSIT = { ...CARD_HOLD, depositType: 'deposit', depositAmountCents: 3000 };

const facts = (over: Partial<BookingMoneyFacts> = {}): BookingMoneyFacts => ({
  bookingId: 'b-1',
  depositStatus: 'held',
  startAt: START,
  timezone: 'America/Denver',
  customerId: 'c-ana',
  serviceName: 'Deep tissue massage',
  currency: 'USD',
  priceCents: 12_000,
  policy: CARD_HOLD,
  paymentRef: 'pi_ana',
  paymentAmountCents: 4000,
  ...over,
});

const moveOf = (...args: Parameters<typeof decideBookingMoney>) => {
  const m = decideBookingMoney(...args);
  return m ? { move: m.move, amountCents: m.amountCents } : null;
};

describe('a card hold', () => {
  it('charges the no-show fee from the hold', () => {
    expect(moveOf(facts(), 'no_show')).toEqual({ move: 'capture_fee', amountCents: 4000 });
  });

  it('charges the late-cancellation fee inside the window', () => {
    expect(moveOf(facts(), 'cancel', { now: LATE })).toEqual({
      move: 'capture_fee',
      amountCents: 2500,
    });
  });

  it('never charges more than is held on the card', () => {
    expect(moveOf(facts({ paymentAmountCents: 1500 }), 'no_show')).toEqual({
      move: 'capture_fee',
      amountCents: 1500,
    });
  });

  it('lets the hold go on a cancellation in good time, and on completion', () => {
    expect(moveOf(facts(), 'cancel', { now: EARLY })).toEqual({
      move: 'release_hold',
      amountCents: 4000,
    });
    expect(moveOf(facts(), 'complete')).toEqual({ move: 'release_hold', amountCents: 4000 });
  });

  it('lets the hold go when the fee is waived', () => {
    expect(moveOf(facts(), 'no_show', { waiveFee: true })?.move).toBe('release_hold');
    expect(moveOf(facts(), 'cancel', { now: LATE, waiveFee: true })?.move).toBe('release_hold');
  });

  it('has nothing to do once a fee has been taken from it', () => {
    expect(decideBookingMoney(facts({ depositStatus: 'captured' }), 'cancel')).toBeNull();
  });
});

describe('a deposit', () => {
  const paid = (over: Partial<BookingMoneyFacts> = {}) =>
    facts({ policy: DEPOSIT, depositStatus: 'captured', paymentAmountCents: 3000, ...over });

  it('not paid yet is called off', () => {
    expect(moveOf(paid({ depositStatus: 'held' }), 'cancel', { now: EARLY })).toEqual({
      move: 'call_off',
      amountCents: 3000,
    });
  });

  it('is refunded on a cancellation in good time', () => {
    expect(moveOf(paid(), 'cancel', { now: EARLY })?.move).toBe('refund_deposit');
  });

  it('is kept on a no-show and on a late cancellation', () => {
    expect(moveOf(paid(), 'no_show')?.move).toBe('keep_deposit');
    expect(moveOf(paid(), 'cancel', { now: LATE })?.move).toBe('keep_deposit');
  });

  it('is refunded when the fee is waived', () => {
    expect(moveOf(paid(), 'cancel', { now: LATE, waiveFee: true })?.move).toBe('refund_deposit');
    expect(moveOf(paid(), 'no_show', { waiveFee: true })?.move).toBe('refund_deposit');
  });

  it('is the payment on completion, so there is nothing to do', () => {
    expect(decideBookingMoney(paid(), 'complete')).toBeNull();
  });
});

describe('nothing to decide', () => {
  it('without rules, without a payment, or once it is settled', () => {
    expect(decideBookingMoney(facts({ policy: null }), 'no_show')).toBeNull();
    expect(decideBookingMoney(facts({ paymentRef: null }), 'no_show')).toBeNull();
    for (const depositStatus of ['refunded', 'forfeited', 'none', null]) {
      expect(decideBookingMoney(facts({ depositStatus }), 'no_show')).toBeNull();
    }
  });
});

const row = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  status: 'confirmed',
  depositStatus: 'held',
  startAt: START,
  timezone: 'America/Denver',
  customerId: 'c-ana',
  paymentIntentId: `row-${id}`,
  service: { name: 'Deep tissue massage', priceCents: 12_000, currency: 'USD' },
  policy: CARD_HOLD,
  ...over,
});

beforeEach(() => {
  state.rows.clear();
  state.seriesChildren = [];
  vi.useRealTimers();
});

describe('every ending hands its decision back', () => {
  it('a no-show, with the fee to charge and who to charge it to', async () => {
    state.rows.set('b-1', row('b-1'));
    const { booking, money } = await noShowBooking('t1', { id: 'b-1', waiveFee: false });
    expect(booking.status).toBe('no_show');
    expect(money).toMatchObject({
      bookingId: 'b-1',
      ending: 'no_show',
      move: 'capture_fee',
      amountCents: 4000,
      paymentRef: 'pi_ana',
      customerId: 'c-ana',
      serviceName: 'Deep tissue massage',
    });
  });

  it('a no-show marked twice charges once', async () => {
    state.rows.set('b-1', row('b-1', { status: 'no_show' }));
    const { money } = await noShowBooking('t1', { id: 'b-1', waiveFee: false });
    expect(money).toBeNull();
  });

  it('a waived no-show lets the hold go', async () => {
    state.rows.set('b-1', row('b-1'));
    const { money } = await noShowBooking('t1', { id: 'b-1', waiveFee: true });
    expect(money?.move).toBe('release_hold');
  });

  it('a completion lets the hold go, and completing it again does nothing', async () => {
    state.rows.set('b-1', row('b-1'));
    expect((await completeBooking('t1', 'b-1')).money?.move).toBe('release_hold');
    expect((await completeBooking('t1', 'b-1')).money).toBeNull();
  });

  it('a cancellation, from the deposit as it was before the booking moved', async () => {
    vi.useFakeTimers({ now: EARLY, toFake: ['Date'] });
    state.rows.set('b-1', row('b-1', { policy: DEPOSIT, depositStatus: 'captured' }));
    const { money } = await cancelBooking('t1', {
      id: 'b-1',
      reason: null,
      waiveFee: false,
      notifyCustomer: true,
    });
    expect(money?.move).toBe('refund_deposit');
  });
});

describe('a canceled series', () => {
  it('hands back every booking it canceled and what each card needs', async () => {
    vi.useFakeTimers({ now: LATE, toFake: ['Date'] });
    state.rows.set('b-1', row('b-1'));
    state.rows.set('b-2', row('b-2', { policy: DEPOSIT, depositStatus: 'captured' }));
    state.rows.set('b-3', row('b-3', { policy: null, paymentIntentId: null }));
    state.seriesChildren = ['b-1', 'b-2', 'b-3'];

    const result = await cancelBookingSeries('t1', {
      id: 'series-1',
      scope: 'all',
      reason: null,
      waiveFee: false,
    });
    expect(result.cancelled).toBe(3);
    expect(result.bookingIds).toEqual(['b-1', 'b-2', 'b-3']);
    expect(result.money.map((m) => [m.bookingId, m.move])).toEqual([
      ['b-1', 'capture_fee'],
      ['b-2', 'keep_deposit'],
    ]);
  });

  it('lets every customer off when the fee is waived', async () => {
    vi.useFakeTimers({ now: LATE, toFake: ['Date'] });
    state.rows.set('b-1', row('b-1'));
    state.seriesChildren = ['b-1'];
    const result = await cancelBookingSeries('t1', {
      id: 'series-1',
      scope: 'all',
      reason: null,
      waiveFee: true,
    });
    expect(result.money.map((m) => m.move)).toEqual(['release_hold']);
  });

  it('steps over a booking someone else ended in the meantime', async () => {
    state.rows.set('b-1', row('b-1', { status: 'cancelled' }));
    state.rows.set('b-2', row('b-2'));
    state.seriesChildren = ['b-1', 'b-2'];
    const result = await cancelBookingSeries('t1', {
      id: 'series-1',
      scope: 'future',
      reason: null,
      waiveFee: false,
    });
    expect(result.bookingIds).toEqual(['b-2']);
    expect(result.money).toHaveLength(1);
  });
});
