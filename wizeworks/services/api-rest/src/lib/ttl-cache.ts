// A tiny in-process, read-through TTL cache with single-flight de-duplication and a
// bounded size. It exists to relieve the hot public-read resolutions (host→route,
// tenant+slug→propertyId) that would otherwise open an interactive transaction — and
// pin one of PgBouncer's limited transaction-mode server slots (DEFAULT_POOL_SIZE) —
// on EVERY storefront request. Left uncached those resolvers both saturate that shared
// pool and starve under it, surfacing as the prod P2028 "Unable to start a transaction
// in the given time" bursts (see lib/domain.ts for the full context).
//
// Semantics:
//   • read-through: `get(key, load)` returns the cached value or runs `load()` once.
//   • single-flight: concurrent misses for the same key share ONE in-flight `load()`,
//     so a traffic burst for a key opens one transaction, not one per queued request.
//   • bounded: oldest-first eviction past `maxEntries` caps memory against key floods
//     (e.g. random-host scanners). delete-then-set keeps eviction recency-ordered.
//   • per-pod: each replica has its own cache; staleness is bounded by the TTL. A
//     value that changes (domain connected, site renamed) reflects within one TTL.
//
// NOT a security boundary. Keys MUST embed the already-resolved tenant_id (never a
// raw caller-supplied value) so one tenant's entry can never satisfy another's read.

export interface TtlCacheOptions {
  /** How long a resolved (non-null) value stays fresh. */
  hitTtlMs: number;
  /** How long a null/undefined ("miss") result stays cached. Defaults to `hitTtlMs`.
   *  Keep this short for negative results that flip positive soon (a host mid-connect,
   *  a slug for a site being created) so the transition isn't masked for long. */
  missTtlMs?: number;
  /** Memory backstop — oldest entry is evicted past this. Defaults to 5000. */
  maxEntries?: number;
}

export interface ReadThroughCache<T> {
  /** Return the cached value for `key`, else run `load()` once (single-flighted),
   *  cache the result under the appropriate TTL, and return it. */
  get(key: string, load: () => Promise<T>): Promise<T>;
}

interface Entry<T> {
  value: T;
  expires: number;
}

export function createTtlCache<T>(options: TtlCacheOptions): ReadThroughCache<T> {
  const hitTtl = options.hitTtlMs;
  const missTtl = options.missTtlMs ?? options.hitTtlMs;
  const maxEntries = options.maxEntries ?? 5000;

  const entries = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  function get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = entries.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);

    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        const isMiss = value === null || value === undefined;
        // delete-then-set moves refreshed keys to the tail so eviction is recency-ordered.
        entries.delete(key);
        entries.set(key, { value, expires: Date.now() + (isMiss ? missTtl : hitTtl) });
        if (entries.size > maxEntries) {
          const oldest = entries.keys().next().value;
          if (oldest !== undefined) entries.delete(oldest);
        }
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  return { get };
}
