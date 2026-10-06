import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type * as Commerce from '@wizeworks/commerce';

/**
 * The console's half of settling a booking's card (sparx persona issue 087).
 *
 * The decision comes back from the scheduling function that ended the booking,
 * and the gateway work is `bookingPayments.settle` in @wizeworks/commerce; the
 * rules and the gateway answers are pinned beside each of those. Two things are
 * pinned here, in the one package that carries both:
 *
 *   1. The outcome is written on the booking's history under names commerce
 *      owns and scheduling reads back for the console. Neither package can
 *      import the other, so if the two copies ever differ, every booking reads
 *      as "nothing recorded" and the console falls back to guessing from the
 *      deposit status: the defect this exists to end.
 *   2. Only real decisions reach the gateway: a booking with nothing to settle
 *      hands back null, and that is never passed on.
 */

const settle = vi.hoisted(() =>
  vi.fn((_ctx: unknown, moves: readonly { bookingId: string }[]) =>
    Promise.resolve(moves.map((money) => ({ money, ok: true })))
  )
);

vi.mock('@wizeworks/commerce', async (importOriginal) => {
  const real = await importOriginal<typeof Commerce>();
  return { ...real, bookingPayments: { ...real.bookingPayments, settle } };
});

const scheduling = await import('@wizeworks/scheduling');
const { bookingPayments } = await import('@wizeworks/commerce');
const { settleBookingMoney } = await import('./scheduling-payments.js');

const log = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as unknown as FastifyBaseLogger;

describe('the outcome on the booking history', () => {
  it('is written under the names the console reads it back by', () => {
    expect(bookingPayments.BOOKING_PAYMENT_SETTLED).toBe(scheduling.BOOKING_PAYMENT_SETTLED);
    expect(bookingPayments.BOOKING_PAYMENT_NOT_SETTLED).toBe(
      scheduling.BOOKING_PAYMENT_NOT_SETTLED
    );
  });
});

describe('settling the bookings that just ended', () => {
  const money = {
    bookingId: 'b-1',
    ending: 'no_show' as const,
    move: 'capture_fee' as const,
    amountCents: 4000,
    paymentRef: 'pi_ana',
    currency: 'USD',
    customerId: 'c-ana',
    serviceName: 'Deep tissue massage',
    startAt: new Date('2026-10-06T21:30:00Z'),
    timezone: 'America/Denver',
  };

  it('hands every real decision to the gateway half, once', async () => {
    settle.mockClear();
    await settleBookingMoney(log, { tenantId: 't-studio', userId: 'u-staff' }, [
      money,
      null,
      { ...money, bookingId: 'b-2' },
    ]);
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith({ tenantId: 't-studio', userId: 'u-staff' }, [
      money,
      { ...money, bookingId: 'b-2' },
    ]);
  });

  it('asks nothing when there was nothing to settle', async () => {
    settle.mockClear();
    expect(await settleBookingMoney(log, { tenantId: 't-studio' }, [null])).toEqual([]);
    expect(settle).not.toHaveBeenCalled();
  });
});
