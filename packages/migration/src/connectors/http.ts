// Talking to somebody else's API, on behalf of a person who did not ask to know that
// is what is happening.
//
// Two jobs. The first is turning every way a vendor API can fail into a sentence a
// business owner can act on: a 401 is "that key is not right", not "401". The second
// is surviving the rate limits all three of these platforms have — HubSpot and
// Shopify both throttle a migration-shaped burst almost immediately, and a pull that
// gives up at the first 429 would fail on every catalogue big enough to be worth
// moving.

import type { FetchLike, HttpRequest } from './types';

/**
 * A failure with something useful to say.
 *
 * `hint` is the second line the tenant reads, and it exists because the first line is
 * usually the vendor's and the vendor is not talking to them.
 */
export class ConnectorError extends Error {
  readonly status: number;
  readonly hint: string | undefined;
  /** True when trying again later could work — a rate limit, an outage. */
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { status?: number; hint?: string; retryable?: boolean } = {}
  ) {
    super(message);
    this.name = 'ConnectorError';
    this.status = options.status ?? 0;
    this.hint = options.hint;
    this.retryable = options.retryable ?? false;
  }
}

/**
 * Hostnames and IP literals we will not fetch, whoever asks.
 *
 * The WordPress connector takes a site address from the tenant, and our API is what
 * fetches it — so without this, an editor could point a "migration" at the cloud
 * metadata endpoint or at a service inside the cluster and read the response back
 * out of the preview. This is the syntactic half of that guard and lives here so the
 * browser applies it too; api-rest adds the other half by resolving the hostname and
 * refusing private addresses, which is the part this package cannot do (no DNS in a
 * browser, and no node: imports in an isomorphic package).
 */
const BLOCKED_HOSTS = /^(localhost|.*\.local|.*\.internal|.*\.localdomain|metadata\..*)$/i;

const BLOCKED_IPV4 =
  /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/**
 * Check a URL before anything fetches it. Throws rather than returning false, because
 * every caller would have thrown anyway and a boolean invites forgetting to.
 */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConnectorError(`"${raw}" is not a web address.`, {
      hint: 'It should look like https://yourshop.com.',
    });
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ConnectorError('That address is not a website.', {
      hint: 'It has to start with https://.',
    });
  }

  // A URL carrying credentials in front of the host is how a blocked host gets
  // smuggled past a naive check (`https://api.hubapi.com@169.254.169.254/`).
  if (url.username !== '' || url.password !== '') {
    throw new ConnectorError('That address has a login built into it, which we will not follow.', {
      hint: 'Use the plain web address and put the key in the field below it.',
    });
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.test(host) || BLOCKED_IPV4.test(host) || host === '::1' || host === '::') {
    throw new ConnectorError(`We cannot reach ${url.hostname} from here.`, {
      hint: 'That address is on a private network. Use the public address of your site.',
    });
  }

  return url;
}

/** Only https for the platforms whose address we do not take from the tenant. */
export function assertHttps(raw: string): URL {
  const url = assertSafeUrl(raw);
  if (url.protocol !== 'https:') {
    throw new ConnectorError('That connection would not be encrypted.', {
      hint: 'The address has to start with https://.',
    });
  }
  return url;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 4;

export interface RequestOptions extends HttpRequest {
  /** What the tenant is having done, for the error sentence: "your products". */
  what?: string;
  /** Overridden in tests so a retry does not cost the suite four real seconds. */
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `Retry-After` is either a number of seconds or an HTTP date; both are in the wild. */
function retryDelayMs(response: HttpLikeHeaders, attempt: number): number {
  const header = response.get('retry-after');
  if (header !== null && header.trim() !== '') {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 20_000);
    const at = Date.parse(header);
    if (!Number.isNaN(at)) return Math.min(Math.max(at - Date.now(), 0), 20_000);
  }
  // Exponential, and jitter-free on purpose: this runs one pull at a time for one
  // tenant, so there is no thundering herd to spread out.
  return Math.min(500 * 2 ** attempt, 8_000);
}

interface HttpLikeHeaders {
  get(name: string): string | null;
}

function describeStatus(status: number, what: string, body: string): ConnectorError {
  const snippet = body.trim().slice(0, 300);

  if (status === 401 || status === 403) {
    return new ConnectorError(`Those details did not let us read ${what}.`, {
      status,
      hint: 'Check the key was copied whole, and that it has permission to read this. Some platforms make you tick each kind of data separately.',
    });
  }
  if (status === 404) {
    return new ConnectorError(`We could not find ${what} at that address.`, {
      status,
      hint: 'Check the web address is the one people visit, with no extra path after it.',
    });
  }
  if (status === 429) {
    return new ConnectorError(`Your old platform asked us to slow down while reading ${what}.`, {
      status,
      retryable: true,
      hint: 'Wait a minute and pick up where it stopped — nothing already brought over is lost.',
    });
  }
  if (status >= 500) {
    return new ConnectorError(`Your old platform had a problem while we read ${what}.`, {
      status,
      retryable: true,
      hint: 'This is at their end. Try again in a few minutes.',
    });
  }
  return new ConnectorError(`We could not read ${what}.`, {
    status,
    hint: snippet === '' ? undefined : `Your old platform said: ${snippet}`,
  });
}

/**
 * One JSON request, with retries on the failures that are worth retrying.
 *
 * Returns the parsed body as `unknown` deliberately — every caller narrows it with
 * its own reader, so a vendor changing a field's type shows up as a missing value
 * rather than as a crash halfway through a tenant's catalogue.
 */
export async function requestJson(
  fetchLike: FetchLike,
  url: string,
  options: RequestOptions = {}
): Promise<unknown> {
  const { what = 'your data', sleep = defaultSleep, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  assertSafeUrl(url);

  let lastError: ConnectorError | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // A hung vendor must not hold the request open until the proxy kills it — the
    // tenant would see a blank failure with nothing to act on.
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer =
      controller === null ? null : setTimeout(() => controller.abort(), Math.max(timeoutMs, 1_000));

    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await fetchLike(url, {
        method: options.method ?? 'GET',
        ...(options.headers === undefined ? {} : { headers: options.headers }),
        ...(options.body === undefined ? {} : { body: options.body }),
        ...(options.signal === undefined
          ? controller === null
            ? {}
            : { signal: controller.signal }
          : { signal: options.signal }),
      });
    } catch (error) {
      lastError = new ConnectorError(`We could not reach your old platform to read ${what}.`, {
        retryable: true,
        hint:
          error instanceof Error && error.name === 'AbortError'
            ? 'It took too long to answer. Try again — big catalogues sometimes need a second run.'
            : 'Check the web address, and that the site is up.',
      });
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(retryDelayMs({ get: () => null }, attempt));
        continue;
      }
      throw lastError;
    } finally {
      if (timer !== null) clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = describeStatus(response.status, what, body);
      if (error.retryable && attempt < MAX_ATTEMPTS - 1) {
        lastError = error;
        await sleep(retryDelayMs(response.headers, attempt));
        continue;
      }
      throw error;
    }

    const text = await response.text();
    if (text.trim() === '') return null;
    try {
      return JSON.parse(text);
    } catch {
      // Almost always a login wall or a maintenance page returned with a 200.
      throw new ConnectorError(`Your old platform did not answer with data when we read ${what}.`, {
        status: response.status,
        hint: 'That address returned a web page rather than data. Check it is the site itself and not a holding page or a login screen.',
      });
    }
  }

  throw lastError ?? new ConnectorError(`We could not read ${what}.`);
}

// ── Reading somebody else's JSON ─────────────────────────────────────────────
//
// Every connector walks an unknown object graph, and doing it with casts is how one
// missing field becomes a crash mid-catalogue. These four are the whole vocabulary.

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Any scalar as the string a canonical row holds. Objects and null become ''. */
export function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

/** Walk a path, tolerating anything missing on the way down. */
export function dig(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** `dig`, flattened to a string. The most common shape by far. */
export function digText(value: unknown, ...path: string[]): string {
  return asText(dig(value, ...path));
}

/** The first value that is actually there. Vendors spread one fact across two or
 *  three fields depending on how the record was created, and `||` on a string is
 *  both the obvious way to write this and the one the linter refuses. */
export function firstText(...values: (string | undefined)[]): string {
  for (const value of values) if (value !== undefined && value !== '') return value;
  return '';
}

/** Build a query string, dropping anything empty. */
export function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}
