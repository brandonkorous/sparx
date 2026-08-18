// Coarse per-(site, client-ip) rate limit (docs/113 §7). In-process token
// buckets — the public routes downstream are also rate-limited, so this is just
// a blunt abuse cap. Replicas are few; per-instance drift is acceptable.

export class RateLimitError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    message: string
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Throws RateLimitError when `key` exceeds MAX_PER_WINDOW requests per minute. */
export function enforceRateLimit(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (bucket.count >= MAX_PER_WINDOW) {
    throw new RateLimitError(
      Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      'Too many requests — slow down.'
    );
  }
  bucket.count += 1;
}
