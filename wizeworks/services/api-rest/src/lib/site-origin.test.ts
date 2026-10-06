// The public address of one site: the origin every customer link is built on, and
// the sitemap's `<loc>` base (issue 064).
//
// Every customer email used to build its links on `SPARX_SITE_BASE`, which nothing
// sets, and return the bare PATH when it was unset, so every link in every email on
// every shop opened nothing from an inbox. These pin the resolution order the
// sitemap already had, that a second site gets its OWN address, and that the answer
// is never a path.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  tenant: { slug: 'gillettdiesel', settings: {} },
  /** `domains` rows by property id: the canonical, verified-or-live host. */
  canonical: new Map<string, string>(),
  /** The subdomain rows `tenantZone` reads the zone off. */
  subdomains: [] as { host: string; property: { isPrimary: boolean } | null }[],
  properties: new Map<string, { id: string; slug: string; isPrimary: boolean }>(),
}));

vi.mock('@wizeworks/db', () => {
  const tenant = { findUnique: () => Promise.resolve(state.tenant) };
  const domain = {
    findFirst: ({
      where,
    }: {
      where: { propertyId: string; isCanonical: boolean; status: { in: string[] } };
    }) => {
      // The filter is part of the contract: only a canonical, working host counts.
      expect(where.isCanonical).toBe(true);
      expect(where.status.in).toEqual(['verified', 'active']);
      const host = state.canonical.get(where.propertyId);
      return Promise.resolve(host ? { host } : null);
    },
    findMany: () => Promise.resolve(state.subdomains),
  };
  // The site reads run in one tenant transaction; the sitemap's host read uses the
  // bare client. Both see the same rows.
  const tx = {
    tenant,
    domain,
    property: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(state.properties.get(where.id) ?? null),
      findFirst: () =>
        Promise.resolve([...state.properties.values()].find((p) => p.isPrimary) ?? null),
    },
  };
  return {
    prisma: { tenant, domain },
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

import { canonicalSiteHost, resolveSiteOrigin, siteUrl } from './site-origin.js';

const PRIMARY = { id: 'site-primary', slug: 'primary', isPrimary: true };
const PARTS = { id: 'site-parts', slug: 'parts', isPrimary: false };

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  state.tenant = { slug: 'gillettdiesel', settings: {} };
  state.canonical = new Map();
  state.subdomains = [];
  state.properties = new Map([
    [PRIMARY.id, PRIMARY],
    [PARTS.id, PARTS],
  ]);
});

afterEach(() => {
  delete process.env.SPARX_SITE_BASE;
});

const hostOf = (property: typeof PRIMARY | null) =>
  canonicalSiteHost({
    tenantId: 't1',
    tenantSlug: state.tenant.slug,
    tenantSettings: state.tenant.settings,
    property,
  });

describe('canonicalSiteHost', () => {
  it("answers with the site's own canonical domain first", async () => {
    state.canonical.set(PARTS.id, 'parts.gillettdiesel.com');
    state.tenant.settings = { primaryDomain: 'gillettdiesel.com' };
    expect(await hostOf(PARTS)).toBe('parts.gillettdiesel.com');
  });

  it('uses the tenant primaryDomain for the PRIMARY site only', async () => {
    state.tenant.settings = { primaryDomain: 'gillettdiesel.com' };
    expect(await hostOf(PRIMARY)).toBe('gillettdiesel.com');
    // A tenant-level setting cannot describe a second site, so the second site
    // gets its own minted host instead of the primary's address.
    expect(await hostOf(PARTS)).toBe('parts.gillettdiesel.sparx.zone');
  });

  it('mints the subdomain when nothing else is on record', async () => {
    expect(await hostOf(PRIMARY)).toBe('gillettdiesel.sparx.zone');
    expect(await hostOf(PARTS)).toBe('parts.gillettdiesel.sparx.zone');
  });

  it('mints in the zone the business is served from, not a guessed one', async () => {
    state.tenant.slug = 'juniper-row';
    state.subdomains = [{ host: 'juniper-row.piggles.site', property: { isPrimary: true } }];
    expect(await hostOf(PARTS)).toBe('parts.juniper-row.piggles.site');
  });
});

describe('resolveSiteOrigin', () => {
  it('is an absolute https origin, never a bare path', async () => {
    const origin = await resolveSiteOrigin('t1', null);
    expect(origin).toBe('https://gillettdiesel.sparx.zone');
    expect(siteUrl(origin, '/account/orders')).toBe(
      'https://gillettdiesel.sparx.zone/account/orders'
    );
  });

  it("names the site asked for, not the tenant's primary", async () => {
    state.canonical.set(PARTS.id, 'parts.gillettdiesel.com');
    expect(await resolveSiteOrigin('t1', PARTS.id)).toBe('https://parts.gillettdiesel.com');
  });

  it('falls back to the primary site for an id that names no site', async () => {
    state.canonical.set(PRIMARY.id, 'gillettdiesel.com');
    expect(await resolveSiteOrigin('t1', 'gone')).toBe('https://gillettdiesel.com');
  });

  it('honors SPARX_SITE_BASE as an explicit override', async () => {
    process.env.SPARX_SITE_BASE = 'http://localhost:3002/{slug}/';
    expect(await resolveSiteOrigin('t1', PARTS.id)).toBe('http://localhost:3002/gillettdiesel');
  });
});

describe('siteUrl', () => {
  it("puts the home page at the origin's root", () => {
    expect(siteUrl('https://a.example', '')).toBe('https://a.example/');
    expect(siteUrl('https://a.example', 'privacy-policy')).toBe('https://a.example/privacy-policy');
  });
});
