// An AI client ending a booking settles the card on it, the same as the console
// does (sparx persona issue 087). The tools that lived in the scheduling package
// ended the booking and never touched the card, so a booking an assistant
// canceled kept the hold, an on-time deposit was never refunded, and a no-show
// was never charged. They never announced the booking's event either.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fee = { bookingId: 'b-1', move: 'capture_fee', amountCents: 4000 };
const release = { bookingId: 'b-2', move: 'release_hold', amountCents: 4000 };

const scheduling = vi.hoisted(() => ({
  cancelBooking: vi.fn(),
  noShowBooking: vi.fn(),
  completeBooking: vi.fn(),
  cancelBookingSeries: vi.fn(),
}));
const settle = vi.hoisted(() => vi.fn<(ctx: unknown, moves: unknown[]) => Promise<unknown[]>>());
const steps = vi.hoisted(() => [] as string[]);
const published = vi.hoisted(() => [] as { type: string; payload: unknown }[]);

vi.mock('@wizeworks/scheduling', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...scheduling,
}));
vi.mock('@wizeworks/commerce', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  bookingPayments: {
    settle: (ctx: unknown, moves: unknown[]) => {
      steps.push('settle');
      return settle(ctx, moves);
    },
  },
}));
vi.mock('@wizeworks/api-core/pubsub', () => ({
  publish: (_log: unknown, type: string, _tenant: string, _actor: string, payload: unknown) => {
    steps.push('publish');
    published.push({ type, payload });
    return Promise.resolve();
  },
}));

const { schedulingEndingMcpTools } = await import('./scheduling-ending-tools.js');
const { ALL_MCP_TOOLS } = await import('./tool-registry.js');
// Each tool takes its own input; the registry runs them all as `unknown`.
interface Runnable {
  name: string;
  run(ctx: unknown, input: unknown): Promise<unknown>;
}
const tool = (name: string) =>
  (schedulingEndingMcpTools as unknown as Runnable[]).find((t) => t.name === name)!;
const ctx = { tenantId: 't-studio', userId: 'u-staff' };
const booking = (id: string, status: string) => ({ id, status });

beforeEach(() => {
  vi.clearAllMocks();
  steps.length = 0;
  published.length = 0;
  settle.mockImplementation((_ctx: unknown, moves: unknown[]) =>
    Promise.resolve(moves.map((money) => ({ money, ok: true })))
  );
});

describe('cancel_booking', () => {
  it('settles the card once the cancel has happened, then announces it', async () => {
    scheduling.cancelBooking.mockResolvedValue({
      booking: booking('b-1', 'cancelled'),
      money: fee,
    });
    const input = { id: 'b-1', reason: null, waiveFee: false, notifyCustomer: true };
    const result = await tool('cancel_booking').run(ctx, input);

    expect(scheduling.cancelBooking).toHaveBeenCalledWith('t-studio', input, 'u-staff');
    expect(settle).toHaveBeenCalledWith(ctx, [fee]);
    expect(steps).toEqual(['settle', 'publish']);
    expect(published).toEqual([
      { type: 'booking.cancelled', payload: { bookingId: 'b-1', reason: null } },
    ]);
    expect(result).toMatchObject({
      id: 'b-1',
      card: { bookingId: 'b-1', action: 'capture_fee', amountCents: 4000, done: true },
    });
  });

  it('says when the card did not move, rather than hiding it', async () => {
    scheduling.cancelBooking.mockResolvedValue({
      booking: booking('b-1', 'cancelled'),
      money: fee,
    });
    settle.mockResolvedValue([{ money: fee, ok: false, error: 'Your card was declined.' }]);
    const result = await tool('cancel_booking').run(ctx, {
      id: 'b-1',
      reason: null,
      waiveFee: false,
      notifyCustomer: true,
    });
    expect(result).toMatchObject({ card: { done: false, problem: 'Your card was declined.' } });
  });

  it('asks nothing of the card when there is nothing to settle', async () => {
    scheduling.cancelBooking.mockResolvedValue({
      booking: booking('b-1', 'cancelled'),
      money: null,
    });
    const result = await tool('cancel_booking').run(ctx, {
      id: 'b-1',
      reason: null,
      waiveFee: false,
      notifyCustomer: true,
    });
    expect(settle).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('card');
  });
});

describe('no_show_booking and complete_booking', () => {
  it('a no-show charges its fee, then is announced', async () => {
    scheduling.noShowBooking.mockResolvedValue({ booking: booking('b-1', 'no_show'), money: fee });
    await tool('no_show_booking').run(ctx, { id: 'b-1', waiveFee: false });
    expect(scheduling.noShowBooking).toHaveBeenCalledWith(
      't-studio',
      { id: 'b-1', waiveFee: false },
      'u-staff'
    );
    expect(settle).toHaveBeenCalledWith(ctx, [fee]);
    expect(steps).toEqual(['settle', 'publish']);
    expect(published[0]?.type).toBe('booking.no_show');
  });

  it('a completion lets the hold go, then is announced', async () => {
    scheduling.completeBooking.mockResolvedValue({
      booking: booking('b-2', 'completed'),
      money: release,
    });
    await tool('complete_booking').run(ctx, { bookingId: 'b-2' });
    expect(scheduling.completeBooking).toHaveBeenCalledWith('t-studio', 'b-2', 'u-staff');
    expect(settle).toHaveBeenCalledWith(ctx, [release]);
    expect(published[0]?.type).toBe('booking.completed');
  });
});

describe('cancel_booking_series', () => {
  it('settles every card in the series and announces every booking', async () => {
    scheduling.cancelBookingSeries.mockResolvedValue({
      id: 'series-1',
      cancelled: 3,
      bookingIds: ['b-1', 'b-2', 'b-3'],
      money: [fee, release],
    });
    const input = { id: 'series-1', scope: 'future', reason: null, waiveFee: false };
    const result = await tool('cancel_booking_series').run(ctx, input);

    expect(scheduling.cancelBookingSeries).toHaveBeenCalledWith('t-studio', input, 'u-staff');
    expect(settle).toHaveBeenCalledWith(ctx, [fee, release]);
    expect(steps).toEqual(['settle', 'publish', 'publish', 'publish']);
    expect(published.map((p) => (p.payload as { bookingId: string }).bookingId)).toEqual([
      'b-1',
      'b-2',
      'b-3',
    ]);
    expect(result).toMatchObject({ id: 'series-1', cancelled: 3 });
    expect((result as { cards: unknown[] }).cards).toHaveLength(2);
  });
});

describe('the registry', () => {
  it('publishes each booking-ending tool exactly once, and it is this one', () => {
    for (const name of [
      'cancel_booking',
      'no_show_booking',
      'complete_booking',
      'cancel_booking_series',
    ]) {
      const found = ALL_MCP_TOOLS.filter((t) => t.name === name);
      expect(found).toHaveLength(1);
      expect(found[0]).toBe(tool(name));
    }
  });
});
