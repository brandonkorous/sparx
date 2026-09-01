import { describe, expect, it } from 'vitest';
import { el, outlet, type ElementNode, type Node } from '@wizeworks/silicaui-html';

import { lintSite } from './index';
import { checkReach } from './reach';
import type { LintablePage, PageAddress, SiteLintInput } from './types';

/* ── Fixtures ───────────────────────────────────────────────────────────────── */

function page(overrides: Partial<LintablePage> & { root: Node }): LintablePage {
  return {
    id: 'p1',
    name: 'Home',
    slug: '/',
    seoTitle: 'Home — Example',
    seoDescription: 'A description that is not shared with any other page.',
    ...overrides,
  };
}

/** A body that satisfies every rule not under test. */
function body(...children: Node[]): ElementNode {
  return el('main', '', { children: [el('h1', '', { text: 'The page' }), ...children] });
}

function link(href: string, text = 'Go'): Node {
  return el('a', '', { attrs: { href }, text });
}

function frameWith(...children: Node[]): { root: Node } {
  return { root: el('div', '', { children: [...children, outlet()] }) };
}

function unreachable(input: Partial<SiteLintInput> & { pages: LintablePage[] }): string[] {
  return lintSite(input)
    .findings.filter((f) => f.rule === 'page-unreachable')
    .map((f) => f.location.ownerName);
}

function address(over: Partial<PageAddress> & { id: string; name: string }): PageAddress {
  return { slug: null, kind: 'singleton', recordType: null, ...over };
}

/* ── The case this was written for ──────────────────────────────────────────── */

describe('a page nothing links to', () => {
  // Juniper Row, an apparel maker, wrote a size guide and a shipping-and-returns page
  // over two afternoons, published both, and linked neither. Her menu links five other
  // pages she made, so nothing about her site looked unfinished. Every other rule in
  // this package passed on it.
  it('reports the pages with no way in and leaves the linked ones alone', () => {
    const menu = frameWith(link('/', 'Home'), link('/shop', 'Shop'), link('/about', 'About'));
    expect(
      unreachable({
        frame: menu,
        pages: [
          page({ id: 'home', name: 'Home', slug: '/', root: body() }),
          page({ id: 'shop', name: 'Shop', slug: 'shop', root: body() }),
          page({ id: 'about', name: 'About', slug: 'about', root: body() }),
          page({ id: 'size', name: 'Size guide', slug: 'size-guide', root: body() }),
          page({
            id: 'ship',
            name: 'Shipping and returns',
            slug: 'shipping-and-returns',
            root: body(),
          }),
        ],
      })
    ).toEqual(['Size guide', 'Shipping and returns']);
  });

  it('says what a visitor cannot do, and names the address', () => {
    const finding = lintSite({
      frame: frameWith(link('/', 'Home')),
      pages: [
        page({ id: 'home', name: 'Home', slug: '/', root: body() }),
        page({ id: 'size', name: 'Size guide', slug: 'size-guide', root: body() }),
      ],
    }).findings.find((f) => f.rule === 'page-unreachable');

    expect(finding?.severity).toBe('warning');
    expect(finding?.evidence).toBe('/size-guide');
    expect(finding?.title).toContain('Size guide');
    expect(finding?.detail).toContain('/size-guide');
    // The remedy has to be one she can act on without knowing what a link is made of.
    expect(finding?.detail).toMatch(/menu|footer/);
  });
});

/* ── Where the link is ──────────────────────────────────────────────────────── */

describe('what counts as a way in', () => {
  it('counts a link in the shared header, which is how most pages are reached', () => {
    expect(
      unreachable({
        frame: frameWith(link('/size-guide', 'Size guide')),
        pages: [
          page({ id: 'home', name: 'Home', slug: '/', root: body() }),
          page({ id: 'size', name: 'Size guide', slug: 'size-guide', root: body() }),
        ],
      })
    ).toEqual([]);
  });

  it('counts a link from any other page, not only the chrome', () => {
    expect(
      unreachable({
        pages: [
          page({ id: 'home', name: 'Home', slug: '/', root: body(link('/size-guide')) }),
          page({ id: 'size', name: 'Size guide', slug: 'size-guide', root: body() }),
        ],
      })
    ).toEqual([]);
  });

  it('counts a link a page makes to itself as no way in at all', () => {
    // A page linking only to itself is the shape a "back to top" or a self-referential
    // breadcrumb takes. It is still true that nobody can arrive.
    expect(
      unreachable({
        pages: [
          page({ id: 'home', name: 'Home', slug: '/', root: body() }),
          page({
            id: 'size',
            name: 'Size guide',
            slug: 'size-guide',
            root: body(link('/size-guide')),
          }),
        ],
      })
    ).toEqual([]);
  });

  it('resolves a relative link the way the browser and the link check both do', () => {
    expect(
      unreachable({
        pages: [
          page({ id: 'home', name: 'Home', slug: '/', root: body(link('size-guide')) }),
          page({ id: 'size', name: 'Size guide', slug: 'size-guide', root: body() }),
        ],
      })
    ).toEqual([]);
  });

  it('treats "/size-guide/" and "/size-guide" as the same address', () => {
    expect(
      unreachable({
        pages: [
          page({ id: 'home', name: 'Home', slug: '/', root: body(link('/size-guide/')) }),
          page({ id: 'size', name: 'Size guide', slug: '/size-guide', root: body() }),
        ],
      })
    ).toEqual([]);
  });
});

/* ── What is never reported ─────────────────────────────────────────────────── */

describe('pages that are reached without an authored link', () => {
  const reached = new Set<string>();

  it('never reports the home page', () => {
    expect(checkReach([address({ id: 'h', name: 'Home' })], reached)).toEqual([]);
  });

  it('never reports a record template, which is reached one record at a time', () => {
    const pages = [
      address({ id: 'p', name: 'Each product', slug: '/products/:handle', kind: 'collection' }),
      address({ id: 'b', name: 'Each post', slug: '/blog/:slug', recordType: 'cms.blog_post' }),
    ];
    expect(checkReach(pages, reached)).toEqual([]);
  });

  it("never reports the storefront's own routes, which the platform reaches itself", () => {
    // A cart core, a search box and the account area's own navigation are all links
    // this check cannot see, because none of them was authored. Every entry here can be
    // matched to the control that opens it, which is the bar for being on this list.
    const pages = [
      address({ id: 'c', name: 'Cart', slug: '/cart' }),
      address({ id: 's', name: 'Search', slug: '/search' }),
      address({ id: 'l', name: 'Login', slug: '/account/login' }),
      address({ id: 'r', name: 'Reset password', slug: '/account/reset' }),
    ];
    expect(checkReach(pages, reached)).toEqual([]);
  });

  // This test used to include `/products` in the list above, which is how the rule came
  // to be blind: it inherited `BUILTIN_PATHS` — the addresses that EXIST, so a link to
  // one is not broken — as if that answered whether anything REACHES them. It does not.
  // Name the control that opens `/cart` and it is the navbar's cart core; name the one
  // that opens `/collections` and there is none. Three seeded browse indexes were exempt
  // on that confusion, and an apparel maker's seven published collections sat behind an
  // address nothing linked (issue 340).
  it('DOES report the browse indexes, which no platform control opens', () => {
    const pages = [
      address({ id: 'p', name: 'Products', slug: '/products' }),
      address({ id: 'o', name: 'Collections', slug: '/collections' }),
      address({ id: 'g', name: 'Categories', slug: '/category' }),
    ];
    expect(checkReach(pages, reached).map((f) => f.evidence)).toEqual([
      '/products',
      '/collections',
      '/category',
    ]);
  });

  it('goes quiet on a browse index once something links it', () => {
    // The other direction, so the rule cannot be "always complains about /collections".
    // An authored footer link is exactly what the finding asks the owner to add.
    const pages = [address({ id: 'o', name: 'Collections', slug: '/collections' })];
    expect(checkReach(pages, new Set(['/collections']))).toEqual([]);
  });

  it('stays silent when nothing was walked, rather than reporting the whole site', () => {
    // The worst false positive available: an empty reached set means "nobody looked"
    // just as readily as "nothing links anywhere".
    expect(lintSite({ pages: [] }).findings).toEqual([]);
  });
});
