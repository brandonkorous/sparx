import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetPhases, isCrawlablePath, siteIsDark, tenantSlugForHost } from './dark-at-the-edge';

/**
 * ONE OUTAGE, TWO ANSWERS.
 *
 * A dark site's robots.txt said 503 "ask again later" and its home page said
 * 200 OK with the words "Back soon" on it (issue 844). A 200 carrying no
 * `noindex` is the one combination that lets the dark page be indexed in place
 * of the shop, which is the outcome lib/suspended exists to prevent.
 *
 * The fix asks the question at the edge, which is the only place that can both
 * know the phase and set the status. These tests hold the three rules that keep
 * that from costing anything: documents only, cached per host, and fail open.
 */

describe('isCrawlablePath', () => {
  it.each(['/', '/products/the-everyday-tee', '/about', '/blog/opening-week'])(
    'asks about %s, which can become a search result',
    (path) => {
      expect(isCrawlablePath(path)).toBe(true);
    }
  );

  it.each([
    '/_next/static/chunks/main.js',
    '/api/cart',
    '/logo.png',
    '/theme.css',
    '/fonts/inter.woff2',
    '/favicon.ico',
  ])('does not ask about %s, because nobody reads its status', (path) => {
    expect(isCrawlablePath(path)).toBe(false);
  });

  it.each(['/robots.txt', '/sitemap.xml', '/llms.txt'])(
    'leaves %s alone, because it already answers its own 503',
    (path) => {
      expect(isCrawlablePath(path)).toBe(false);
    }
  );
});

describe('tenantSlugForHost', () => {
  it('reads a zone host, which names its own tenant and costs nothing', () => {
    expect(tenantSlugForHost('juniper-row.sparx.zone', null)).toBe('juniper-row');
  });

  it('reads a per-site zone host as its tenant, not its site', () => {
    expect(tenantSlugForHost('press.juniper-row.sparx.zone', null)).toBe('juniper-row');
  });

  it('takes the dev override on a local host, where there is no per-tenant DNS', () => {
    expect(tenantSlugForHost('localhost:3004', 'juniper-row')).toBe('juniper-row');
  });

  it('refuses the dev override on a real host', () => {
    // A leaked `?tenant=` cookie must never re-point a real host, here or
    // anywhere else in the resolution chain.
    expect(tenantSlugForHost('shop.example.com', 'juniper-row')).toBeNull();
  });

  it('answers nothing for a custom domain, which only the domains table knows', () => {
    expect(tenantSlugForHost('thistleandrye.com', null)).toBeNull();
  });
});

describe('siteIsDark', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    forgetPhases();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function answers(phase: string) {
    return {
      ok: true,
      json: () => Promise.resolve({ success: true, data: { billingPhase: phase } }),
    };
  }

  it('says yes for a suspended tenant', async () => {
    fetchMock.mockResolvedValue(answers('suspended'));
    await expect(siteIsDark('quiet-haven.sparx.zone', null)).resolves.toBe(true);
  });

  it.each(['active', 'trialing', 'grace', 'exempt'])('says no for %s', async (phase) => {
    fetchMock.mockResolvedValue(answers(phase));
    await expect(siteIsDark('quiet-haven.sparx.zone', null)).resolves.toBe(false);
  });

  it('asks once per host, not once per request', async () => {
    fetchMock.mockResolvedValue(answers('suspended'));
    await siteIsDark('quiet-haven.sparx.zone', null);
    await siteIsDark('quiet-haven.sparx.zone', null);
    await siteIsDark('quiet-haven.sparx.zone', null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks nothing at all when the host names no tenant', async () => {
    await expect(siteIsDark('thistleandrye.com', null)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails open when the lookup throws, so a live shop keeps serving', async () => {
    fetchMock.mockRejectedValue(new Error('unreachable'));
    await expect(siteIsDark('quiet-haven.sparx.zone', null)).resolves.toBe(false);
  });

  it('fails open when the lookup answers an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(siteIsDark('quiet-haven.sparx.zone', null)).resolves.toBe(false);
  });

  it('fails open when the payload carries no phase at all', async () => {
    // The resolver downstream follows the same rule: a site is never darkened
    // on missing data, only on an explicit "suspended".
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: {} }) });
    await expect(siteIsDark('quiet-haven.sparx.zone', null)).resolves.toBe(false);
  });
});
