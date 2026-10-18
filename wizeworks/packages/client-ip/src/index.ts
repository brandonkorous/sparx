// Who a request is from — one answer for the whole platform.
//
// Traffic reaches a service through Cloudflare, then Caddy, and sometimes then
// one of our own server-rendered apps calling in-cluster. Each hop appends to
// X-Forwarded-For, and the FIRST entry is whatever the client typed into the
// header. So the client is found by reading the chain from the RIGHT, skipping
// only hops we trust, and taking the first address nobody we trust vouched for.
//
// ── Why this is one package ───────────────────────────────────────────────────
//
// The services resolved it with Fastify's `trustProxy: true`, which trusts every
// hop and so reads the leftmost entry; two api-rest routes and two sign-up flows
// parsed the header by hand and took the leftmost entry too. A rate limit keyed
// on it could be dodged by sending a new address per request, and an e-signature
// or a legal-acceptance record stored whatever address the signer chose. Caddy,
// meanwhile, did not trust Cloudflare at all and forwarded the EDGE's address,
// so every visitor through one edge shared one rate-limit bucket. On 2026-10-18
// all of it was fixed at once, and the trusted ranges now live here and nowhere
// else in code: the services pass TRUSTED_PROXIES to Fastify, the apps call
// clientIpFromChain(), and index.test.ts fails if the Cloudflare ranges drift
// from the ones Caddy trusts (k8s/ingress/Caddyfile, global `trusted_proxies`).
// Refresh both from https://www.cloudflare.com/ips together.

import ipaddr from 'ipaddr.js';

export const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
] as const;

/** Fastify's `trustProxy` (via proxy-addr): loopback, link-local and the private
 *  ranges — where Caddy and every in-cluster pod live — plus Cloudflare's edges. */
export const TRUSTED_PROXIES: string[] = [
  'loopback',
  'linklocal',
  'uniquelocal',
  ...CLOUDFLARE_RANGES,
];

/** ipaddr.js range names that mean "inside our network" for each address kind —
 *  the same set proxy-addr's loopback/linklocal/uniquelocal names cover. */
const PRIVATE_RANGES = new Set(['private', 'loopback', 'linkLocal', 'uniqueLocal']);

const CLOUDFLARE_CIDRS = CLOUDFLARE_RANGES.map((range) => ipaddr.parseCIDR(range));

/** Parsed, with an IPv4-mapped IPv6 address (`::ffff:1.2.3.4`) unwrapped to IPv4,
 *  or null when it is not an address at all. */
function parse(address: string): ipaddr.IPv4 | ipaddr.IPv6 | null {
  return ipaddr.isValid(address) ? ipaddr.process(address) : null;
}

/** Whether `address` is a hop we trust to have appended the truth. */
export function isTrustedHop(address: string): boolean {
  const ip = parse(address);
  if (!ip) return false;
  if (PRIVATE_RANGES.has(ip.range())) return true;
  return CLOUDFLARE_CIDRS.some(([net, bits]) => net.kind() === ip.kind() && ip.match(net, bits));
}

/**
 * Whether the request came from one of our own pods, on its own behalf: a private
 * peer and NO X-Forwarded-For at all.
 *
 * Every request from outside passes Caddy, and Caddy always writes the chain, so a
 * request without one never came through the ingress. That is the shape of a
 * server-rendered app filling its data cache: Next puts request headers in the
 * cache key, so a cached read cannot carry the visitor's chain without giving
 * every visitor a cache entry of their own. One such read serves many visitors,
 * so a per-IP limit meant for one person cannot apply to it.
 *
 * A Cloudflare peer does not count: an edge always sends a chain, and a request
 * from one without a chain is not ours.
 */
export function isInClusterCaller(
  chain: string | string[] | null | undefined,
  socket: string | null | undefined
): boolean {
  const hops = Array.isArray(chain) ? chain.join(',') : (chain ?? '');
  if (hops.trim() !== '') return false;
  const peer = socket ? parse(socket) : null;
  return peer !== null && PRIVATE_RANGES.has(peer.range());
}

/**
 * The client address in an X-Forwarded-For chain, read right to left the same way
 * the services' `trustProxy` reads it. `socket` is the immediate peer when the
 * caller has one (a Next.js server action does not, and needs none: its peer is
 * Caddy, which appended the hop before it to the chain).
 *
 * Returns null when there is no chain and no socket, or when the decisive entry is
 * not an address — a record should hold no address rather than a wrong one.
 */
export function clientIpFromChain(
  chain: string | null | undefined,
  socket?: string | null
): string | null {
  const hops = (chain ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  if (socket) hops.push(socket);
  if (hops.length === 0) return null;

  for (let i = hops.length - 1; i >= 0; i -= 1) {
    if (isTrustedHop(hops[i]!)) continue;
    const ip = parse(hops[i]!);
    return ip ? ip.toString() : null;
  }
  // Every hop is ours: the request started inside the network. Its origin is the
  // furthest hop recorded, which is how proxy-addr answers the same chain.
  const origin = parse(hops[0]!);
  return origin ? origin.toString() : null;
}
