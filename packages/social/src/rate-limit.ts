// Per-connection rate limiting (docs/133 §7, docs/social-audit slice 13).
//
// The shape of the problem: one composed post fans out to every destination under a
// grant, and a bulk import or a busy calendar can put several posts through the same
// grant back to back. Platforms publish a per-account quota; hitting it earns a `429`,
// and hammering through a `429` earns a longer block. So the fan-out has to pace itself
// per CONNECTION — not globally, since two tenants' accounts have nothing to do with
// each other, and not per post, since the quota is the account's.
//
// A token bucket, deliberately in memory and deliberately per-worker-instance. Shared
// state across instances would mean Redis for a problem that is already bounded: a drain
// handles one post at a time, and the far bigger win is honouring a `Retry-After` the
// platform actually sent. When a platform says "wait 90 seconds", we wait — and every
// other destination on that same grant waits too, because they share the quota.
//
// Pure and injectable-clock so it is testable without sleeping.

/** How many calls a connection may make before pacing kicks in. */
const DEFAULT_BURST = 8;

/** Sustained rate once the burst is spent — one call every this many ms. */
const DEFAULT_INTERVAL_MS = 1_200;

interface Bucket {
  /** Fractional tokens available. */
  tokens: number;
  /** When the bucket was last refilled. */
  lastRefillMs: number;
  /** Set when a platform told us to back off; nothing goes out before it. */
  blockedUntilMs: number;
}

export interface RateLimiterOptions {
  burst?: number;
  intervalMs?: number;
  /** Injectable for tests. */
  now?: () => number;
}

/**
 * A per-key token bucket with an explicit back-off gate.
 *
 * `take()` returns how long to wait before the call may proceed — 0 when it can go now.
 * The caller decides whether to sleep or to defer the work; the limiter never sleeps on
 * its own, because a worker draining a post and a worker polling an inbox want different
 * answers to "what do I do while I wait?".
 */
export class SocialRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly burst: number;
  private readonly intervalMs: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions = {}) {
    this.burst = options.burst ?? DEFAULT_BURST;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  /** Milliseconds to wait before a call on `key` may proceed. Consumes a token when the
   *  answer is 0. */
  take(key: string): number {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.burst,
      lastRefillMs: now,
      blockedUntilMs: 0,
    };

    // A platform-imposed block outranks everything: it is the one number we did not
    // guess at.
    if (bucket.blockedUntilMs > now) {
      this.buckets.set(key, bucket);
      return bucket.blockedUntilMs - now;
    }

    // Refill by elapsed time, capped at the burst size.
    const elapsed = now - bucket.lastRefillMs;
    bucket.tokens = Math.min(this.burst, bucket.tokens + elapsed / this.intervalMs);
    bucket.lastRefillMs = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return 0;
    }

    // Not enough for a whole token — how long until there is one.
    const waitMs = Math.ceil((1 - bucket.tokens) * this.intervalMs);
    this.buckets.set(key, bucket);
    return waitMs;
  }

  /**
   * Record that the platform asked this connection to back off.
   *
   * Applies to the KEY, not the call: every destination under the same grant shares the
   * quota, so one `429` on a Page pauses its siblings too. That is the difference between
   * backing off and taking turns being rejected.
   */
  backOff(key: string, seconds: number): void {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: 0,
      lastRefillMs: now,
      blockedUntilMs: 0,
    };
    bucket.blockedUntilMs = Math.max(bucket.blockedUntilMs, now + Math.max(0, seconds) * 1000);
    // Drain the bucket as well, so the moment the block lifts we don't immediately spend
    // a full burst into a platform that just complained.
    bucket.tokens = 0;
    bucket.lastRefillMs = now;
    this.buckets.set(key, bucket);
  }

  /** Whether this key is currently inside a platform-imposed back-off. */
  isBlocked(key: string): boolean {
    const bucket = this.buckets.get(key);
    return bucket !== undefined && bucket.blockedUntilMs > this.now();
  }

  /** Drop a key's state — used by tests and by a disconnect. */
  reset(key?: string): void {
    if (key === undefined) this.buckets.clear();
    else this.buckets.delete(key);
  }
}

/** The process-wide limiter. One per worker instance, keyed by connection id. */
export const socialRateLimiter = new SocialRateLimiter();
