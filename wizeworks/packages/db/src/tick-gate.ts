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
// This module needs no database, so it can be tested without one.

import { connectionLimit } from './connection-limit';

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

/** The pool size this process runs with; the same answer client.ts opens with. */
export function poolSize(env: Record<string, string | undefined>): number {
  return connectionLimit(env).limit;
}

/** Ticks allowed inside their lock at once: a quarter of the pool, at least one. */
export function tickSlots(env: Record<string, string | undefined>): number {
  return Math.max(1, Math.floor(poolSize(env) / 4));
}
