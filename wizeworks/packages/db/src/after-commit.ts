// Work that must not happen until the transaction it belongs to has COMMITTED.
//
// ── The failure this exists to end ───────────────────────────────────────
//
// A service writes its row inside `withTenant`, then announces it:
//
//     const order = await withTenant(ctx, (tx) => tx.order.create({ … }));
//     await publishPlatformEvent({ topic: 'order.created', … });
//
// Correct as written, because `withTenant` committed before it returned. But
// `TenantContext.tx` lets a caller compose that same service INTO its own open
// transaction, and then `withTenant` returns having committed nothing — so the
// announcement goes out while the row is still invisible to everybody else.
//
// The consumers are in-process and synchronous, and they open their OWN
// transactions, so they see a database in which the thing just announced does
// not exist. On storefront checkout that produced:
//
//   • a customer's history reading "An order was placed ($276.00)", naming no
//     order, because the number was read back and came out null (issue 307);
//   • the buyer re-scored and re-segmented as though the order had not happened,
//     since both evaluators count orders and the order was not there to count.
//
// And if the enclosing transaction then rolled back, the announcement had
// already gone: an order.created for an order that never existed.
//
// ── The contract ────────────────────────────────────────────────────────
//
// `afterCommit(fn)` runs `fn` when the OUTERMOST open transaction commits, or
// immediately when no transaction is open. Callers say what they mean once and
// get the right timing whether or not somebody later composes them into a
// larger unit of work.
//
// Rollback discards the queue: nothing is announced for work that was undone.
//
// A callback that throws is logged and does not propagate. By the time it runs
// the write is a committed fact, and turning a failed ANNOUNCEMENT into a failed
// CALL tells a shopper their checkout failed after their order was placed. The
// log names the tenant, because a recovered failure has nothing else to notice
// it (the same reason the platform bus's own catch names one).

import { AsyncLocalStorage } from 'node:async_hooks';

export interface AfterCommitTask {
  /** What it is, for the log line when it fails. e.g. "publish order.created". */
  label: string;
  run: () => Promise<void>;
}

const storage = new AsyncLocalStorage<AfterCommitTask[]>();

/**
 * Register work to run once the enclosing transaction commits.
 *
 * With no transaction open the work runs NOW, awaited, so a caller outside one
 * behaves exactly as it did before this existed.
 */
export async function afterCommit(label: string, run: () => Promise<void>): Promise<void> {
  const queue = storage.getStore();
  if (!queue) {
    await run();
    return;
  }
  queue.push({ label, run });
}

/**
 * Open a queue for the duration of one transaction and drain it on success.
 *
 * Only `withTenant`'s transaction-OPENING branch calls this. The composing
 * branch deliberately does not, so a nested call inherits the outer queue and
 * one commit fires everything registered beneath it.
 */
export async function withCommitQueue<T>(run: () => Promise<T>): Promise<T> {
  const queue: AfterCommitTask[] = [];
  const result = await storage.run(queue, run);
  await drain(queue);
  return result;
}

/** Sequential, so events announcing one unit of work keep their order. */
async function drain(queue: AfterCommitTask[]): Promise<void> {
  for (const task of queue) {
    try {
      await task.run();
    } catch (err) {
      console.error('[after-commit] task failed', { label: task.label, err });
    }
  }
}

/** True while a transaction is open on this async context. Exposed for tests
 *  that assert the deferral actually happens rather than the effect merely
 *  arriving eventually. */
export function inTransaction(): boolean {
  return storage.getStore() !== undefined;
}
