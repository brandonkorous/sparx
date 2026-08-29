// Which zone a tenant's next site is minted in (issue 316).
//
// TESTED AS A PAIR, not as two functions, because that is where it broke. A site's
// host is `mintZoneHost(tenantSlug, propertySlug, false, await tenantZone(id))`, and
// both halves answered correctly on their own while the composition handed a Piggles
// business a site on `sparx.zone`: `tenantZone` read `piggles.site` off the host the
// tenant was already being served on, and `mintZoneHost` then threw it away because
// `OWNED_ZONES` had not been told about it. A unit test of either one would have been
// green. So every case here goes through both.
//
// The env is set BEFORE each import: `OWNED_ZONES` is read once at module load, and
// the whole point is what happens when it is short of a zone we are really serving.

import { beforeEach, describe, expect, it, vi } from 'vitest';
// Type-only, so it does not load the module before the env is set for a test.
import type * as Domain from './domain.js';

/** The `domains` rows `tenantZone` reads. Reassigned per test, before the import. */
let domainRows: { host: string; property: { isPrimary: boolean } | null }[] = [];

vi.mock('@wizeworks/db', () => ({
  prisma: { domain: { findMany: () => Promise.resolve(domainRows) } },
  withTenant: () => Promise.reject(new Error('domain.test does not exercise withTenant')),
}));

type DomainModule = typeof Domain;

/** Load `domain.ts` fresh under a given `SPARX_ZONE_DOMAINS`. `undefined` means the
 *  variable is absent — which is the LOCAL stack, and the configuration this issue
 *  was found on. */
async function loadDomain(zones?: string): Promise<DomainModule> {
  vi.resetModules();
  delete process.env.SPARX_ZONE_DOMAIN;
  if (zones === undefined) delete process.env.SPARX_ZONE_DOMAINS;
  else process.env.SPARX_ZONE_DOMAINS = zones;
  return import('./domain.js');
}

/** The real composition: what host does this tenant's NEXT site get? */
async function nextSiteHost(mod: DomainModule, tenantSlug: string, siteSlug: string) {
  return mod.mintZoneHost(tenantSlug, siteSlug, false, await mod.tenantZone('tenant-id'));
}

const PIGGLES_PRIMARY = { host: 'juniper-row.piggles.site', property: { isPrimary: true } };

beforeEach(() => {
  domainRows = [];
});

describe('a second site is minted in the zone the business is already on', () => {
  it('follows the primary site even when SPARX_ZONE_DOMAINS never named its zone', async () => {
    domainRows = [PIGGLES_PRIMARY];
    const mod = await loadDomain(undefined);

    // The configuration that produced the bug: only `sparx.zone` is "owned".
    expect(mod.OWNED_ZONES).toEqual(['sparx.zone']);
    expect(await nextSiteHost(mod, 'juniper-row', 'press')).toBe('press.juniper-row.piggles.site');
  });

  it('does the same when the deployment IS configured with both zones', async () => {
    domainRows = [PIGGLES_PRIMARY];
    const mod = await loadDomain('sparx.zone,piggles.site');
    expect(await nextSiteHost(mod, 'juniper-row', 'press')).toBe('press.juniper-row.piggles.site');
  });

  it('keeps a sparx tenant on sparx.zone', async () => {
    domainRows = [{ host: 'ironleaf.sparx.zone', property: { isPrimary: true } }];
    const mod = await loadDomain(undefined);
    expect(await nextSiteHost(mod, 'ironleaf', 'archive')).toBe('archive.ironleaf.sparx.zone');
  });

  it('reads the PRIMARY site first, so one wrong row does not become every later one', async () => {
    // Exactly the state Juniper Row was in: a correct primary, and two sites already
    // minted in the wrong zone by the version this issue was filed on. Creation order
    // would answer `sparx.zone` and make the mistake permanent.
    domainRows = [
      { host: 'archive.juniper-row.sparx.zone', property: { isPrimary: false } },
      PIGGLES_PRIMARY,
      { host: 'trade.juniper-row.sparx.zone', property: { isPrimary: false } },
    ];
    const mod = await loadDomain(undefined);
    expect(await nextSiteHost(mod, 'juniper-row', 'press')).toBe('press.juniper-row.piggles.site');
  });

  it('falls back to the default zone for a tenant with no subdomain at all', async () => {
    domainRows = [];
    const mod = await loadDomain(undefined);
    expect(await nextSiteHost(mod, 'ironleaf', 'archive')).toBe('archive.ironleaf.sparx.zone');
  });

  it('never reads a zone out of a two-label host, which is a zone and not a site', async () => {
    // A bare `piggles.site` row would make `mintedZoneOf` answer `piggles.site` for the
    // wrong reason; it is guarded on label count, and the fallback is what answers.
    domainRows = [{ host: 'piggles.site', property: { isPrimary: true } }];
    const mod = await loadDomain(undefined);
    expect(await mod.tenantZone('tenant-id')).toBe('sparx.zone');
  });
});

describe('the CNAME a customer is told to point their own domain at', () => {
  it('stays on the business own brand when SPARX_ZONE_DOMAINS is short of its zone', async () => {
    const mod = await loadDomain(undefined);
    expect(mod.cnameTargetFor('piggles.site')).toBe('customers.piggles.site');
  });

  it('falls back to the default zone for junk', async () => {
    const mod = await loadDomain(undefined);
    expect(mod.cnameTargetFor('not a host')).toBe('customers.sparx.zone');
    expect(mod.cnameTargetFor('')).toBe('customers.sparx.zone');
    expect(mod.cnameTargetFor(null)).toBe('customers.sparx.zone');
  });
});

describe('a named zone is taken as given once it is well formed', () => {
  it('does not mint from junk', async () => {
    const mod = await loadDomain(undefined);
    expect(mod.mintZoneHost('ironleaf', 'archive', false, 'https://nope/')).toBe(
      'archive.ironleaf.sparx.zone'
    );
    expect(mod.mintZoneHost('ironleaf', 'archive', false, 'localhost')).toBe(
      'archive.ironleaf.sparx.zone'
    );
  });

  it('gives the primary site the bare two-label host', async () => {
    domainRows = [PIGGLES_PRIMARY];
    const mod = await loadDomain(undefined);
    expect(mod.mintZoneHost('juniper-row', 'primary', true, await mod.tenantZone('t'))).toBe(
      'juniper-row.piggles.site'
    );
  });
});
