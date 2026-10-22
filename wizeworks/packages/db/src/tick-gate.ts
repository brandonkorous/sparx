// How many background ticks one PROCESS may run under their advisory lock at once.
//
// `withAdvisoryTickLock` pins one pool connection for a tick's whole duration
// (the lock transaction) and the tick's work then needs ANOTHER connection from
// the same pool. So a pool of N with N ticks inside their locks has nothing left
// for the work: every tick waits on a connection only another waiting tick can
// free, and they all die with P2024 / P2028.
//
// That is not hypothetical. api-rest's loops start within milliseconds of each
// other at boot and stay aligned (each reschedules a fixed interval after it
// ends). With one pod at a pool of 8 they fit. On 2026-10-21 api-rest went to
// two pods at 4 each, the aligned ticks filled all four, and email dispatch,
// scheduled publishing, webhooks and social sweeps failed every few minutes.
//
// The gate admits a quarter of the pool (at least one) and QUEUES the rest in
// arrival order. Queueing, not skipping: the loops are aligned, so a tick that
// skipped when the gate was full would find it full at the same moment next
// time, and never run. Every loop reschedules itself only after its tick
// returns, so a queued tick can never be queued twice.
//
// This module imports nothing, so it can be tested without a database.

/** A FIFO counting semaphore. */
export class TickGate {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(readonly slots: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active < this.slots) {
      this.active++;
    } else {
      // The slot is handed over by `release`, so `active` is not incremented here.
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
}

/** The pool size this process runs with, or null when Prisma picks its own. */
export function poolSize(env: Record<string, string | undefined>): number | null {
  const explicit = Number(env.DB_CONNECTION_LIMIT?.trim());
  if (Number.isInteger(explicit) && explicit > 0) {
    // An explicit `connection_limit` in the URL wins in client.ts, so it wins here too.
    return fromUrl(env.DATABASE_URL) ?? explicit;
  }
  return fromUrl(env.DATABASE_URL);
}

function fromUrl(url: string | undefined): number | null {
  const match = url ? /[?&]connection_limit=(\d+)/.exec(url) : null;
  const n = match ? Number(match[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Ticks allowed inside their lock at once: a quarter of the pool, at least one.
 * Three quarters stay free for the ticks' own work and for HTTP requests.
 * An unknown pool is Prisma's default, as small as 3, so it gets one.
 */
export function tickSlots(env: Record<string, string | undefined>): number {
  const size = poolSize(env);
  return size === null ? 1 : Math.max(1, Math.floor(size / 4));
}
