// WHO IS ASKING? Every case is a request shape production actually sends. The
// services answer it with Fastify's `trustProxy`, the apps with
// clientIpFromChain() — and both must give the same answer, so each case runs
// through both.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_RANGES, TRUSTED_PROXIES, clientIpFromChain, isTrustedHop } from './index.js';

const CADDY = '10.0.0.5'; // the ingress pod
const WEB_POD = '10.0.1.7'; // a server-rendered app calling in-cluster
const EDGE = '104.16.0.5'; // inside 104.16.0.0/13
const VISITOR = '9.9.9.9';
const SPOOF = '6.6.6.6';

/** What a Fastify service configured with TRUSTED_PROXIES says `request.ip` is. */
async function fastifyIp(remoteAddress: string, xff?: string): Promise<string> {
  const app = Fastify({ trustProxy: TRUSTED_PROXIES });
  app.get('/ip', (request) => ({ ip: request.ip }));
  const res = await app.inject({
    method: 'GET',
    url: '/ip',
    remoteAddress,
    headers: xff ? { 'x-forwarded-for': xff } : {},
  });
  await app.close();
  return res.json<{ ip: string }>().ip;
}

const CASES: { name: string; socket: string; xff?: string; expected: string }[] = [
  {
    // Cloudflare appended the visitor; Caddy (trusting Cloudflare) appended the edge.
    name: 'the visitor behind Cloudflare and Caddy, not the edge',
    socket: CADDY,
    xff: `${VISITOR}, ${EDGE}`,
    expected: VISITOR,
  },
  {
    // The client sent `X-Forwarded-For: 6.6.6.6`; Cloudflare appended the truth.
    name: 'not an address the client wrote into the header itself',
    socket: CADDY,
    xff: `${SPOOF}, ${VISITOR}, ${EDGE}`,
    expected: VISITOR,
  },
  {
    name: 'the visitor when a server-rendered app forwards the chain it was given',
    socket: WEB_POD,
    xff: `${SPOOF}, ${VISITOR}, ${EDGE}`,
    expected: VISITOR,
  },
  {
    // Caddy does not trust a public peer, so it replaces the header with the peer.
    name: 'the caller itself when someone skips Cloudflare and hits the origin',
    socket: CADDY,
    xff: '7.7.7.7',
    expected: '7.7.7.7',
  },
  {
    name: 'the pod when an in-cluster caller forwards nothing',
    socket: WEB_POD,
    expected: WEB_POD,
  },
  {
    name: 'an IPv6 visitor behind an IPv6 edge',
    socket: CADDY,
    xff: '2001:db8::1, 2606:4700::6810:85e5',
    expected: '2001:db8::1',
  },
];

describe('the client address is', () => {
  for (const c of CASES) {
    it(`${c.name} — in a service`, async () => {
      expect(await fastifyIp(c.socket, c.xff)).toBe(c.expected);
    });
    it(`${c.name} — in an app`, () => {
      expect(clientIpFromChain(c.xff, c.socket)).toBe(c.expected);
    });
  }
});

describe('clientIpFromChain', () => {
  it('reads the chain an app receives from Caddy, with no socket', () => {
    // A server action has no peer to pass; Caddy already appended the edge.
    expect(clientIpFromChain(`${SPOOF}, ${VISITOR}, ${EDGE}`)).toBe(VISITOR);
  });

  it('records nothing rather than something that is not an address', () => {
    expect(clientIpFromChain(`${VISITOR}, not-an-ip, ${EDGE}`)).toBeNull();
    expect(clientIpFromChain(null)).toBeNull();
    expect(clientIpFromChain('  ')).toBeNull();
  });

  it('unwraps an IPv4-mapped IPv6 hop', () => {
    expect(isTrustedHop('::ffff:10.0.0.5')).toBe(true);
    expect(clientIpFromChain(`${VISITOR}, ::ffff:104.16.0.5`)).toBe(VISITOR);
  });
});

describe('the Cloudflare ranges', () => {
  it('match the ones Caddy trusts', () => {
    // If Caddy trusts a range this does not, that edge becomes every visitor's
    // address here; the other way round, a client could prepend an address in it.
    const caddyfile = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../k8s/ingress/Caddyfile'
    );
    expect(existsSync(caddyfile), `${caddyfile} must exist — a moved file makes this blind`).toBe(
      true
    );
    const line = readFileSync(caddyfile, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith('trusted_proxies static'));
    expect(line, 'Caddy no longer declares `trusted_proxies static`').toBeDefined();

    const caddyRanges = line!
      .trim()
      .split(/\s+/)
      .slice(2)
      .filter((token) => token !== 'private_ranges');
    expect(new Set(caddyRanges)).toEqual(new Set(CLOUDFLARE_RANGES));
  });
});
