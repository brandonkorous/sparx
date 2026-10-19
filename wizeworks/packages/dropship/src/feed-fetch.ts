// Fetching a supplier's feed from an address a tenant typed (sparx persona issue 363).
//
// A CSV-feed supplier is connected with a URL, and the server fetches it: to test
// the connection, to list the catalog, to import. Nothing checked where the URL
// pointed, so any business's admin could have the platform fetch an address on
// its own network (a cluster service, a cloud metadata address) and read what
// came back as a "catalog". This is the one way a feed is fetched: http or https
// only, to a host whose every address is public, and each redirect is checked
// the same way before it is followed.
//
// Looking a host up needs the server's DNS, which this package does not reach
// for itself: the caller hands it in (`FeedDeps.resolveHost`, Node's `lookup`).
// Without one, a feed named by host is refused, never fetched unchecked.
//
// Outside production, the business's own machine (loopback) is allowed, so a
// feed can be served locally while building. Nothing else private is.
//
// What this does not close: a host that answers the check with a public address
// and the fetch with a private one (DNS rebinding). Pinning the checked address
// for the fetch needs the server's own HTTP agent.

/** Looks a host name up: every address it has. */
export type ResolveHost = (host: string) => Promise<string[]>;

/** What a feed fetch needs from the server it runs on. */
export interface FeedDeps {
  resolveHost?: ResolveHost;
}

/** Why a feed address was refused, in the owner's words. */
export class FeedAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedAddressError';
  }
}

function v4Parts(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const numbers = parts.map(Number);
  return numbers.every((n) => n <= 255) ? numbers : null;
}

function withoutMappedPrefix(ip: string): string {
  return ip.toLowerCase().startsWith('::ffff:') ? ip.slice(7) : ip;
}

/** True when the host is written as an address rather than a name. */
export function isIpLiteral(host: string): boolean {
  return v4Parts(host) !== null || host.includes(':');
}

/** True for a loopback address: 127.0.0.0/8 and ::1. */
export function isLoopback(ip: string): boolean {
  const v4 = v4Parts(withoutMappedPrefix(ip));
  if (v4) return v4[0] === 127;
  return ip === '::1';
}

/** True for any address that is not on the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = v4Parts(withoutMappedPrefix(ip));
  if (v4) {
    const [a, b] = v4 as [number, number, number, number];
    return (
      a === 0 || // "this" network
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) || // IETF protocol assignments
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast and reserved
    );
  }
  const lower = ip.toLowerCase();
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') || // unique local
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') || // link-local
    lower.startsWith('ff') // multicast
  );
}

function notProduction(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.NODE_ENV !== 'production';
}

/** The URL, once it is known to point only at public addresses. */
export async function checkFeedAddress(
  raw: string,
  options: { allowLoopback?: boolean; resolveHost?: ResolveHost } = {}
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FeedAddressError('That is not a web address. It should start with https://.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new FeedAddressError('The feed address has to start with https:// or http://.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIpLiteral(host)) {
    addresses = [host];
  } else if (options.resolveHost) {
    addresses = await options.resolveHost(host).catch(() => []);
  } else {
    throw new FeedAddressError(
      'The feed address could not be checked here, so it was not read. Try again in a moment.'
    );
  }
  if (addresses.length === 0) {
    throw new FeedAddressError(`${url.hostname} could not be found. Check the feed address.`);
  }
  const allowLoopback = options.allowLoopback ?? notProduction();
  for (const address of addresses) {
    if (allowLoopback && isLoopback(address)) continue;
    if (isPrivateAddress(address)) {
      throw new FeedAddressError(
        `${url.hostname} is not on the public internet, so the feed cannot be read from it.`
      );
    }
  }
  return url;
}

const MAX_REDIRECTS = 3;

/** Fetch a feed, checking the address and every redirect before following it. */
export async function fetchFeed(
  raw: string,
  init: { method?: string; signal?: AbortSignal; headers?: Record<string, string> } = {},
  options: { allowLoopback?: boolean; resolveHost?: ResolveHost } = {}
): Promise<Response> {
  let next = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await checkFeedAddress(next, options);
    const res = await fetch(url, { ...init, redirect: 'manual' });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get('location');
    if (!location) return res;
    next = new URL(location, url).toString();
  }
  throw new FeedAddressError('The feed address redirects too many times to follow.');
}
