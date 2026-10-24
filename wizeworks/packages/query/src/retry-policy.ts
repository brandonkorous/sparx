// What a failed read means for asking again: shared by the retry option, the
// background probe (recovery.ts) and the API breaker (api-breaker.ts).

/** The HTTP status behind a rejection, read structurally: `status: number` is the contract. */
export function httpStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

/** The server's Retry-After in ms, read structurally from `retryAfterSeconds`, or 0. */
export function retryAfterMs(error: unknown): number {
  if (typeof error !== 'object' || error === null || !('retryAfterSeconds' in error)) return 0;
  const seconds = error.retryAfterSeconds;
  return typeof seconds === 'number' && seconds > 0 ? seconds * 1000 : 0;
}

// A 4xx is still true a second later, except 408 and 429; a 5xx or no status at all might pass.
export function mightSucceedLater(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === null) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

export type RetryOption = boolean | number | ((failureCount: number, error: unknown) => boolean);
export type RetryDelayOption = number | ((failureCount: number, error: unknown) => number);

/** TanStack's own reading of a `retry` option, including its client default of 3. */
export function retryWanted(
  retry: RetryOption | undefined,
  failures: number,
  error: unknown
): boolean {
  if (typeof retry === 'function') return retry(failures, error);
  if (typeof retry === 'number') return failures < retry;
  if (retry === undefined) return failures < 3;
  return retry;
}

/** TanStack's own reading of a `retryDelay` option, including its default backoff. */
export function retryDelayFor(
  delay: RetryDelayOption | undefined,
  failures: number,
  error: unknown
): number {
  if (typeof delay === 'function') return delay(failures, error);
  if (typeof delay === 'number') return delay;
  return Math.min(1000 * 2 ** failures, 30_000);
}
