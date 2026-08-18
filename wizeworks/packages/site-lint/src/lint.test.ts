import { describe, expect, it } from 'vitest';
import {
  atom,
  behave,
  bind,
  el,
  host,
  outlet,
  part,
  type ElementNode,
  type Node,
} from '@wizeworks/silicaui-html';
import { bindAttr, starterFrame, starterPages } from '@wizeworks/silica-catalog';

import { lintSite } from './index';
import { resolveTargets } from './links';
import type { LinkTargets, LintablePage, LintRuleId, SiteLintInput } from './types';

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

/** A body that satisfies every rule not under test: one h1, some words. */
function body(...children: Node[]): ElementNode {
  return el('main', '', { children: [el('h1', '', { text: 'The page' }), ...children] });
}

function run(input: Partial<SiteLintInput> & { pages: LintablePage[] }) {
  return lintSite({ ...input });
}

function rules(input: Partial<SiteLintInput> & { pages: LintablePage[] }): LintRuleId[] {
  return run(input).findings.map((f) => f.rule);
}

/** A frame with a real outlet, so frame tests are about the thing under test. */
function frameWith(...children: Node[]): { root: Node } {
  return { root: el('div', '', { children: [...children, outlet()] }) };
}

const FULL_ROSTER: LinkTargets = {
  paths: ['/about'],
  productHandles: ['brake-kit'],
  collectionHandles: [],
  postSlugs: [],
};

/* ── Links ──────────────────────────────────────────────────────────────────── */

describe('links', () => {
  const linkTo = (href: string): Node =>
    body(el('a', '', { attrs: { href }, text: 'Go somewhere' }));

  it('flags a bare path that matches no page', () => {
    expect(rules({ pages: [page({ root: linkTo('/about-us') })], targets: FULL_ROSTER })).toContain(
      'link-broken'
    );
  });

  it('accepts a bare path that matches a page, however either side spells the slug', () => {
    const pages = [
      page({ root: linkTo('/pricing/') }),
      page({ id: 'p2', name: 'Pricing', slug: 'pricing', root: body() }),
    ];
    expect(rules({ pages, targets: { paths: [] } })).not.toContain('link-broken');
  });

  it('leaves bare paths alone when the caller did not supply a path roster', () => {
    // `paths: undefined` means "I did not tell you what exists" — see LinkTargets.
    expect(
      rules({ pages: [page({ root: linkTo('/warranty') })], targets: { productHandles: [] } })
    ).not.toContain('link-broken');
  });

  it('flags a product handle that is not in the catalog', () => {
    const findings = run({
      pages: [page({ root: linkTo('/products/gone') })],
      targets: FULL_ROSTER,
    }).findings;
    const broken = findings.find((f) => f.rule === 'link-broken');
    expect(broken?.title).toBe("This link goes to a product that doesn't exist");
    expect(broken?.evidence).toBe('/products/gone');
  });

  it('accepts a product handle that is in the catalog', () => {
    expect(
      rules({ pages: [page({ root: linkTo('/products/brake-kit') })], targets: FULL_ROSTER })
    ).not.toContain('link-broken');
  });

  it('leaves a product link alone when no catalog was supplied', () => {
    expect(
      rules({ pages: [page({ root: linkTo('/products/anything') })], targets: { paths: [] } })
    ).not.toContain('link-broken');
  });

  it('flags a record path that is too deep even with no roster', () => {
    // No route is two segments deep under /products, so this is broken regardless
    // of what the catalog holds.
    expect(
      rules({ pages: [page({ root: linkTo('/products/a/b') })], targets: { paths: [] } })
    ).toContain('link-broken');
  });

  it('accepts the storefront built-in routes and the whole account subtree', () => {
    const found = rules({
      pages: [
        page({
          root: body(
            el('a', '', { attrs: { href: '/cart' }, text: 'Cart' }),
            el('a', '', { attrs: { href: '/account/orders/17' }, text: 'Order' })
          ),
        }),
      ],
      targets: FULL_ROSTER,
    });
    expect(found).not.toContain('link-broken');
  });

  it('never judges an external link', () => {
    expect(
      rules({ pages: [page({ root: linkTo('https://example.com/nope') })], targets: FULL_ROSTER })
    ).not.toContain('link-broken');
  });

  // A record page's slug is an ADDRESS (`/products/:handle`), not a location — it
  // renders at a different path for every product. Two consequences, both of which used
  // to be handled off `kind === 'collection'` alone and now survive that column's
  // removal.
  it('never resolves a relative href against a record page', () => {
    // Resolving `about` against `/products/:handle` yields `/products/about`, which is
    // reported broken on every tenant who ever wrote a relative link on their product
    // page — a finding about a link that works.
    const report = run({
      pages: [
        page({
          id: 'pdp',
          name: 'Product detail',
          slug: '/products/:handle',
          root: body(el('a', '', { attrs: { href: 'about' }, text: 'About' })),
        }),
      ],
      targets: FULL_ROSTER,
    });
    expect(report.findings.map((f) => f.rule)).not.toContain('link-broken');
  });

  it('does not admit a record address into the roster of reachable paths', () => {
    // Asserted on `resolveTargets` directly rather than through a link finding: every
    // record address sits under a `DYNAMIC_ROUTES` prefix, so a link to one is reported
    // broken by the handle-roster branch whether or not the path roster admits it. A
    // finding-level test would pass without the filter and prove nothing.
    const withRecordPage = resolveTargets(['/', '/products/:handle'], { paths: [] });
    expect(withRecordPage.paths?.has('/products/:handle')).toBe(false);
    // The ordinary page beside it still lands in the roster.
    expect(withRecordPage.paths?.has('/')).toBe(true);
  });

  it('resolves a relative href against the page it is on', () => {
    const pages = [
      page({ id: 'p1', name: 'Setup', slug: '/guides/setup', root: linkTo('teardown') }),
      page({ id: 'p2', name: 'Teardown', slug: '/guides/teardown', root: body() }),
    ];
    expect(rules({ pages, targets: { paths: [] } })).not.toContain('link-broken');
  });

  it('flags an in-page jump to a section that is not there, and accepts one that is', () => {
    const missing = rules({
      pages: [page({ root: linkTo('#faq') })],
      targets: FULL_ROSTER,
    });
    expect(missing).toContain('link-anchor-missing');

    const present = rules({
      pages: [
        page({
          root: body(
            el('a', '', { attrs: { href: '#faq' }, text: 'Questions' }),
            el('section', '', { attrs: { id: 'faq' }, children: [el('p', '', { text: 'Q' })] })
          ),
        }),
      ],
      targets: FULL_ROSTER,
    });
    expect(present).not.toContain('link-anchor-missing');
  });

  it('resolves an anchor against the chrome as well as the page', () => {
    expect(
      rules({
        pages: [page({ root: linkTo('#top') })],
        frame: frameWith(el('header', '', { attrs: { id: 'top' } })),
        targets: FULL_ROSTER,
      })
    ).not.toContain('link-anchor-missing');
  });

  it('flags a link with no destination at all', () => {
    expect(rules({ pages: [page({ root: linkTo('#') })], targets: FULL_ROSTER })).toContain(
      'link-no-destination'
    );
  });

  it('flags an email link with no address but accepts one with an address', () => {
    expect(rules({ pages: [page({ root: linkTo('mailto:') })], targets: FULL_ROSTER })).toContain(
      'link-mailto-empty'
    );
    expect(
      rules({ pages: [page({ root: linkTo('mailto:hi@example.com') })], targets: FULL_ROSTER })
    ).not.toContain('link-mailto-empty');
  });

  it('reads a destination off a silica Button atom as well as an anchor', () => {
    expect(
      rules({
        pages: [page({ root: body(atom('Button', '', { label: 'Buy', href: '/products/gone' })) })],
        targets: FULL_ROSTER,
      })
    ).toContain('link-broken');
  });

  // A form's own Send button has no destination BY DESIGN — it acts on the fields it
  // sits in. Reporting it told every owner with a working contact form that the button
  // was broken, and the suggested remedy (choose a page for it) would have broken it.
  // Found on the shipped `sparx` blueprint, where it fired on all 21.
  it('leaves a form submit button alone, but still flags a destination-less one', () => {
    expect(
      rules({
        pages: [
          page({ root: body(atom('Button', '', { label: 'Send message', type: 'submit' })) }),
        ],
        targets: FULL_ROSTER,
      })
    ).not.toContain('link-no-destination');

    expect(
      rules({
        pages: [page({ root: body(atom('Button', '', { label: 'Reset', type: 'reset' })) })],
        targets: FULL_ROSTER,
      })
    ).not.toContain('link-no-destination');

    // No `type` at all: a bare button outside a form really does nothing.
    expect(
      rules({
        pages: [page({ root: body(atom('Button', '', { label: 'Learn more' })) })],
        targets: FULL_ROSTER,
      })
    ).toContain('link-no-destination');
  });
});

/* ── Images ─────────────────────────────────────────────────────────────────── */

describe('images', () => {
  it('flags an image with no picture chosen', () => {
    expect(
      rules({ pages: [page({ root: body(el('img', '', { attrs: { alt: 'A' } })) })] })
    ).toContain('image-no-source');
  });

  it('does not flag a bound image for having no picture', () => {
    const bound = bind(el('img', '', { attrs: { alt: 'A' } }), 'image');
    expect(rules({ pages: [page({ root: body(bound) })] })).not.toContain('image-no-source');
  });

  it('flags a missing description but accepts a deliberately empty one', () => {
    expect(
      rules({ pages: [page({ root: body(el('img', '', { attrs: { src: '/a.png' } })) })] })
    ).toContain('image-no-description');
    expect(
      rules({
        pages: [page({ root: body(el('img', '', { attrs: { src: '/a.png', alt: '' } })) })],
      })
    ).not.toContain('image-no-description');
  });

  it('applies the same rule to a silica Image atom', () => {
    expect(
      rules({ pages: [page({ root: body(atom('Image', '', { src: '/a.png' })) })] })
    ).toContain('image-no-description');
    expect(
      rules({ pages: [page({ root: body(atom('Image', '', { src: '/a.png', alt: '' })) })] })
    ).not.toContain('image-no-description');
  });
});

/* ── Headings ───────────────────────────────────────────────────────────────── */

describe('headings', () => {
  it('flags a page with no main heading', () => {
    expect(rules({ pages: [page({ root: el('main', '', { text: 'Words' }) })] })).toContain(
      'heading-missing'
    );
  });

  it('stays quiet when the page is built around a live region that renders its own', () => {
    expect(
      rules({ pages: [page({ root: el('main', '', { children: [host('commerce.cart')] }) })] })
    ).not.toContain('heading-missing');
  });

  it('flags a second main heading, on the second one', () => {
    const report = run({
      pages: [page({ root: body(el('h1', '', { text: 'Also the page' })) })],
    });
    const found = report.findings.find((f) => f.rule === 'heading-multiple-top');
    expect(found?.evidence).toBe('Also the page');
  });

  it('flags a skipped level', () => {
    expect(rules({ pages: [page({ root: body(el('h3', '', { text: 'Detail' })) })] })).toContain(
      'heading-level-skipped'
    );
  });

  it('accepts a level-by-level outline', () => {
    expect(
      rules({
        pages: [
          page({ root: body(el('h2', '', { text: 'Part' }), el('h3', '', { text: 'Bit' })) }),
        ],
      })
    ).not.toContain('heading-level-skipped');
  });

  it('flags an empty heading', () => {
    expect(rules({ pages: [page({ root: body(el('h2', '')) })] })).toContain('heading-empty');
  });
});

/* ── Controls ───────────────────────────────────────────────────────────────── */

describe('controls', () => {
  it('flags a button nothing is wired to', () => {
    expect(rules({ pages: [page({ root: body(el('button', '', { text: 'Send' })) })] })).toContain(
      'button-does-nothing'
    );
  });

  it('accepts a button that submits a form', () => {
    expect(
      rules({
        pages: [
          page({
            root: body(el('form', '', { children: [el('button', '', { text: 'Send' })] })),
          }),
        ],
      })
    ).not.toContain('button-does-nothing');
  });

  it('accepts a button that is part of a behavior', () => {
    expect(
      rules({
        pages: [
          page({
            root: body(
              behave(
                el('div', '', {
                  children: [part(el('button', '', { text: 'Open' }), 'trigger')],
                }),
                { type: 'disclosure' }
              )
            ),
          }),
        ],
      })
    ).not.toContain('button-does-nothing');
  });

  it('flags an anchor with no destination as not really a link', () => {
    const report = run({ pages: [page({ root: body(el('a', 'btn', { text: 'Buy now' })) })] });
    const found = report.findings.find((f) => f.rule === 'button-does-nothing');
    expect(found?.title).toBe('This looks like a link but is not one');
  });

  it('accepts an anchor whose destination arrives through an attribute BINDING', () => {
    // The product card: no authored href, a bound one instead. (This used to arrive via
    // a hidden carrier input; silicaui 0.36.0 made it a native binding, and the rule has
    // to keep seeing it either way or every product card reports as a dead link.)
    const card = bindAttr(
      el('a', 'card', { children: [el('span', '', { text: 'Product' })] }),
      'href',
      'url'
    );
    expect(rules({ pages: [page({ root: body(card) })] })).not.toContain('button-does-nothing');
  });

  it('flags a control with no words and no icon in it', () => {
    expect(
      rules({ pages: [page({ root: body(el('a', 'btn', { attrs: { href: '/about' } })) })] })
    ).toContain('control-no-label');
  });

  it('accepts an icon-only control', () => {
    expect(
      rules({
        pages: [
          page({
            root: body(
              el('a', 'btn', {
                attrs: { href: '/about', 'aria-label': 'About us' },
                children: [el('svg', '')],
              })
            ),
          }),
        ],
      })
    ).not.toContain('control-no-label');
  });
});

/* ── Styling ────────────────────────────────────────────────────────────────── */

describe('styling', () => {
  it('flags a class the stylesheet does not contain', () => {
    const report = run({ pages: [page({ root: body(el('div', 'flex gap-7', { text: 'x' })) })] });
    const found = report.findings.find((f) => f.rule === 'class-no-css');
    expect(found?.evidence).toBe('gap-7');
    expect(found?.severity).toBe('warning');
  });

  it('flags a viewport variant as invisible in the preview, not as broken', () => {
    const report = run({
      pages: [page({ root: body(el('div', 'grid md:grid-cols-3', { text: 'x' })) })],
    });
    const found = report.findings.find((f) => f.rule === 'class-preview-blind');
    expect(found?.severity).toBe('suggestion');
    expect(found?.detail).toContain('@3xl:grid-cols-3');
  });

  // The catalog ships TWO wordings of the same finding, and this surface has exactly one
  // reader: a business owner. `hint` is written for an MCP agent inspecting a tree it just
  // wrote, and it was being appended verbatim — so the Check panel said "not in the
  // declared scale and emits no CSS — the nearest declared step is `gap-2`. Declared: 0,
  // 1, 2, 3, …" to someone who has never heard of a scale, CSS, or a declaration.
  it("never speaks to the owner in the agent hint's vocabulary", () => {
    const report = run({
      pages: [
        page({ root: body(el('div', 'flex gap-2.5', { text: 'x' })) }),
        page({ slug: '/b', root: body(el('div', 'leading-[1.05]', { text: 'x' })) }),
        page({ slug: '/c', root: body(el('div', 'grid md:grid-cols-3', { text: 'x' })) }),
      ],
    });
    const styling = report.findings.filter(
      (f) => f.rule === 'class-no-css' || f.rule === 'class-preview-blind'
    );
    expect(styling.length).toBeGreaterThan(0);

    for (const finding of styling) {
      expect(finding.detail, finding.rule).not.toMatch(
        /declared scale|emits no CSS|Declared:|stylesheet|Tailwind|scale token|is never scanned/i
      );
    }
  });

  it('names the replacement the Fix it button would apply, not a second answer', () => {
    // Prose and button quote ONE field (`replacement`). They were two independently
    // built strings, which is a divergence waiting to happen.
    const report = run({ pages: [page({ root: body(el('div', 'flex gap-2.5', { text: 'x' })) })] });
    const found = report.findings.find((f) => f.rule === 'class-no-css');
    expect(found?.detail).toContain('gap-2');
    expect(found?.detail).not.toContain('gap-2.5');
  });

  it('says nothing about ordinary classes', () => {
    expect(
      rules({
        pages: [page({ root: body(el('div', 'flex gap-6 @2xl:grid-cols-3', { text: 'x' })) })],
      })
    ).not.toContain('class-no-css');
  });
});

/* ── Structure ──────────────────────────────────────────────────────────────── */

describe('structure', () => {
  it('flags a frame with nowhere for the page to go', () => {
    const report = run({
      pages: [page({ root: body() })],
      frame: { root: el('div', '', { children: [el('header', '', { text: 'Brand' })] }) },
    });
    expect(report.findings.map((f) => f.rule)).toContain('frame-no-outlet');
    expect(report.status).toBe('fail');
  });

  it('flags an instance of a saved piece that has been deleted', () => {
    const instance: Node = { kind: 'element', tag: 'div', instanceOf: 'sym-gone' };
    expect(rules({ pages: [page({ root: body(instance) })], symbols: {} })).toContain(
      'symbol-missing'
    );
  });

  it('flags two blocks in one page sharing an id', () => {
    const root = body(el('p', '', { text: 'one' }), el('p', '', { text: 'two' }));
    (root.children![1] as ElementNode).id = 'dupe';
    (root.children![2] as ElementNode).id = 'dupe';
    expect(rules({ pages: [page({ root })] })).toContain('duplicate-node-id');
  });

  it('does not flag the same id on two different pages — those trees never meet', () => {
    const one = body(el('p', '', { text: 'a' }));
    const two = body(el('p', '', { text: 'b' }));
    (one.children![1] as ElementNode).id = 'same';
    (two.children![1] as ElementNode).id = 'same';
    expect(
      rules({
        pages: [
          page({ root: one }),
          page({ id: 'p2', name: 'About', slug: '/about', root: two, seoTitle: 'About' }),
        ],
      })
    ).not.toContain('duplicate-node-id');
  });

  it('does flag an id shared between a page and the chrome — those mount together', () => {
    const root = body(el('p', '', { text: 'a' }));
    (root.children![1] as ElementNode).id = 'same';
    const header = el('header', '', { text: 'Brand' });
    header.id = 'same';
    expect(rules({ pages: [page({ root })], frame: frameWith(header) })).toContain(
      'duplicate-node-id'
    );
  });
});

/* ── Search-engine metadata ─────────────────────────────────────────────────── */

describe('search metadata', () => {
  it('flags a missing title and description', () => {
    const found = rules({
      pages: [page({ root: body(), seoTitle: null, seoDescription: '  ' })],
    });
    expect(found).toContain('seo-title-missing');
    expect(found).toContain('seo-description-missing');
  });

  // Seeded on every commerce site, so getting this wrong puts five findings nobody can
  // act on at the top of every Check run. A template's description would have to be
  // true of all hundred products rendering through it; each product carries its own.
  it('asks nothing of a record page, which templates a hundred records', () => {
    const found = rules({
      pages: [
        page({
          id: 'rec',
          name: 'Product detail',
          slug: '/products/:handle',
          kind: 'collection',
          recordType: 'commerce.product',
          root: body(),
          seoTitle: null,
          seoDescription: null,
        }),
      ],
    });
    expect(found).not.toContain('seo-title-missing');
    expect(found).not.toContain('seo-description-missing');
    // Not "hidden" either — its rendered instances are very much meant to be indexed,
    // so reporting it as excluded from search would be a different lie.
    expect(found).not.toContain('seo-page-hidden');
  });

  it('does not let record pages invent a duplicate out of a shared blank', () => {
    // Five seeded record pages all with no description must not read as five pages
    // sharing one — the empty value is not a value they chose.
    const found = rules({
      pages: [
        page({ root: body() }),
        page({
          id: 'r1',
          name: 'Product detail',
          slug: '/products/:handle',
          kind: 'collection',
          root: body(),
          seoTitle: 'Shared',
          seoDescription: 'Shared',
        }),
        page({
          id: 'r2',
          name: 'Blog post',
          slug: '/blog/:slug',
          kind: 'collection',
          root: body(),
          seoTitle: 'Shared',
          seoDescription: 'Shared',
        }),
      ],
    });
    expect(found).not.toContain('seo-title-duplicate');
    expect(found).not.toContain('seo-description-duplicate');
  });

  it('flags two pages sharing a title, ignoring case and spacing', () => {
    const found = rules({
      pages: [
        page({ root: body(), seoTitle: 'Our Story' }),
        page({ id: 'p2', name: 'About', slug: '/about', root: body(), seoTitle: 'our  story' }),
      ],
    });
    expect(found.filter((r) => r === 'seo-title-duplicate')).toHaveLength(2);
  });

  it('says a hidden page is hidden and asks nothing else of it', () => {
    const found = rules({
      pages: [page({ root: body(), noindex: true, seoTitle: null, seoDescription: null })],
    });
    expect(found).toContain('seo-page-hidden');
    expect(found).not.toContain('seo-title-missing');
    expect(found).not.toContain('seo-description-missing');
  });

  it('does not count a hidden page toward a duplicate', () => {
    const found = rules({
      pages: [
        page({ root: body(), seoTitle: 'Thanks' }),
        page({
          id: 'p2',
          name: 'Thanks',
          slug: '/thanks',
          root: body(),
          seoTitle: 'Thanks',
          noindex: true,
        }),
      ],
    });
    expect(found).not.toContain('seo-title-duplicate');
  });
});

/* ── Composition: one fix, not N reports ────────────────────────────────────── */

describe('composition', () => {
  const pages = [
    page({ root: body() }),
    page({ id: 'p2', name: 'About', slug: '/about', root: body(), seoTitle: 'About' }),
    page({ id: 'p3', name: 'Contact', slug: '/contact', root: body(), seoTitle: 'Contact' }),
  ];

  it('reports a broken footer link once, listing every page it appears on', () => {
    const report = run({
      pages,
      frame: frameWith(
        el('footer', '', {
          children: [el('a', '', { attrs: { href: '/deleted' }, text: 'Old page' })],
        })
      ),
      targets: { paths: [] },
    });
    const broken = report.findings.filter((f) => f.rule === 'link-broken');
    expect(broken).toHaveLength(1);
    expect(broken[0]?.location.scope).toBe('frame');
    expect(broken[0]?.location.seenOn).toEqual(['Home', 'About', 'Contact']);
  });

  it('attributes a problem inside a saved piece to the piece, not to each page', () => {
    const instance: Node = { kind: 'element', tag: 'div', instanceOf: 'promo' };
    const report = run({
      pages: [
        page({ root: body(instance) }),
        page({ id: 'p2', name: 'About', slug: '/about', root: body(instance), seoTitle: 'About' }),
      ],
      symbols: {
        promo: {
          id: 'promo',
          name: 'Promo banner',
          root: el('div', '', { children: [el('img', '', { attrs: { src: '/p.png' } })] }),
        },
      },
    });
    const found = report.findings.filter((f) => f.rule === 'image-no-description');
    expect(found).toHaveLength(1);
    expect(found[0]?.location.scope).toBe('symbol');
    expect(found[0]?.location.ownerName).toBe('Promo banner');
    expect(found[0]?.location.seenOn).toEqual(['Home', 'About']);
  });

  it('survives a saved piece that contains itself', () => {
    const instance: Node = { kind: 'element', tag: 'div', instanceOf: 'loop' };
    expect(() =>
      run({
        pages: [page({ root: body(instance) })],
        symbols: {
          loop: { id: 'loop', name: 'Loop', root: el('div', '', { children: [instance] }) },
        },
      })
    ).not.toThrow();
  });

  it('points at the node so a surface can select it', () => {
    const link = el('a', '', { attrs: { href: '/gone' }, text: 'Go' });
    link.id = 'node-42';
    const report = run({ pages: [page({ root: body(link) })], targets: { paths: [] } });
    const broken = report.findings.find((f) => f.rule === 'link-broken');
    expect(broken?.location.nodeId).toBe('node-42');
    expect(broken?.location.ownerId).toBe('p1');
    expect(broken?.location.nodePath).toContain('a');
  });
});

/* ── Status ─────────────────────────────────────────────────────────────────── */

describe('status', () => {
  it('is a summary of severity, never a permission to publish', () => {
    const clean = run({ pages: [page({ root: body() })] });
    expect(clean.status).toBe('pass');
    expect(clean.counts).toEqual({ error: 0, warning: 0, suggestion: 0 });
    expect(clean.pagesChecked).toBe(1);

    const warned = run({ pages: [page({ root: body(el('button', '', { text: 'Send' })) })] });
    expect(warned.status).toBe('warn');

    // A page whose whole body is a live region is not an empty page.
    const liveOnly = run({ pages: [page({ root: el('main', '', { children: [host('x')] }) })] });
    expect(liveOnly.status).toBe('pass');
  });

  it('calls an empty page an error', () => {
    const report = run({ pages: [page({ root: el('main', '') })] });
    expect(report.findings.map((f) => f.rule)).toContain('page-empty');
    expect(report.status).toBe('fail');
  });
});

/* ── The shipped starter, as a regression ───────────────────────────────────── */

describe('the starter site', () => {
  const pages = starterPages({ commerceEnabled: true });
  const report = lintSite({
    pages: pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, root: p.root })),
    frame: starterFrame({ commerceEnabled: true }),
    targets: { paths: [], productHandles: [], collectionHandles: [], postSlugs: [] },
  });

  it('inspects something — a vacuous pass is the failure mode that matters here', () => {
    expect(pages.length).toBeGreaterThan(5);
    expect(report.pagesChecked).toBe(pages.length);
  });

  it('has nothing broken in it', () => {
    expect(report.findings.filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('reports only the metadata a fresh site genuinely has not been given yet', () => {
    // Every seeded page ships without a search title or description, which is true and
    // is the one thing a new tenant is expected to fill in. ANY other rule firing here
    // is a defect in the shipped catalog — three were found and fixed this way (two
    // half-step gap classes that compile only while their source file is scanned, and
    // a footer heading two levels below the page title).
    const unexpected = [...new Set(report.findings.map((f) => f.rule))].filter(
      (rule) => !rule.startsWith('seo-')
    );
    expect(unexpected).toEqual([]);
  });
});
