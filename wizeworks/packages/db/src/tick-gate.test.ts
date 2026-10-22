import { describe, expect, it } from 'vitest';
import { poolSize, TickGate, tickSlots } from './tick-gate';

// The outage this exists for (2026-10-21): api-rest at a pool of 4, ten aligned
// ticks, each holding one connection for its lock and needing a second for its
// work. These model that pool, so the gate is tested against the deadlock it
// prevents rather than against its own counter.

/** A connection pool that, like Prisma's, gives up after `timeoutMs`. */
class FakePool {
  private free: number;
  private readonly waiting: (() => void)[] = [];

  constructor(size: number) {
    this.free = size;
  }

  async acquire(timeoutMs: number): Promise<() => void> {
    if (this.free > 0) {
      this.free--;
    } else {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.waiting.splice(this.waiting.indexOf(grant), 1);
          reject(new Error('P2024: Timed out fetching a new connection'));
        }, timeoutMs);
        const grant = () => {
          clearTimeout(timer);
          resolve();
        };
        this.waiting.push(grant);
      });
    }
    return () => {
      const next = this.waiting.shift();
      if (next) next();
      else this.free++;
    };
  }
}

/** One tick as withAdvisoryTickLock runs it: a lock connection, then a work one. */
async function tick(pool: FakePool): Promise<void> {
  const releaseLock = await pool.acquire(50);
  try {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const releaseWork = await pool.acquire(50);
    await new Promise((resolve) => setTimeout(resolve, 5));
    releaseWork();
  } finally {
    releaseLock();
  }
}

function startAligned(pool: FakePool, gate: TickGate | null, count: number) {
  return Promise.allSettled(
    Array.from({ length: count }, () => (gate ? gate.run(() => tick(pool)) : tick(pool)))
  );
}

describe('TickGate', () => {
  it('lets ten aligned ticks finish on a pool of four', async () => {
    const results = await startAligned(
      new FakePool(4),
      new TickGate(tickSlots({ DB_CONNECTION_LIMIT: '4' })),
      10
    );
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
  });

  it('is what stops the deadlock: without it the same ticks time out', async () => {
    const results = await startAligned(new FakePool(4), null, 10);
    expect(results.filter((r) => r.status === 'rejected').length).toBeGreaterThan(0);
  });

  it('runs queued ticks in the order they arrived', async () => {
    const gate = new TickGate(1);
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3, 4].map((n) =>
        gate.run(async () => {
          order.push(n);
          await new Promise((resolve) => setTimeout(resolve, 1));
        })
      )
    );
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('frees the slot when a tick throws', async () => {
    const gate = new TickGate(1);
    await expect(gate.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(gate.run(() => Promise.resolve('ran'))).resolves.toBe('ran');
  });
});

describe('tickSlots', () => {
  it.each([
    [{ DB_CONNECTION_LIMIT: '4' }, 1],
    [{ DB_CONNECTION_LIMIT: '8' }, 2],
    [{ DATABASE_URL: 'postgresql://u:p@h/db?connection_limit=20' }, 5],
    [{}, 1],
    [{ DB_CONNECTION_LIMIT: 'nope' }, 1],
  ])('gives %j %i slot(s)', (env, slots) => {
    expect(tickSlots(env)).toBe(slots);
  });

  it('reads the URL first, as client.ts does when both are set', () => {
    expect(
      poolSize({ DB_CONNECTION_LIMIT: '4', DATABASE_URL: 'postgresql://h/db?connection_limit=12' })
    ).toBe(12);
  });
});
