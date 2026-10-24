// A READ OF A PUBLIC api-rest PATH that tells "not there" from "could not ask".
//
// The marketing site turned every failure into null, so when api-rest was
// unreachable for a moment (ECONNREFUSED, 2026-10-19 and 10-20) a live listing
// answered 404 and the sitemap dropped every listing. This keeps the two apart:
// `not-found` is api-rest saying no, `unavailable` is api-rest not answering.
// A refused connection or a 502/503/504 is tried again twice; a timeout is not,
// because a slow server is not helped by more requests.

/** What a public read found. */
export type PublicResult<T> =
  { ok: true; data: T } | { ok: false; reason: 'not-found' | 'unavailable' };

export interface PublicReadOptions {
  /** Seconds Next's data cache keeps the answer. */
  revalidate: number;
  /** Per-attempt limit. Default 5 seconds. */
  timeoutMs?: number;
  /** The wait before each retry. Default 250 ms, then 750 ms. */
  retryDelaysMs?: readonly number[];
  /** For tests. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** api-rest did not answer. Thrown so Next keeps serving the last good page. */
export class PublicApiUnavailableError extends Error {
  constructor(url: string) {
    super(`api-rest is unavailable: ${new URL(url).pathname}`);
    this.name = 'PublicApiUnavailableError';
  }
}

const RETRY_STATUS = new Set([502, 503, 504]);
const DEFAULT_DELAYS = [250, 750] as const;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** GET `url` and unwrap api-rest's `{ success, data }` envelope. */
export async function readPublicApi<T>(
  url: string,
  options: PublicReadOptions
): Promise<PublicResult<T>> {
  const delays = options.retryDelaysMs ?? DEFAULT_DELAYS;
  const sleep = options.sleep ?? wait;
  for (let attempt = 0; ; attempt++) {
    const outcome = await readOnce<T>(url, options);
    if (outcome !== 'retry') return outcome;
    const delay = delays[attempt];
    if (delay === undefined) return { ok: false, reason: 'unavailable' };
    await sleep(delay);
  }
}

async function readOnce<T>(
  url: string,
  options: PublicReadOptions
): Promise<PublicResult<T> | 'retry'> {
  let res: Response;
  try {
    // `next` is Next's data-cache option; plain fetch ignores it.
    const init = {
      next: { revalidate: options.revalidate },
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    } as RequestInit;
    res = await (options.fetchImpl ?? fetch)(url, init);
  } catch (err) {
    return isTimeout(err) ? { ok: false, reason: 'unavailable' } : 'retry';
  }
  if (RETRY_STATUS.has(res.status)) return 'retry';
  if (res.status >= 500) return { ok: false, reason: 'unavailable' };
  if (!res.ok) return { ok: false, reason: 'not-found' };
  try {
    const body = (await res.json()) as { success?: boolean; data?: T };
    return body.success ? { ok: true, data: body.data as T } : { ok: false, reason: 'not-found' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

function isTimeout(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'TimeoutError'
  );
}

/** The data, or null when api-rest says there is none. Throws when api-rest is
 *  unreachable, except during `next build`, which must not fail on it. */
export async function readPublicData<T>(
  url: string,
  options: PublicReadOptions
): Promise<T | null> {
  const result = await readPublicApi<T>(url, options);
  if (result.ok) return result.data;
  if (result.reason === 'not-found' || isBuildPhase()) return null;
  throw new PublicApiUnavailableError(url);
}

/** `fallback` instead of the throw, for a caller that can say "try again". */
export async function orWhenUnavailable<T, F>(read: Promise<T>, fallback: F): Promise<T | F> {
  try {
    return await read;
  } catch (err) {
    if (err instanceof PublicApiUnavailableError) return fallback;
    throw err;
  }
}

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}
