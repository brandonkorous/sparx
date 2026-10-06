import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The card on a booking that has ended, settled through the gateway (sparx
 * persona issue 087).
 *
 * The gateway answers a refused capture, release or refund with
 * `{ success: false }` rather than throwing, and settlement used to ignore the
 * answer and write `captured` or `refunded` anyway. A no-show fee the card
 * refused read as money taken, and a refund that never left read as money
 * returned. What this pins:
 *
 *   1. A refused fee leaves the hold as it was, writes what happened on the
 *      customer's timeline and the booking's history, and gives the business a
 *      task to collect it.
 *   2. A hold that could not be lifted stays held, with a note and no task:
 *      nobody is out any money, and it drops off by itself.
 *   3. A refund that did not go through leaves the deposit charged, and the
 *      business is asked to refund it by hand.
 *   4. A gateway that throws is the same answer as one that says no.
 *   5. What went through moves the deposit, only from the state it was decided
 *      in, and is written on the booking's history for the console to read.
 */

interface Booking {
  depositStatus: string | null;
}

let booking: Booking;
const statusWrites: string[] = [];
const history: { action: string; entityId: string; diff: Record<string, unknown> }[] = [];
const notes: { description: string; customerId: string | null; linkedEntityId: string }[] = [];
const tasks: { title: string; description: string; assignedToUserId: string }[] = [];

const tx = {
  booking: {
    updateMany: ({
      where,
      data,
    }: {
      where: { depositStatus: string };
      data: { depositStatus: string };
    }) => {
      if (booking.depositStatus !== where.depositStatus) return Promise.resolve({ count: 0 });
      statusWrites.push(data.depositStatus);
      booking = { depositStatus: data.depositStatus };
      return Promise.resolve({ count: 1 });
    },
  },
  auditLog: {
    create: ({ data }: { data: (typeof history)[number] }) => {
      history.push(data);
      return Promise.resolve(data);
    },
  },
  customer: {
    findUnique: () =>
      Promise.resolve({ firstName: 'Ana', lastName: 'Ruiz', email: 'ana.ruiz@example.test' }),
  },
  user: {
    findFirst: ({ where }: { where?: { id?: string; role?: string } }) =>
      Promise.resolve(
        where?.id === 'u-staff' || where?.role === 'owner' ? { id: where.id ?? 'u-owner' } : null
      ),
  },
  crmActivity: {
    create: ({ data }: { data: (typeof notes)[number] }) => {
      notes.push(data);
      return Promise.resolve(data);
    },
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

type GatewayCall = (...args: unknown[]) => Promise<{ success: boolean; errorMessage?: string }>;
const gateway = {
  capture: vi.fn<GatewayCall>(),
  cancel: vi.fn<GatewayCall>(),
  refund: vi.fn<GatewayCall>(),
};
vi.mock('@wizeworks/payments', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  paymentService: {
    capturePayment: (...args: unknown[]) => gateway.capture(...args),
    cancelPayment: (...args: unknown[]) => gateway.cancel(...args),
    refund: (...args: unknown[]) => gateway.refund(...args),
  },
}));
vi.mock('@wizeworks/crm', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  taskService: {
    dueAtIn: () => Promise.resolve(new Date('2026-10-03T23:59:00Z')),
    create: (_ctx: unknown, input: (typeof tasks)[number]) => {
      tasks.push(input);
      return Promise.resolve(input);
    },
  },
}));

const { settle } = await import('./booking-payments');
type Money = Parameters<typeof settle>[1][number];

const TENANT = 't-studio';

const money = (over: Partial<Money> = {}): Money => ({
  bookingId: 'b-1',
  ending: 'no_show',
  move: 'capture_fee',
  amountCents: 4000,
  paymentRef: 'pi_ana',
  currency: 'USD',
  customerId: 'c-ana',
  serviceName: 'Deep tissue massage',
  startAt: new Date('2026-10-06T21:30:00Z'),
  timezone: 'America/Denver',
  ...over,
});

const refused = (errorMessage: string) => Promise.resolve({ success: false, errorMessage });
const done = () => Promise.resolve({ success: true });

beforeEach(() => {
  booking = { depositStatus: 'held' };
  statusWrites.length = 0;
  history.length = 0;
  notes.length = 0;
  tasks.length = 0;
  gateway.capture.mockReset().mockImplementation(done);
  gateway.cancel.mockReset().mockImplementation(done);
  gateway.refund.mockReset().mockImplementation(done);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('a fee the card refused', () => {
  it('is not recorded as charged, and the business is asked to collect it', async () => {
    gateway.capture.mockImplementation(() => refused('Your card was declined.'));
    const [result] = await settle({ tenantId: TENANT, userId: 'u-staff' }, [money()]);

    expect(gateway.capture).toHaveBeenCalledWith(TENANT, 'pi_ana', 4000);
    expect(result).toMatchObject({ ok: false, error: 'Your card was declined.' });
    expect(statusWrites).toEqual([]);
    expect(booking.depositStatus).toBe('held');
    expect(history).toEqual([
      expect.objectContaining({
        action: 'booking.payment_not_settled',
        entityId: 'b-1',
        diff: {
          move: 'capture_fee',
          ending: 'no_show',
          amountCents: 4000,
          currency: 'USD',
          reason: 'Your card was declined.',
        },
      }),
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ customerId: 'c-ana', linkedEntityId: 'b-1' });
    expect(notes[0]!.description).toBe(
      "The $40.00 no-show fee for Ana Ruiz's Deep tissue massage booking on Tue, Oct 6 at 3:30 PM could not be charged to the card they left: Your card was declined. Nothing was charged."
    );
    expect(tasks).toEqual([
      expect.objectContaining({
        title: 'Ask Ana Ruiz for the $40.00 no-show fee: the card was not charged',
        assignedToUserId: 'u-staff',
      }),
    ]);
    expect(tasks[0]!.description).toContain('Nothing has been charged.');
  });

  it('a late cancellation says so, and goes to the owner when the customer canceled', async () => {
    gateway.capture.mockImplementation(() => refused('the hold has expired'));
    await settle({ tenantId: TENANT }, [money({ ending: 'cancel', amountCents: 2500 })]);

    expect(gateway.capture).toHaveBeenCalledWith(TENANT, 'pi_ana', 2500);
    expect(booking.depositStatus).toBe('held');
    expect(tasks[0]).toMatchObject({
      title: 'Ask Ana Ruiz for the $25.00 late-cancellation fee: the card was not charged',
      assignedToUserId: 'u-owner',
    });
  });

  it('a gateway that throws is the same answer as one that says no', async () => {
    gateway.capture.mockImplementation(() => Promise.reject(new Error('connect ETIMEDOUT')));
    const [result] = await settle({ tenantId: TENANT }, [money()]);

    expect(result?.ok).toBe(false);
    expect(booking.depositStatus).toBe('held');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.description).toContain('The charge did not go through: connect ETIMEDOUT.');
  });

  it('a fee that went through is recorded, and nobody is told anything', async () => {
    const [result] = await settle({ tenantId: TENANT, userId: 'u-staff' }, [money()]);
    expect(result?.ok).toBe(true);
    expect(booking.depositStatus).toBe('captured');
    expect(history).toEqual([
      expect.objectContaining({
        action: 'booking.payment_settled',
        diff: { move: 'capture_fee', ending: 'no_show', amountCents: 4000, currency: 'USD' },
      }),
    ]);
    expect(notes).toEqual([]);
    expect(tasks).toEqual([]);
  });
});

describe('a hold that could not be lifted', () => {
  it('stays held, with a note and no task', async () => {
    gateway.cancel.mockImplementation(() => refused('rate limited'));
    await settle({ tenantId: TENANT }, [money({ ending: 'complete', move: 'release_hold' })]);

    expect(statusWrites).toEqual([]);
    expect(booking.depositStatus).toBe('held');
    expect(history[0]?.action).toBe('booking.payment_not_settled');
    expect(notes[0]!.description).toContain(
      'the $40.00 hold on their card could not be lifted straight away (rate limited)'
    );
    expect(tasks).toEqual([]);
  });

  it('let go, it is recorded as returned', async () => {
    await settle({ tenantId: TENANT }, [money({ ending: 'cancel', move: 'release_hold' })]);
    expect(gateway.cancel).toHaveBeenCalledWith(TENANT, 'pi_ana');
    expect(booking.depositStatus).toBe('refunded');
  });
});

describe('a deposit to give back', () => {
  const deposit = (over: Partial<Money> = {}) =>
    money({ ending: 'cancel', move: 'refund_deposit', amountCents: 3000, ...over });

  beforeEach(() => {
    booking = { depositStatus: 'captured' };
  });

  it('a refund that did not go through leaves it charged, and asks for it by hand', async () => {
    gateway.refund.mockImplementation(() => refused('insufficient balance on the account'));
    await settle({ tenantId: TENANT, userId: 'u-staff' }, [deposit()]);

    expect(gateway.refund).toHaveBeenCalledWith({ tenantId: TENANT, chargeId: 'pi_ana' });
    expect(statusWrites).toEqual([]);
    expect(booking.depositStatus).toBe('captured');
    expect(tasks[0]).toMatchObject({ title: "Refund Ana Ruiz's $30.00 deposit by hand" });
    expect(notes[0]!.description).toContain('Nothing has been given back yet.');
  });

  it('a payment not yet made that could not be called off is flagged to check', async () => {
    booking = { depositStatus: 'held' };
    gateway.cancel.mockImplementation(() => refused('already processing'));
    await settle({ tenantId: TENANT }, [deposit({ move: 'call_off' })]);

    expect(booking.depositStatus).toBe('held');
    expect(tasks[0]).toMatchObject({
      title: "Check Ana Ruiz's $30.00 deposit: their booking was canceled",
    });
  });

  it('a refund that went through is recorded', async () => {
    await settle({ tenantId: TENANT }, [deposit()]);
    expect(booking.depositStatus).toBe('refunded');
    expect(tasks).toEqual([]);
  });

  it('a deposit kept asks nothing of the gateway', async () => {
    await settle({ tenantId: TENANT }, [deposit({ ending: 'no_show', move: 'keep_deposit' })]);
    expect(gateway.refund).not.toHaveBeenCalled();
    expect(gateway.capture).not.toHaveBeenCalled();
    expect(booking.depositStatus).toBe('forfeited');
    expect(history[0]).toMatchObject({
      action: 'booking.payment_settled',
      diff: { move: 'keep_deposit' },
    });
  });
});

describe('the deposit moves only from the state it was decided in', () => {
  it('a deposit someone already refunded is not kept over it', async () => {
    booking = { depositStatus: 'refunded' };
    await settle({ tenantId: TENANT }, [money({ move: 'keep_deposit' })]);
    expect(booking.depositStatus).toBe('refunded');
    expect(history).toEqual([]);
  });
});

describe('a canceled series', () => {
  it('settles every card, and one refusal does not stop the rest', async () => {
    gateway.capture
      .mockImplementationOnce(() => refused('Your card was declined.'))
      .mockImplementation(done);
    const results = await settle({ tenantId: TENANT }, [
      money({ bookingId: 'b-1', ending: 'cancel' }),
      money({ bookingId: 'b-2', ending: 'cancel' }),
    ]);
    expect(results.map((r) => [r.money.bookingId, r.ok])).toEqual([
      ['b-1', false],
      ['b-2', true],
    ]);
    expect(gateway.capture).toHaveBeenCalledTimes(2);
  });
});
