// A short-TTL Redis cache for resolved metrics (docs/129 §5).
//
// Historical buckets are immutable — only the open day is hot — so even a
// 60–300s TTL is highly effective, and several dashboards showing overlapping
// ranges share cache entries rather than each re-running the query. The cache
// reuses the SAME Redis the WebSocket fan-out already uses (the Phase-1 cluster
// pod), so this adds a logical use, not a service.
//
// It is deliberately BEST-EFFORT and OPTIONAL: `REDIS_URL` is unset in dev, and a
// Redis hiccup must never turn a working report into an error. Every failure —
// no client, a get that throws, a parse that fails — degrades to a cache miss and
// the metric resolves live.

import { Redis, type Redis as RedisClient } from 'ioredis';
import { env } from '../../env.js';

// `undefined` = not yet initialised; `null` = no REDIS_URL, caching disabled.
let client: RedisClient | null | undefined;

function getClient(): RedisClient | null {
  if (client !== undefined) return client;
  if (!env.REDIS_URL) {
    client = null;
    return null;
  }
  // Construct lazily, and let a construction failure disable the cache rather
  // than crash the process.
  try {
    const instance = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      // A reporting cache is not worth an endless reconnect storm; give up quietly
      // and resolve live if Redis is unreachable.
      enableOfflineQueue: false,
    });
    instance.on('error', () => {
      /* swallow — a cache error is a miss, never a page error */
    });
    client = instance;
  } catch {
    client = null;
  }
  return client;
}

/** The default TTL — the open bucket refreshes within a couple of minutes, and a
 *  stale figure for that long on a dashboard is a non-issue. */
export const METRIC_TTL_SECONDS = 120;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = METRIC_TTL_SECONDS
): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* best-effort: a failed write just means the next read is a miss */
  }
}

/** Build a cache key. Historical windows are immutable, so the range bounds are
 *  part of the key and old windows stay cached until they age out. */
export function metricCacheKey(parts: {
  tenantId: string;
  propertyId: string | null;
  metric: string;
  shape: string;
  fromISO: string;
  toExclusiveISO: string;
  grain: string;
  limit?: number;
}): string {
  return [
    'analytics:v1',
    parts.tenantId,
    parts.propertyId ?? 'all',
    parts.metric,
    parts.shape,
    parts.fromISO,
    parts.toExclusiveISO,
    parts.grain,
    parts.limit ?? '',
  ].join(':');
}
