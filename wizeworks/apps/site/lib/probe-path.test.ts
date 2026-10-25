import { afterEach, describe, expect, it, vi } from 'vitest';

import { NextRequest } from 'next/server';

import { proxy } from '../proxy';
import { forgetPhases } from './dark-at-the-edge';
import { isProbePath } from './probe-path';

/**
 * A BOT ASKING FOR `/.env` BUILT THE WHOLE PAGE.
 *
 * Every hidden-file probe on a tenant site rendered the layout, its chrome and
 * about ten api-rest calls before the 404. These tests hold the two halves of
 * the fix: hidden-file paths stop at the edge, and nothing a tenant can publish
 * or redirect from is caught with them.
 */

describe('isProbePath', () => {
  it.each([
    '/.env',
    '/.env.production',
    '/.git/config',
    '/.git/logs/HEAD',
    '/.aws/credentials',
    '/.docker/laravel/app/.env',
    '/wp/.env',
    '/.claude/settings.json',
    '/%2Eenv',
    // WW-2: a NUL went on to Postgres, a broken escape crashed the page.
    '/%00production.json',
    '/%00x.json',
    '/a%1Fb',
    '/%c0',
  ])('stops %s, which no tenant page can be', (path) => {
    expect(isProbePath(path)).toBe(true);
  });

  it.each([
    '/',
    '/products/the-everyday-tee',
    '/blog/opening-week',
    '/about/team',
    '/.well-known/security.txt',
    '/.well-known/acme-challenge/abc',
    // Old WordPress addresses: a migrated tenant's redirects are keyed by these.
    '/wp-login.php',
    '/wp-content/uploads/2019/04/shop-front.jpg',
    '/index.php',
    '/products/v1.2-release',
  ])('lets %s through, which a tenant can publish or redirect from', (path) => {
    expect(isProbePath(path)).toBe(false);
  });
});

describe('proxy on a probe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    forgetPhases();
  });

  it('answers 404 without asking api-rest anything', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchSpy);

    const res = await proxy(
      new NextRequest('https://golden-falcon-7224.sparx.zone/.env', {
        headers: { host: 'golden-falcon-7224.sparx.zone' },
      })
    );

    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still asks about a real page', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { billingPhase: 'active' } }), { status: 200 })
      )
    );
    vi.stubGlobal('fetch', fetchSpy);

    const res = await proxy(
      new NextRequest('https://golden-falcon-7224.sparx.zone/about', {
        headers: { host: 'golden-falcon-7224.sparx.zone' },
      })
    );

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
