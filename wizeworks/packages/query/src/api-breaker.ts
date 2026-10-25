import { focusManager, type QueryCacheNotifyEvent, type QueryClient } from '@tanstack/react-query';

import { mightSucceedLater, retryAfterMs } from './retry-policy';

// One shared "the API is down" switch per browser client (PG-7). During an api-rest
// brownout ~12 pollers per open console each kept polling and retrying every 5xx
// twice, multiplying load on the API that was already failing. Once a few reads
// fail in a short window the breaker opens: interval polls stop (TanStack polls
// only while focused, so it reports the tab unfocused), default retries stop, and
// recovery.ts's single background probe is the only request, jittered and never
// sooner than the server's Retry-After. The first read that succeeds closes it.

const OPEN_AFTER_FAILURES = 3;
const FAILURE_WINDOW_MS = 30_000;

export class ApiBreaker {
  private failures: number[] = [];
  private open = false;
  private retryAfter = 0;

  isOpen(): boolean {
    return this.open;
  }

  recordFailure(error: unknown, now = Date.now()): void {
    if (!mightSucceedLater(error)) return;
    this.retryAfter = Math.max(this.retryAfter, retryAfterMs(error));
    this.failures = [...this.failures.filter((t) => now - t < FAILURE_WINDOW_MS), now];
    if (this.open || this.failures.length < OPEN_AFTER_FAILURES) return;
    this.open = true;
    focusManager.setFocused(false);
  }

  recordSuccess(): void {
    this.failures = [];
    this.retryAfter = 0;
    if (!this.open) return;
    this.open = false;
    // Back to what the page itself reports; a hidden tab stays hidden.
    focusManager.setFocused(undefined);
  }

  /** A probe wait with ±20% jitter, so tabs do not probe in step, and at least Retry-After. */
  probeDelay(baseMs: number, random: () => number = Math.random): number {
    return Math.max(Math.round(baseMs * (0.8 + random() * 0.4)), this.retryAfter);
  }
}

/** Feeds every read's outcome on `client` to the breaker. Returns the unsubscriber. */
export function watchApiHealth(client: QueryClient, breaker: ApiBreaker): () => void {
  return client.getQueryCache().subscribe((event: QueryCacheNotifyEvent) => {
    if (event.type !== 'updated') return;
    const { action } = event;
    if (action.type === 'failed' || action.type === 'error') breaker.recordFailure(action.error);
    else if (action.type === 'success') breaker.recordSuccess();
  });
}
