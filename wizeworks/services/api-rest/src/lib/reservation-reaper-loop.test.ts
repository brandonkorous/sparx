// Sparx persona issue 335: off the cluster nothing released a cart hold, so a
// basket left in a closed tab kept Gillett's last injector "Sold out".

import { describe, expect, it, vi } from 'vitest';

const reaped: string[] = [];
vi.mock('@wizeworks/db', () => ({
  ADVISORY_LOCKS: { RESERVATION_REAPER: 1 },
  withAdvisoryTickLock: (_key: number, _skipped: unknown, fn: () => unknown) => fn(),
}));
vi.mock('@wizeworks/commerce', () => ({
  commerceSchedulers: {
    listCommerceActiveTenants: () => Promise.resolve([{ id: 't1' }, { id: 't2' }, { id: 't3' }]),
    reapExpiredReservations: ({ tenantId }: { tenantId: string }) => {
      reaped.push(tenantId);
      if (tenantId === 't2') return Promise.reject(new Error('one bad business'));
      return Promise.resolve({ tenantId, released: tenantId === 't1' ? 2 : 1 });
    },
  },
}));

const { runReservationReaperTick, startReservationReaperLoop } =
  await import('./reservation-reaper-loop.js');
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

describe('the reservation reaper off the cluster', () => {
  it('releases every selling business’s expired holds, past one that fails', async () => {
    expect(await runReservationReaperTick(logger)).toEqual({ acquired: true, released: 3 });
    expect(reaped).toEqual(['t1', 't2', 't3']);
  });

  it('does not run in production, where the CronJob is the runner', () => {
    vi.useFakeTimers();
    reaped.length = 0;
    const stop = startReservationReaperLoop(logger, true);
    vi.advanceTimersByTime(120_000);
    expect(reaped).toEqual([]);
    stop();
    vi.useRealTimers();
  });
});
