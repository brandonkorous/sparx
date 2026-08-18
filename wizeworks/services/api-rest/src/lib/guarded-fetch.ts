// Fetching an address a tenant typed in.
//
// The WordPress connector takes a site address from whoever is doing the migration,
// and THIS server is what goes and fetches it. That is server-side request forgery by
// construction, and the response comes back to the browser as a preview — so anything
// this can reach, an editor can read.
//
// `@wizeworks/migration` already refuses the obvious ones syntactically (localhost, the
// RFC1918 ranges, the link-local metadata address, a login smuggled in front of the
// host). That check is necessary and not sufficient: `evil.example.com` can simply
// have an A record pointing at 169.254.169.254, and no amount of string inspection
// catches it. This module closes that by resolving the hostname first and refusing
// the request if any address it resolves to is private.
//
// The residual gap is the classic one — DNS rebinding, where the name resolves
// publicly for our check and privately for the socket a millisecond later. Closing
// that properly means pinning the checked address onto the connection through a
// custom undici agent, which is a bigger change than it looks and is tracked in
// docs/147 rather than half-done here. The window is small, the ranges below are the
// ones worth having, and the alternative — not resolving at all — is the state this
// replaces.

import { lookup } from 'node:dns/promises';
import { assertSafeUrl, ConnectorError, type FetchLike } from '@wizeworks/migration';

/** Private, loopback, link-local and carrier-grade-NAT space, v4 and v6. */
function isPrivateAddress(address: string, family: number): boolean {
  if (family === 6) {
    const value = address.toLowerCase();
    if (
      value === '::1' ||
      value === '::' ||
      value.startsWith('fe80:') ||
      value.startsWith('fc') ||
      value.startsWith('fd')
    ) {
      return true;
    }
    // ::ffff:10.0.0.1 — an IPv4 address wearing an IPv6 hat.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
    if (mapped?.[1] !== undefined) return isPrivateAddress(mapped[1], 4);
    return false;
  }

  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a = 0, b = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/**
 * A `fetch` that will only talk to the public internet.
 *
 * Handed to the connectors in place of the global one. They stay isomorphic and
 * network-agnostic; this is the only place that knows we are on a machine with a
 * resolver and an internal network worth protecting.
 */
export function guardedFetch(): FetchLike {
  return async (url, init) => {
    const target = assertSafeUrl(url);

    const addresses = await lookup(target.hostname, { all: true }).catch(() => {
      throw new ConnectorError(`We could not find ${target.hostname}.`, {
        hint: 'Check the web address is spelled the way people type it into a browser.',
      });
    });

    for (const entry of addresses) {
      if (isPrivateAddress(entry.address, entry.family)) {
        throw new ConnectorError(`We cannot reach ${target.hostname} from here.`, {
          hint: 'That address points at a private network rather than at a website on the internet.',
        });
      }
    }

    return fetch(url, init);
  };
}
