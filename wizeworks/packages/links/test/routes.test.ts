// The table's own invariants.
//
// The cross-repo check — that every registered workbench surface has a route and
// vice versa — lives in scripts/check-surface-routes.mjs, because it has to read
// the surface catalog and that file imports React. Everything provable from the
// table alone is proved here.

import { describe, expect, it } from 'vitest';
import {
  ROUTES,
  SITE_PARAM,
  buildPath,
  linkTo,
  matchPath,
  normalizePath,
  pathForEntity,
  routeAcceptsId,
  routeForEntity,
  routeForSurface,
} from '../src/index';

/** `:productId?` and `:productId` both name `productId`. */
function paramName(segment: string): string {
  return segment.endsWith('?') ? segment.slice(1, -1) : segment.slice(1);
}

/** A stand-in value per parameter name, so a route can be exercised concretely. */
function sampleParams(path: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const segment of path.split('/')) {
    if (segment.startsWith(':')) params[paramName(segment)] = `sample-${paramName(segment)}`;
  }
  return params;
}

describe('the table', () => {
  it('has no duplicate surface', () => {
    const seen = new Set<string>();
    for (const route of ROUTES) {
      expect(seen.has(route.surface), `duplicate surface ${route.surface}`).toBe(false);
      seen.add(route.surface);
    }
  });

  it('has no duplicate path or alias', () => {
    const seen = new Set<string>();
    for (const route of ROUTES) {
      for (const pattern of [route.path, ...(route.aliases ?? [])]) {
        expect(seen.has(pattern), `duplicate path ${pattern}`).toBe(false);
        seen.add(pattern);
      }
    }
  });

  it('has no duplicate entity — one home per record type', () => {
    const seen = new Set<string>();
    for (const route of ROUTES) {
      if (route.entity === undefined) continue;
      expect(seen.has(route.entity), `duplicate entity ${route.entity}`).toBe(false);
      seen.add(route.entity);
    }
  });

  it('gives every entity a label, so palette results can be grouped', () => {
    for (const route of ROUTES) {
      if (route.entity === undefined) continue;
      expect(route.entityLabel, `${route.entity} has no label`).toBeTruthy();
    }
  });

  // Literal segments are lower-case kebab because they are read by people;
  // PARAMETER names are camelCase because they must match what the surface reads
  // from `ctx.params` exactly (`:memberId`, `:productId`, `:sequenceId`). Mixing
  // the two rules up is how a path parameter silently arrives under a name no
  // surface looks for, which opens an empty pane and says nothing.
  it('writes every path in the canonical form', () => {
    for (const route of ROUTES) {
      for (const pattern of [route.path, ...(route.aliases ?? [])]) {
        expect(pattern.startsWith('/'), `${pattern} must be absolute`).toBe(true);
        expect(pattern === normalizePath(pattern), `${pattern} is not normalized`).toBe(true);
        for (const segment of pattern.split('/').filter(Boolean)) {
          if (segment.startsWith(':')) {
            // A trailing `?` marks the parameter optional — the surface is
            // addressable with it and without it.
            expect(
              /^:[a-z][A-Za-z0-9]*\??$/.test(segment),
              `${pattern}: parameter ${segment} must be camelCase`
            ).toBe(true);
            continue;
          }
          expect(
            /^[a-z0-9-]+$/.test(segment),
            `${pattern}: segment "${segment}" must be lower-case kebab`
          ).toBe(true);
        }
      }
    }
  });

  it('names each path parameter only once within a route', () => {
    for (const route of ROUTES) {
      const names = route.path
        .split('/')
        .filter((segment) => segment.startsWith(':'))
        .map(paramName);
      expect(new Set(names).size, `${route.path} repeats a parameter`).toBe(names.length);
    }
  });
});

// The panel is the surface; the product is a parameter of it. So a product panel
// has TWO real addresses — one fixed on a product, one not — and neither is a
// degenerate form of the other. Every address already sent carries the product,
// so the parameterised form must keep building and parsing byte for byte.
describe('optional parameters', () => {
  it('addresses the panel on its own', () => {
    expect(buildPath('commerce.product.stock')).toBe('/commerce/products/stock');
    expect(buildPath('commerce.product.channels')).toBe('/commerce/products/listings');
  });

  it('still emits the parameterised address whenever the product is there', () => {
    expect(buildPath('commerce.product.stock', { productId: 'p1' })).toBe(
      '/commerce/products/p1/stock'
    );
    expect(linkTo('https://app.example', 'commerce.product.channels', { productId: 'p1' })).toBe(
      'https://app.example/commerce/products/p1/listings'
    );
  });

  it('resolves both forms to the same surface, differing only in the parameter', () => {
    expect(matchPath('/commerce/products/stock')).toEqual({
      surface: 'commerce.product.stock',
      params: {},
    });
    expect(matchPath('/commerce/products/p1/stock')).toEqual({
      surface: 'commerce.product.stock',
      params: { productId: 'p1' },
    });
  });

  it('leaves the product list and product detail addresses alone', () => {
    expect(matchPath('/commerce/products')?.surface).toBe('commerce.products.list');
    expect(matchPath('/commerce/products/p1')?.surface).toBe('commerce.product.detail');
  });

  it('round-trips every product panel in both forms', () => {
    for (const route of ROUTES) {
      if (!route.path.includes(':productId?')) continue;
      const bare = buildPath(route.surface);
      expect(bare, `${route.surface} has no unparameterised address`).not.toBeNull();
      expect(matchPath(bare!)).toEqual({ surface: route.surface, params: {} });

      const pinned = buildPath(route.surface, { productId: 'p1' });
      expect(matchPath(pinned!)).toEqual({ surface: route.surface, params: { productId: 'p1' } });
    }
  });
});

describe('round trip', () => {
  it('rebuilds every route from its own surface and parameters', () => {
    for (const route of ROUTES) {
      const params = sampleParams(route.path);
      const built = buildPath(route.surface, params);
      expect(built, `${route.surface} did not build`).not.toBeNull();

      const matched = matchPath(built!);
      expect(matched?.surface, `${built} resolved to the wrong surface`).toBe(route.surface);
      expect(matched?.params).toEqual(params);
    }
  });

  it('resolves every alias to its route', () => {
    for (const route of ROUTES) {
      for (const alias of route.aliases ?? []) {
        const concrete = alias
          .split('/')
          .map((segment) => (segment.startsWith(':') ? `sample-${segment.slice(1)}` : segment))
          .join('/');
        expect(matchPath(concrete)?.surface, `${alias} did not resolve`).toBe(route.surface);
      }
    }
  });

  it('is stable — the same pane always produces the same string', () => {
    const a = buildPath('commerce.order.detail', { id: 'o1', tab: 'items', filter: 'open' });
    const b = buildPath('commerce.order.detail', { filter: 'open', tab: 'items', id: 'o1' });
    expect(a).toBe(b);
  });
});

describe('precedence', () => {
  it('prefers a literal segment over a parameter', () => {
    expect(matchPath('/automations/recipes')?.surface).toBe('automations.recipes');
    expect(matchPath('/automations/reports')?.surface).toBe('automations.reports');
    expect(matchPath('/automations/abc123')?.surface).toBe('automations.detail');
    expect(matchPath('/content/media')?.surface).toBe('cms.media.list');
    expect(matchPath('/content/entry-1')?.surface).toBe('cms.content.detail');
    expect(matchPath('/chat/overview')?.surface).toBe('chat.overview');
    expect(matchPath('/chat/conv-1')?.surface).toBe('chat.inbox.thread');
    expect(matchPath('/commerce/reviews/queue')?.surface).toBe('commerce.reviews.queue');
  });

  it('distinguishes a product from one of its panels by depth', () => {
    expect(matchPath('/commerce/products/p1')).toEqual({
      surface: 'commerce.product.detail',
      params: { id: 'p1' },
    });
    expect(matchPath('/commerce/products/p1/stock')).toEqual({
      surface: 'commerce.product.stock',
      params: { productId: 'p1' },
    });
  });
});

describe('query parameters', () => {
  it('hands unmatched query parameters through as surface params', () => {
    expect(matchPath('/settings/billing', '?billing=success')).toEqual({
      surface: 'finance.subscription',
      params: { billing: 'success' },
    });
  });

  it('extracts the site rather than passing it to the surface', () => {
    const matched = matchPath('/commerce/orders/o1', `?${SITE_PARAM}=savory-donuts&note=hi`);
    expect(matched).toEqual({
      surface: 'commerce.order.detail',
      params: { id: 'o1', note: 'hi' },
      site: 'savory-donuts',
    });
  });

  it('lets the path win over a same-named query parameter', () => {
    expect(matchPath('/commerce/orders/from-path', '?id=from-query')?.params).toEqual({
      id: 'from-path',
    });
  });

  it('carries params the path does not name into the query', () => {
    expect(buildPath('social.composer', { id: 'post-1', seedType: 'product' })).toBe(
      '/social/composer?id=post-1&seedType=product'
    );
  });

  it('drops empty values rather than emitting a blank parameter', () => {
    expect(buildPath('commerce.orders.list', { q: '' })).toBe('/commerce/orders');
  });
});

describe('addresses that do not exist', () => {
  it('refuses a detail address with no record', () => {
    expect(buildPath('commerce.order.detail')).toBeNull();
    expect(buildPath('commerce.order.detail', { id: '' })).toBeNull();
  });

  it('returns null for an unknown surface', () => {
    expect(buildPath('nope.not.a.surface')).toBeNull();
    expect(routeForSurface('nope.not.a.surface')).toBeUndefined();
  });

  it('returns null for the root and for unknown paths', () => {
    expect(matchPath('/')).toBeNull();
    expect(matchPath('/nowhere')).toBeNull();
    expect(matchPath('/commerce/orders/a/b/c/d')).toBeNull();
  });

  it('treats a trailing slash as the same address', () => {
    expect(matchPath('/commerce/orders/')?.surface).toBe('commerce.orders.list');
  });
});

describe('entities', () => {
  it('sends a record with a detail surface to that record', () => {
    expect(pathForEntity('order', 'o1')).toBe('/commerce/orders/o1');
    expect(pathForEntity('customer', 'c1')).toBe('/crm/customers/c1');
  });

  it('sends a record with no detail surface to the list it lives in, without the id', () => {
    const review = routeForEntity('review');
    expect(review && routeAcceptsId(review)).toBe(false);
    expect(pathForEntity('review', 'r1')).toBe('/commerce/reviews');
    expect(pathForEntity('site', 'p1')).toBe('/settings/sites');
  });

  it('returns null for an entity type with no home', () => {
    expect(pathForEntity('flux_capacitor', 'x')).toBeNull();
  });
});

describe('absolute links', () => {
  it('builds what a service puts in an email', () => {
    expect(
      linkTo('https://app.sparx.works', 'commerce.order.detail', { id: 'o1' }, 'bobs-parts')
    ).toBe('https://app.sparx.works/commerce/orders/o1?site=bobs-parts');
  });

  it('tolerates a trailing slash on the origin', () => {
    expect(linkTo('https://app.sparx.works/', 'finance.payouts.list')).toBe(
      'https://app.sparx.works/finance/payouts'
    );
  });

  it('encodes a parameter that would otherwise break the path', () => {
    const built = buildPath('cms.taxonomy.detail', { key: 'tags/with slash' });
    expect(built).toBe('/content/tags/tags%2Fwith%20slash');
    expect(matchPath(built!)?.params).toEqual({ key: 'tags/with slash' });
  });
});
