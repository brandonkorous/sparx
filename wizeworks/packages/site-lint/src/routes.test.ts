import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { RECORD_ADDRESSES, ROUTED_RECORD_TYPES } from '@wizeworks/silica-catalog';

import {
  BUILTIN_PATHS,
  DYNAMIC_ROUTES,
  normalizePath,
  OPEN_SUBTREES,
  resolveRelative,
  routePrefixForRecordType,
} from './routes';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/site/app');

/**
 * Every route the storefront actually serves, read off the filesystem.
 *
 * WHY THIS TEST EXISTS. The route table in `routes.ts` is the only part of this
 * package that is knowledge about the rest of the repo rather than about the tree it
 * was handed, so it is the only part that can go stale without anything failing. And
 * its stale failure mode is the bad one: a route added to `wizeworks/apps/site` and not added
 * here makes the linter tell an owner that a link to a page that works is broken.
 * Reading the real router removes the possibility.
 */
function routesFromFilesystem(dir: string, prefix: string[] = []): string[][] {
  const routes: string[][] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'page.tsx') routes.push(prefix);
    if (!entry.isDirectory()) continue;
    // `(authed)` and friends are ROUTE GROUPS: they organize files and contribute
    // nothing to the URL.
    const segment = entry.name.startsWith('(') ? null : entry.name;
    routes.push(
      ...routesFromFilesystem(join(dir, entry.name), segment ? [...prefix, segment] : prefix)
    );
  }
  return routes;
}

/** Is this segment a parameter — `[handle]` or `[...slug]`? */
function isParam(segment: string): boolean {
  return segment.startsWith('[');
}

/** Does the table cover a route the router serves? */
function covered(segments: string[]): boolean {
  // The catch-all is what resolves authored pages by slug. It is not a fixed route,
  // and the page roster — not this table — decides whether a given slug exists.
  if (segments.some((s) => s.startsWith('[...'))) return true;

  const path = normalizePath(`/${segments.join('/')}`);
  if (OPEN_SUBTREES.some((open) => path.startsWith(open) || `${path}/` === open)) return true;

  if (!segments.some(isParam)) return BUILTIN_PATHS.includes(path);

  // A parameterized route: everything up to the parameter must be a declared prefix.
  const first = segments.findIndex(isParam);
  const prefix = `/${segments.slice(0, first).join('/')}/`;
  return DYNAMIC_ROUTES.some((route) => route.prefix === prefix);
}

describe('the storefront route table', () => {
  const routes = routesFromFilesystem(APP_DIR);

  it('found the real router', () => {
    // Guards against the whole test passing because the path was wrong and the walk
    // returned nothing.
    expect(routes.length).toBeGreaterThan(20);
    expect(routes.some((r) => r.join('/') === 'cart')).toBe(true);
  });

  it('covers every route wizeworks/apps/site serves', () => {
    const missing = routes
      .filter((segments) => !covered(segments))
      .map((segments) => `/${segments.join('/')}`);
    expect(missing).toEqual([]);
  });

  it('declares no route the router does not serve', () => {
    // The other direction: a path listed here that nothing serves would let a genuinely
    // broken link through. `/` and the non-page routes (`robots.txt`, `sitemap.xml`,
    // `llms.txt` are route handlers, not pages) are exempt.
    const served = new Set(routes.map((segments) => normalizePath(`/${segments.join('/')}`)));
    const handlers = new Set(['/robots.txt', '/sitemap.xml', '/llms.txt']);
    const orphans = BUILTIN_PATHS.filter((path) => !served.has(path) && !handlers.has(path));
    expect(orphans).toEqual([]);
  });

  it('names the record type behind every parameterized route, in the catalog spelling', () => {
    // `recordType` and `prefix` are DERIVED from the catalog's `RECORD_ADDRESSES` now,
    // so this can no longer drift — it is one list, not two kept in step. Retained as a
    // cheap assertion that the derivation covers everything and adds nothing.
    expect([...DYNAMIC_ROUTES].map((r) => r.recordType).sort()).toEqual(
      [...ROUTED_RECORD_TYPES].sort()
    );
  });

  it('gives every record address a param that is the REAL dynamic segment on disk', () => {
    // The strongest guard available on this change, and the reason `param` exists as a
    // field rather than being folded into the slug string: it makes a record page's
    // address PROVABLE against the router instead of asserted.
    //
    // A record page lives at `/products/:handle` because `app/products/[handle]` is what
    // serves it. If someone renames that directory to `[slug]`, the address silently
    // names a parameter the router does not have — the page still resolves (lookup is by
    // the whole slug string), so nothing fails, and the address quietly lies about the
    // route it belongs to. Reading the directory back is what stops that.
    const dynamicSegment = new Map<string, string>();
    for (const segments of routes) {
      if (segments.length !== 2) continue;
      const [parent, child] = segments as [string, string];
      const param = /^\[(.+)\]$/.exec(child)?.[1];
      if (param) dynamicSegment.set(`/${parent}/`, param);
    }

    for (const address of RECORD_ADDRESSES) {
      expect(
        dynamicSegment.get(address.prefix),
        `no dynamic route directory serves ${address.prefix}`
      ).toBe(address.param);
      expect(address.slug).toBe(`${address.prefix}:${address.param}`);
    }
  });

  it('has a real route for every record address, so the catch-all can never serve one', () => {
    // `wizeworks/apps/site/app/[...slug]` would happily match `/products/:handle` and hand back a
    // template with nothing bound into it. It never gets the chance ONLY because a more
    // specific route wins Next's precedence. That safety is a coincidence of routing
    // unless something checks it, so this checks it.
    const served = new Set(routes.map((segments) => `/${segments.join('/')}`));
    for (const address of RECORD_ADDRESSES) {
      const dir = `${address.prefix}[${address.param}]`;
      expect(served.has(dir), `${address.slug} has no route at ${dir}`).toBe(true);
    }
  });

  it('resolves a record type to where its visitors actually land', () => {
    expect(routePrefixForRecordType('commerce.product')).toBe('/products/');
    expect(routePrefixForRecordType('cms.blog_post')).toBe('/blog/');
    // A singleton page has no record type, and an unknown one must not throw.
    expect(routePrefixForRecordType('commerce.nonsense')).toBeNull();
  });

  it('gives every prefix both slashes', () => {
    // Consumers match with `startsWith`, so a missing trailing slash makes
    // `/products` claim `/products-archive` as one of its records.
    for (const route of DYNAMIC_ROUTES) expect(route.prefix).toMatch(/^\/[a-z-]+\/$/);
  });
});

describe('path normalization', () => {
  it('collapses every spelling of the same page to one', () => {
    for (const spelling of ['/about', 'about', '/about/', '/about?ref=x', '/about#top']) {
      expect(normalizePath(spelling)).toBe('/about');
    }
  });

  it('keeps the root a root', () => {
    for (const spelling of ['/', '', '//']) expect(normalizePath(spelling)).toBe('/');
  });
});

describe('relative hrefs', () => {
  it('resolves against the page they are on, the way a browser does', () => {
    expect(resolveRelative('about', '/')).toBe('/about');
    expect(resolveRelative('teardown', '/guides/setup')).toBe('/guides/teardown');
    expect(resolveRelative('../pricing', '/guides/setup')).toBe('/pricing');
    expect(resolveRelative('./contact', '/about')).toBe('/contact');
  });
});
