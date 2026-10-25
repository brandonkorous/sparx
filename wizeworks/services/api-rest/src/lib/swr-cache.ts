// A per-pod stale-while-revalidate cache: a stale value is served at once while one
// background load refreshes it. Only the very first read of a key waits (PG-2.3).

export interface SwrCacheOptions {
  /** How long a value is fresh. After this it is served stale and refreshed. */
  freshMs: number;
  /** How long a stale value may still be served; older, a read waits for the load. */
  maxStaleMs: number;
  /** Told when a background refresh fails; the stale value stays. */
  onRefreshError?: (key: string, err: unknown) => void;
}

interface Entry<T> {
  value: T;
  loadedAt: number;
}

export interface SwrCache<T> {
  get(key: string, load: () => Promise<T>): Promise<T>;
}

export function createSwrCache<T>(options: SwrCacheOptions): SwrCache<T> {
  const entries = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  function refresh(key: string, load: () => Promise<T>): Promise<T> {
    const pending = inflight.get(key);
    if (pending) return pending;
    const promise = load()
      .then((value) => {
        entries.set(key, { value, loadedAt: Date.now() });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  function get(key: string, load: () => Promise<T>): Promise<T> {
    const entry = entries.get(key);
    const age = entry ? Date.now() - entry.loadedAt : Infinity;
    if (entry && age < options.freshMs) return Promise.resolve(entry.value);
    if (!entry || age >= options.maxStaleMs) return refresh(key, load);
    refresh(key, load).catch((err: unknown) => options.onRefreshError?.(key, err));
    return Promise.resolve(entry.value);
  }

  return { get };
}
