// A person with a booking is a customer, and their record can find all of their
// bookings (persona issue 113). Halo & Hem's Priyanka Deshmukh had a $180
// appointment on Friday and read "Lead"; a class member's record read "Never
// booked in" above a term of classes.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxClient } from '@wizeworks/db';

const tx = vi.hoisted(() => ({
  customer: {
    updateMany: vi.fn((_args: unknown) => Promise.resolve({ count: 1 })),
    findMany: vi.fn(() => Promise.resolve([])),
  },
  booking: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(() => Promise.resolve([])),
    count: vi.fn(() => Promise.resolve(0)),
  },
  bookingAttendee: {
    findMany: vi.fn(() => Promise.resolve([])),
    findUnique: vi.fn(),
    create: vi.fn((args: { data: { customerId: string | null } }) =>
      Promise.resolve({ id: 'att-1', ...args.data })
    ),
    update: vi.fn(),
  },
}));

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx),
}));
vi.mock('./locks', () => ({ lockClassSession: vi.fn(() => Promise.resolve()) }));

const { recognizeBookedCustomers } = await import('./booked-customer');
const { bookClassSeat, updateAttendee } = await import('./classes');
const { listBookings } = await import('./booking-queries');

const SESSION = { id: 'class-1', bookingType: 'class', status: 'confirmed', capacity: 1 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recognizeBookedCustomers', () => {
  it('moves the people named forward to customer, and only those not already one', async () => {
    await recognizeBookedCustomers(tx as unknown as TxClient, [
      'c-1',
      null,
      'c-1',
      undefined,
      'c-2',
    ]);
    expect(tx.customer.updateMany).toHaveBeenCalledOnce();
    expect(tx.customer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c-1', 'c-2'] }, lifecycleStage: { notIn: ['customer', 'evangelist'] } },
      data: { lifecycleStage: 'customer', leadStatus: null },
    });
  });

  it('writes nothing for a booking with nobody on it', async () => {
    await recognizeBookedCustomers(tx as unknown as TxClient, [null, undefined]);
    expect(tx.customer.updateMany).not.toHaveBeenCalled();
  });
});

describe('a class seat', () => {
  it('makes the person who takes it a customer', async () => {
    tx.booking.findFirst.mockResolvedValueOnce(SESSION);
    await bookClassSeat('t-1', { bookingId: 'class-1', customerId: 'c-9', partySize: 1 });
    expect(tx.customer.updateMany).toHaveBeenCalledOnce();
    expect(tx.customer.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: { in: ['c-9'] } },
    });
  });

  it('does not, while they are only on the waiting list', async () => {
    tx.booking.findFirst.mockResolvedValueOnce(SESSION);
    tx.bookingAttendee.findMany.mockResolvedValueOnce([
      { status: 'booked', partySize: 1 },
    ] as never);
    const seat = await bookClassSeat('t-1', {
      bookingId: 'class-1',
      customerId: 'c-9',
      partySize: 1,
    });
    expect(seat.waitlisted).toBe(true);
    expect(tx.customer.updateMany).not.toHaveBeenCalled();
  });

  it('does, when staff move them into a seat by hand', async () => {
    tx.bookingAttendee.findUnique.mockResolvedValueOnce({
      id: 'att-1',
      bookingId: 'class-1',
      status: 'waitlisted',
    });
    tx.bookingAttendee.update.mockResolvedValueOnce({ id: 'att-1', customerId: 'c-9' });
    await updateAttendee('t-1', { id: 'att-1', status: 'booked' } as never);
    expect(tx.customer.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: { in: ['c-9'] } },
    });
  });
});

describe('a person’s bookings', () => {
  it('include the classes they hold a seat in, beside a search', async () => {
    await listBookings('t-1', { customerId: 'c-9', q: 'fringe' });
    const where = (
      tx.booking.findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where.AND).toEqual([
      { OR: [{ customerId: 'c-9' }, { attendees: { some: { customerId: 'c-9' } } }] },
    ]);
    // The search keeps its own OR.
    expect(where.OR).toHaveLength(3);
    expect(where).not.toHaveProperty('customerId');
  });
});
