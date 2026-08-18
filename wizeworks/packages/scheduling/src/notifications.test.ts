import { describe, expect, it } from 'vitest';
import type { TxClient } from '@wizeworks/db';

import {
  BOOKING_EMAIL_KEY,
  cancelBookingNotifications,
  dropPendingBookingNotifications,
  rescheduleBookingNotifications,
  scheduleBookingNotifications,
} from './notifications';

type Row = Record<string, unknown>;

interface FakeTxOpts {
  customer?: { email: string | null; phone: string | null } | null;
  reminderOffsetsMin?: number[];
  confirmationCount?: number;
}

/** A hand-rolled TxClient stub that records the writes the ledger functions make,
 *  so we can assert the scheduled rows without a database. */
function makeTx(opts: FakeTxOpts): {
  tx: TxClient;
  created: Row[];
  updateManyCalls: { where: Row; data: Row }[];
} {
  const created: Row[] = [];
  const updateManyCalls: { where: Row; data: Row }[] = [];
  const tx = {
    customer: {
      findUnique: () => Promise.resolve(opts.customer === undefined ? null : opts.customer),
    },
    bookingPolicy: {
      findUnique: () => Promise.resolve({ reminderOffsetsMin: opts.reminderOffsetsMin ?? [] }),
    },
    bookingNotification: {
      count: () => Promise.resolve(opts.confirmationCount ?? 0),
      createMany: ({ data }: { data: Row[] }) => {
        created.push(...data);
        return Promise.resolve({ count: data.length });
      },
      updateMany: (args: { where: Row; data: Row }) => {
        updateManyCalls.push(args);
        return Promise.resolve({ count: 0 });
      },
    },
  };
  return { tx: tx as unknown as TxClient, created, updateManyCalls };
}

const FUTURE = new Date('2030-01-01T12:00:00.000Z');
const NOW = new Date('2026-01-01T00:00:00.000Z');
const booking = { id: 'b1', startAt: FUTURE, customerId: 'c1', policyId: 'p1' };

describe('scheduleBookingNotifications', () => {
  it('writes a confirmation + a reminder per offset on every reachable channel', async () => {
    const { tx, created } = makeTx({
      customer: { email: 'a@b.com', phone: '+15555550123' },
      reminderOffsetsMin: [1440, 120],
    });
    await scheduleBookingNotifications(tx, 't1', booking, NOW);

    // confirmation × {email, sms} + reminder × 2 offsets × {email, sms} = 6 rows.
    expect(created).toHaveLength(6);
    const confirmations = created.filter((r) => r.type === 'confirmation');
    const reminders = created.filter((r) => r.type === 'reminder');
    expect(confirmations).toHaveLength(2);
    expect(reminders).toHaveLength(4);
    expect(new Set(confirmations.map((r) => r.channel))).toEqual(new Set(['email', 'sms']));
    // Confirmation goes out now; reminders at startAt − offset.
    expect((confirmations[0]!.scheduledFor as Date).getTime()).toBe(NOW.getTime());
    const offsets = reminders.map(
      (r) => (FUTURE.getTime() - (r.scheduledFor as Date).getTime()) / 60_000
    );
    expect(new Set(offsets)).toEqual(new Set([1440, 120]));
  });

  it('email only when the customer has no phone', async () => {
    const { tx, created } = makeTx({
      customer: { email: 'a@b.com', phone: null },
      reminderOffsetsMin: [60],
    });
    await scheduleBookingNotifications(tx, 't1', booking, NOW);
    expect(created.every((r) => r.channel === 'email')).toBe(true);
    expect(created).toHaveLength(2); // confirmation + 1 reminder, email only
  });

  it('skips reminders whose time has already passed', async () => {
    const { tx, created } = makeTx({
      customer: { email: 'a@b.com', phone: null },
      reminderOffsetsMin: [1440, 120],
    });
    // now is 60 min before start → both 1440- and 120-min reminders are in the past.
    const lateNow = new Date(FUTURE.getTime() - 60 * 60_000);
    await scheduleBookingNotifications(tx, 't1', booking, lateNow);
    expect(created.filter((r) => r.type === 'reminder')).toHaveLength(0);
    // email-only customer → one confirmation row, no reminders.
    expect(created.filter((r) => r.type === 'confirmation')).toHaveLength(1);
  });

  it('schedules nothing when there is no reachable customer', async () => {
    const { tx, created } = makeTx({ customer: null, reminderOffsetsMin: [60] });
    await scheduleBookingNotifications(tx, 't1', { ...booking, customerId: null }, NOW);
    expect(created).toHaveLength(0);
  });

  it('does not write a second confirmation when one already exists', async () => {
    const { tx, created } = makeTx({
      customer: { email: 'a@b.com', phone: null },
      reminderOffsetsMin: [],
      confirmationCount: 1,
    });
    await scheduleBookingNotifications(tx, 't1', booking, NOW);
    expect(created.filter((r) => r.type === 'confirmation')).toHaveLength(0);
  });
});

describe('cancelBookingNotifications', () => {
  it('cancels pending reminders/changes and writes a cancellation notice', async () => {
    const { tx, created, updateManyCalls } = makeTx({
      customer: { email: 'a@b.com', phone: '+15555550123' },
    });
    await cancelBookingNotifications(tx, 't1', booking, NOW);
    expect(updateManyCalls).toHaveLength(1);
    expect(updateManyCalls[0]!.data).toMatchObject({ status: 'cancelled' });
    expect(created.every((r) => r.type === 'cancellation')).toBe(true);
    expect(created).toHaveLength(2);
  });
});

describe('rescheduleBookingNotifications', () => {
  it('drops stale reminders, sends a change notice, and re-lays reminders', async () => {
    const { tx, created, updateManyCalls } = makeTx({
      customer: { email: 'a@b.com', phone: null },
      reminderOffsetsMin: [120],
    });
    await rescheduleBookingNotifications(tx, 't1', booking, NOW);
    expect(updateManyCalls).toHaveLength(1);
    expect(created.filter((r) => r.type === 'change')).toHaveLength(1);
    expect(created.filter((r) => r.type === 'reminder')).toHaveLength(1);
  });
});

describe('dropPendingBookingNotifications', () => {
  it('cancels pending reminders/changes and writes nothing new', async () => {
    const { tx, created, updateManyCalls } = makeTx({});
    await dropPendingBookingNotifications(tx, 'b1');
    expect(updateManyCalls).toHaveLength(1);
    expect(created).toHaveLength(0);
  });
});

describe('BOOKING_EMAIL_KEY', () => {
  it('maps every notification type to its keyed Builder email', () => {
    expect(BOOKING_EMAIL_KEY).toEqual({
      confirmation: 'booking-confirmation',
      reminder: 'booking-reminder',
      change: 'booking-rescheduled',
      cancellation: 'booking-cancelled',
    });
  });
});
