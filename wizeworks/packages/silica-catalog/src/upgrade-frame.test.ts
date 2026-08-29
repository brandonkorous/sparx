// The stale-frame heal. These tests are mostly about what it must NOT touch: it rewrites
// a tenant's stored draft, so the blast radius is the thing under test.

import { describe, expect, it } from 'vitest';
import { atom, bind, el } from '@wizeworks/silicaui-html';
import type { HostNode, Node } from '@wizeworks/silicaui-html';

import { upgradeFrameChrome } from './upgrade-frame';
import { HOST_KEYS, hostCore } from './host-nodes';
import { starterFrame } from './site';

/** A frame as it was stamped before the brand core existed: the text-only Wordmark the
 *  broken cohort actually has in the database. */
const legacyFrame = (wordmarkClass = 'wordmark'): Node =>
  el('div', 'flex min-h-screen flex-col', {
    children: [
      el('nav', 'flex items-center justify-between', {
        children: [
          bind(atom('Wordmark', wordmarkClass, { text: 'SilicaUI' }), 'site.identity.name'),
          el('div', 'flex gap-6', { children: [el('a', '', { text: 'About' })] }),
        ],
      }),
      el('main', 'flex-1', { children: [{ kind: 'outlet' }] }),
      el('footer', '', { children: [el('span', '', { text: 'Acme' })] }),
    ],
  });

// Returns HostNode, not Node: the only thing it ever matches is a `kind: "host"`
// brand core, so the tests can read `.component` without narrowing at each call.
const findBrand = (node: Node): HostNode | null => {
  if (node.kind === 'host' && node.component === HOST_KEYS.siteBrand) return node;
  const children = node.kind === 'element' ? (node.children ?? []) : [];
  for (const c of children) {
    if (typeof c === 'string') continue;
    const hit = findBrand(c);
    if (hit) return hit;
  }
  return null;
};

describe('upgradeFrameChrome — healing a stale frame', () => {
  it('replaces the legacy text-only Wordmark with the live brand core', () => {
    const { root, changed } = upgradeFrameChrome(legacyFrame());
    expect(changed).toBe(true);
    const brand = findBrand(root);
    expect(brand?.kind).toBe('host');
    // The payoff: the tenant opens the studio and their logo is already there.
    expect(brand?.component).toBe(HOST_KEYS.siteBrand);
  });

  it('preserves the author’s wrapper class, so a restyled mark stays restyled', () => {
    // Healing must not read as "the platform reset my header".
    const { root } = upgradeFrameChrome(legacyFrame('wordmark mx-auto text-2xl'));
    expect((findBrand(root) as { class?: string })?.class).toBe('wordmark mx-auto text-2xl');
  });

  it('is idempotent — a healed frame heals to itself', () => {
    const once = upgradeFrameChrome(legacyFrame());
    const twice = upgradeFrameChrome(once.root);
    expect(twice.changed).toBe(false);
    expect(twice.root).toBe(once.root);
  });

  it('leaves a CURRENT frame untouched (no pointless autosave)', () => {
    const frame = starterFrame({ commerceEnabled: true }).root;
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(false);
    expect(root).toBe(frame);
  });

  it('does not touch a Wordmark the author placed OUTSIDE the nav', () => {
    // Their content, their call. The header mark is the one the platform seeded and
    // broke; a footer/mid-page Wordmark is authored intent.
    const frame = el('div', '', {
      children: [
        el('nav', '', { children: [el('a', '', { text: 'About' })] }),
        el('main', '', { children: [{ kind: 'outlet' }] }),
        el('footer', '', {
          children: [bind(atom('Wordmark', '', { text: 'Acme' }), 'site.identity.name')],
        }),
      ],
    });
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(false);
    expect(root).toBe(frame);
  });

  it('does nothing when the author already added the brand core by hand', () => {
    const frame = el('div', '', {
      children: [
        el('nav', '', {
          children: [
            hostCore(HOST_KEYS.siteBrand),
            bind(atom('Wordmark', '', { text: 'old' }), 'site.identity.name'),
          ],
        }),
      ],
    });
    // Would otherwise hand them two brand marks.
    expect(upgradeFrameChrome(frame).changed).toBe(false);
  });

  // The shape a REAL stored frame has: `div > [header, main, footer]`, with the navbar
  // nested inside the header. The fixtures above hoist `<nav>` to the top level, which is
  // what let the nav repairs pass their tests while matching nothing in the database
  // (issue 296) — these pin the real shape so that cannot happen again.
  const realFrame = (nav: Node): Node =>
    el('div', 'flex min-h-screen flex-col', {
      children: [
        el('header', '', { children: [el('div', '', { children: [] }), nav] }),
        el('main', 'flex-1', { children: [{ kind: 'outlet' }] }),
        el('footer', '', { children: [el('span', '', { text: 'Acme' })] }),
      ],
    });

  const hostCoresOf = (node: Node): { component: string; class?: string }[] => {
    const out: { component: string; class?: string }[] = [];
    const walk = (n: Node): void => {
      if (n.kind === 'host') out.push(n);
      const children = n.kind === 'element' ? (n.children ?? []) : [];
      for (const c of children) if (typeof c !== 'string') walk(c);
    };
    walk(node);
    return out;
  };

  it('heals a nav nested inside the header, which is where every real frame keeps it', () => {
    const frame = realFrame(
      el('nav', 'navbar', {
        children: [bind(atom('Wordmark', 'wordmark', { text: 'SilicaUI' }), 'site.identity.name')],
      })
    );
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(true);
    expect(findBrand(root)?.component).toBe(HOST_KEYS.siteBrand);
  });

  /** Tag the node with the navbar block's `secondary` slot, which is what the platform's
   *  own fill writes and the only thing the account repair keys on. */
  const secondary = <T extends object>(node: T): T =>
    Object.assign(node, { slot: { name: 'secondary', type: 'link', label: 'Secondary link' } });

  it('replaces BOTH seeded sign-in nodes, across two node kinds, each keeping its class', () => {
    // The navbar fills `secondary` twice and NOT in the same shape: an <a> in the bar and
    // a Button COMPONENT in the phone panel, whose href lives in props. Matching on the
    // tag finds the first and misses the second, leaving a signed-in customer still told
    // to sign in on her phone. This is the real stored shape, read out of the database.
    const frame = realFrame(
      el('nav', 'navbar', {
        children: [
          secondary(
            el('a', 'hidden text-sm @sm:inline', {
              attrs: { href: '/account/login' },
              text: 'Sign in',
            })
          ),
          el('div', 'panel', {
            children: [
              secondary(
                atom('Button', 'btn btn-ghost btn-sm w-full', {
                  href: '/account/login',
                  label: 'Sign in',
                })
              ),
            ],
          }),
        ],
      })
    );
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(true);

    const links = hostCoresOf(root).filter((c) => c.component === HOST_KEYS.siteAccountLink);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.class)).toEqual([
      'hidden text-sm @sm:inline',
      'btn btn-ghost btn-sm w-full',
    ]);
  });

  it('heals a sign-in link with NO slot on it — which is what a captured frame has', () => {
    // The rule used to require `slot.name === 'secondary'`, on the reasoning that the slot
    // is written by the platform's fill and by nothing else. True of a frame the CURRENT
    // composite built, and false of every frame that most needs the repair: the golden
    // `sparx` bundle is a capture of a hand-authored navbar whose sign-in links carry no
    // slot at all, and twenty one shipped designs are clones of it (issue 313). The rule
    // matched none of them, and did nothing for the fifteen live sites still telling their
    // signed-in customers to sign in.
    const frame = realFrame(
      el('nav', 'navbar', {
        children: [
          el('a', 'text-sm font-medium', { attrs: { href: '/account/login' }, text: 'Sign in' }),
          atom('Button', 'btn btn-ghost btn-sm', { href: '/account/login', label: 'Sign in' }),
        ],
      })
    );
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(true);

    const links = hostCoresOf(root).filter((c) => c.component === HOST_KEYS.siteAccountLink);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.class)).toEqual(['text-sm font-medium', 'btn btn-ghost btn-sm']);
  });

  it('leaves an account link the author repointed at their own page alone', () => {
    const frame = realFrame(
      el('nav', 'navbar', {
        children: [secondary(el('a', '', { attrs: { href: '/members' }, text: 'Members' }))],
      })
    );
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(false);
    expect(root).toBe(frame);
  });

  type Element = Extract<Node, { kind: 'element' }>;

  const findByTag = (node: Node, tag: string): Element | null => {
    if (node.kind === 'element' && node.tag === tag) return node;
    const children = node.kind === 'element' ? (node.children ?? []) : [];
    for (const c of children) {
      if (typeof c === 'string') continue;
      const hit = findByTag(c, tag);
      if (hit) return hit;
    }
    return null;
  };

  const linkNamed = (node: Node, href: string): Element | null => {
    if (node.kind === 'element' && node.tag === 'a' && node.attrs?.href === href) return node;
    const children = node.kind === 'element' ? (node.children ?? []) : [];
    for (const c of children) {
      if (typeof c === 'string') continue;
      const hit = linkNamed(c, href);
      if (hit) return hit;
    }
    return null;
  };

  const footerWith = (links: Node[]): Node =>
    el('div', '', {
      children: [
        el('main', '', { children: [{ kind: 'outlet' }] }),
        el('footer', '', { children: [el('ul', 'grid', { children: links })] }),
      ],
    });

  it('adds Returns beside Orders, cloning the link so it matches the column', () => {
    const frame = footerWith([
      el('a', 'text-sm', { attrs: { href: '/account' }, text: 'Your account' }),
      el('a', 'text-sm', { attrs: { href: '/account/orders' }, text: 'Orders' }),
    ]);
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(true);
    expect(hrefsOf(root)).toEqual(['/account', '/account/orders', '/account/returns']);
    // Cloned, so it wears the column's styling rather than arriving unstyled.
    const added = linkNamed(root, '/account/returns');
    expect((added as { class?: string })?.class).toBe('text-sm');
  });

  it('adds Returns as a SIBLING list item, never a second link inside one', () => {
    // These footers wrap each link in its own <li>. Pushing the new anchor in beside
    // the old one put two links in one list item, and asking "is Returns already here"
    // about that <li> answered about the wrong scope entirely.
    const frame = footerWith([
      el('li', '', {
        children: [el('a', 'text-sm', { attrs: { href: '/account/orders' }, text: 'Orders' })],
      }),
    ]);
    const { root } = upgradeFrameChrome(frame);
    const list = findByTag(root, 'ul');
    expect((list?.children ?? []).length).toBe(2);
    for (const item of list?.children ?? []) {
      expect(typeof item === 'string' ? 0 : ((item as Element).children ?? []).length).toBe(1);
    }
  });

  it('does not add Returns twice — a footer that already has it is left alone', () => {
    const frame = footerWith([
      el('a', '', { attrs: { href: '/account/orders' }, text: 'Orders' }),
      el('a', '', { attrs: { href: '/account/returns' }, text: 'Returns' }),
    ]);
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(false);
    expect(root).toBe(frame);
  });

  it('does not mutate the input tree', () => {
    // It runs on a tree the studio also holds; mutating in place would edit state the
    // engine believes it owns.
    const frame = legacyFrame();
    const before = JSON.stringify(frame);
    upgradeFrameChrome(frame);
    expect(JSON.stringify(frame)).toBe(before);
  });

  it('survives a frame with no nav at all', () => {
    const frame = el('div', '', { children: [el('main', '', { children: [] })] });
    expect(upgradeFrameChrome(frame).changed).toBe(false);
  });
});

// ─── The legal-links heal ───────────────────────────────────────────────────
//
// The stale shape here isn't merely out of date, it is BROKEN on published sites: the
// starter footer authored `/privacy-policy` and `/terms-of-service` as literal anchors,
// and neither route exists until the tenant creates, acknowledges and publishes those
// pages in Content → Legal pages. Every site built on the starter therefore shipped two
// footer links that 404. Seeding `site.legal-links` fixes the next tenant; this fixes
// the ones already out there.

/** A footer as the starter used to stamp it: a "More" column with Search plus the two
 *  hardcoded legal anchors. */
const legalFrame = (): Node =>
  el('div', '', {
    children: [
      el('nav', '', { children: [hostCore(HOST_KEYS.siteBrand)] }),
      el('main', '', { children: [{ kind: 'outlet' }] }),
      el('footer', '', {
        children: [
          el('div', 'grid', {
            children: [
              el('div', 'flex flex-col gap-3', {
                children: [
                  el('h3', '', { text: 'More' }),
                  el('a', 'text-sm', { attrs: { href: '/search' }, text: 'Search' }),
                  el('a', 'text-sm', { attrs: { href: '/privacy-policy' }, text: 'Privacy' }),
                  el('a', 'text-sm', { attrs: { href: '/terms-of-service' }, text: 'Terms' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

const hrefsOf = (node: Node): string[] => {
  const out: string[] = [];
  const visit = (n: Node | string): void => {
    if (typeof n === 'string' || n.kind !== 'element') return;
    const href = n.attrs?.href;
    if (n.tag === 'a' && typeof href === 'string') out.push(href);
    (n.children ?? []).forEach(visit);
  };
  visit(node);
  return out;
};

const findLegalCore = (node: Node): HostNode | null => {
  if (node.kind === 'host' && node.component === HOST_KEYS.siteLegalLinks) return node;
  const children = node.kind === 'element' ? (node.children ?? []) : [];
  for (const c of children) {
    if (typeof c === 'string') continue;
    const hit = findLegalCore(c);
    if (hit) return hit;
  }
  return null;
};

describe('upgradeFrameChrome — healing hardcoded legal links', () => {
  it('replaces BOTH seeded anchors with a single live legal-links core', () => {
    const { root, changed } = upgradeFrameChrome(legalFrame());
    expect(changed).toBe(true);
    expect(findLegalCore(root)?.component).toBe(HOST_KEYS.siteLegalLinks);
    // The 404s are gone…
    expect(hrefsOf(root)).not.toContain('/privacy-policy');
    expect(hrefsOf(root)).not.toContain('/terms-of-service');
    // …and nothing else in the column moved.
    expect(hrefsOf(root)).toContain('/search');
  });

  it('takes the first anchor’s POSITION, so the links stay where the author put them', () => {
    const { root } = upgradeFrameChrome(legalFrame());
    const column = (
      (
        (
          (root as Extract<Node, { kind: 'element' }>).children![2] as Extract<
            Node,
            { kind: 'element' }
          >
        ).children![0] as Extract<Node, { kind: 'element' }>
      ).children![0] as Extract<Node, { kind: 'element' }>
    ).children!;
    // h3, Search, core — the core sits exactly where Privacy was, not appended at the end
    // and not hoisted into a new column that would overflow the footer grid.
    expect(column).toHaveLength(3);
    expect((column[2] as HostNode).component).toBe(HOST_KEYS.siteLegalLinks);
  });

  it('authors it with NO heading — it is joining a column that already has one', () => {
    // The headed version is for a fresh frame, where the core IS the column.
    expect(findLegalCore(upgradeFrameChrome(legalFrame()).root)?.props).toEqual({ heading: '' });
  });

  it('leaves a legal link the AUTHOR repointed alone', () => {
    // Only the platform's own seeded hrefs are stale. If they aimed "Privacy" at a page
    // of their own, that link works and is their content — rewriting it would be the
    // platform overreaching, and would silently drop a page they chose to link.
    const frame = el('div', '', {
      children: [
        el('nav', '', { children: [hostCore(HOST_KEYS.siteBrand)] }),
        el('footer', '', {
          children: [
            el('a', '', { attrs: { href: '/legal/our-privacy-promise' }, text: 'Privacy' }),
          ],
        }),
      ],
    });
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(false);
    expect(root).toBe(frame);
  });

  it('is idempotent, and never gives a frame two legal cores', () => {
    const once = upgradeFrameChrome(legalFrame());
    const twice = upgradeFrameChrome(once.root);
    expect(twice.changed).toBe(false);
    expect(twice.root).toBe(once.root);
  });

  it('leaves a CURRENT frame untouched — it already seeds the core', () => {
    const frame = starterFrame({ commerceEnabled: true }).root;
    expect(upgradeFrameChrome(frame).changed).toBe(false);
  });

  it('heals a frame that needs BOTH repairs in one pass', () => {
    // A tenant stamped before either fix has both problems, and must not need two visits.
    const frame = el('div', '', {
      children: [
        el('nav', '', {
          children: [bind(atom('Wordmark', 'wordmark', { text: 'Acme' }), 'site.identity.name')],
        }),
        el('footer', '', {
          children: [el('a', '', { attrs: { href: '/privacy-policy' }, text: 'Privacy' })],
        }),
      ],
    });
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(true);
    expect(findBrand(root)?.component).toBe(HOST_KEYS.siteBrand);
    expect(findLegalCore(root)?.component).toBe(HOST_KEYS.siteLegalLinks);
  });

  it('does not mutate the input tree', () => {
    const frame = legalFrame();
    const before = JSON.stringify(frame);
    upgradeFrameChrome(frame);
    expect(JSON.stringify(frame)).toBe(before);
  });
});

describe('upgradeFrameChrome — social links', () => {
  /** Juniper Row's ACTUAL stored footer, read off `builder_layouts` (issue 326): the brand
   *  column is `site.brand` + the blurb + the EMPTY `<ul>` left where `siteFooter` filled
   *  three social slots with null, all of it under `div > [header, main, footer]`.
   *  Written from the row rather than from the factory for the reason issue 296 cost a
   *  whole repair: a fixture shaped the way the code expects proves nothing about the
   *  shape the database holds. */
  const columnsFooter = (socialSlot: Node | null): Node =>
    el('div', 'flex min-h-screen flex-col', {
      children: [
        el('header', '', { children: [el('nav', 'navbar', { children: [] })] }),
        el('main', 'flex-1', { children: [{ kind: 'outlet' }] }),
        el('footer', '@container bg-base-100 border-t border-base-200', {
          children: [
            el('div', 'mx-auto w-full max-w-6xl px-6 py-14', {
              children: [
                el('div', 'grid grid-cols-1 gap-10 @3xl:grid-cols-5', {
                  children: [
                    el('div', 'flex flex-col gap-4 @3xl:col-span-2', {
                      children: [
                        hostCore(HOST_KEYS.siteBrand, 'wordmark', { show: 'both' }),
                        el('p', 'max-w-xs text-sm', { text: 'Cut and sewn in Denver.' }),
                        ...(socialSlot ? [socialSlot] : []),
                      ],
                    }),
                    // The SECOND link column, emptied by the seed — a `<ul>` with nothing
                    // in it that is not the social row and must never be read as one.
                    el('div', 'flex flex-col gap-3', {
                      children: [el('ul', 'flex flex-col gap-2', { children: [] })],
                    }),
                  ],
                }),
                // The copyright row, whose own link trio the seed drops — the other empty
                // `<ul>`, and the one that shares `items-center` with the social row.
                el('div', 'mt-12 flex flex-col gap-4 border-t border-base-200 pt-6', {
                  children: [
                    el('p', 'text-sm', { text: '© Juniper Row' }),
                    el('ul', 'flex flex-wrap items-center gap-x-6 gap-y-2', { children: [] }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

  /** The `newsletter` variant, which reserves its social row in the BOTTOM BAR beside the
   *  copyright rather than beside the brand mark. Forty six shipped designs are shaped
   *  this way, and a rule keyed on "the empty row next to the brand core" could not reach
   *  a single one of them. */
  const newsletterFooter = (): Node =>
    el('div', 'flex min-h-screen flex-col', {
      children: [
        el('main', 'flex-1', { children: [{ kind: 'outlet' }] }),
        el('footer', '@container bg-base-200 border-t border-base-300', {
          children: [
            el('div', 'mx-auto w-full max-w-6xl px-6 py-14', {
              children: [
                el('div', 'grid grid-cols-1 gap-10 @3xl:grid-cols-2', {
                  children: [
                    el('div', 'flex flex-col gap-4', {
                      children: [
                        hostCore(HOST_KEYS.siteBrand, 'wordmark', { show: 'both' }),
                        el('p', 'max-w-sm text-sm', { text: 'Join the list.' }),
                      ],
                    }),
                  ],
                }),
                el('div', 'mt-12 flex flex-col gap-4 border-t border-base-300 pt-6', {
                  children: [
                    el('p', 'text-sm', { text: '© Juniper Row' }),
                    el('ul', 'flex items-center gap-5', { children: [] }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

  /** The golden `sparx` capture and the twenty one designs cloned from it: a footer old
   *  enough to predate the social slots AND the brand core, so its identity column is a
   *  stamped name and blurb with nothing live in it. There is no row to take here — the
   *  question is whether the core still reaches a business on one of these designs. */
  const capturedFooter = (): Node =>
    el('div', 'flex min-h-screen flex-col', {
      children: [
        el('main', 'flex-1', { children: [{ kind: 'outlet' }] }),
        el('footer', '@container border-t border-base-300 bg-base-200 px-6 py-12', {
          children: [
            el('div', 'mx-auto grid max-w-6xl gap-10 @sm:grid-cols-2 @lg:grid-cols-4', {
              children: [
                el('div', 'flex flex-col gap-3', {
                  children: [
                    el('span', 'text-lg font-bold', { text: 'Juniper Row' }),
                    el('p', 'max-w-xs text-sm', { text: 'Cut and sewn in Denver.' }),
                  ],
                }),
                el('div', 'flex flex-col gap-3', {
                  children: [
                    el('h2', 'text-sm font-semibold', { text: 'Explore' }),
                    el('a', 'text-sm', { text: 'Shop' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

  const socialCores = (node: Node): Node[] => {
    const out: Node[] = [];
    const walk = (n: Node): void => {
      if (n.kind === 'host' && n.component === HOST_KEYS.siteSocialLinks) out.push(n);
      const children = n.kind === 'element' ? (n.children ?? []) : [];
      for (const c of children) if (typeof c !== 'string') walk(c);
    };
    walk(node);
    return out;
  };

  const isSocial = (n: Node): boolean =>
    n.kind === 'host' && n.component === HOST_KEYS.siteSocialLinks;

  /** The element the core ended up inside, so a test can say WHERE and not just whether. */
  const socialParent = (node: Node): { class?: string; children?: (Node | string)[] } | null => {
    if (node.kind !== 'element') return null;
    const children = node.children ?? [];
    if (children.some((c) => typeof c !== 'string' && isSocial(c))) return node;
    for (const c of children) {
      if (typeof c === 'string') continue;
      const found = socialParent(c);
      if (found) return found;
    }
    return null;
  };

  it('takes the row the columns footer reserved beside the brand', () => {
    const frame = columnsFooter(el('ul', 'mt-2 flex items-center gap-5', { children: [] }));
    const { root, changed } = upgradeFrameChrome(frame);
    expect(changed).toBe(true);
    expect(socialCores(root)).toHaveLength(1);

    // Third child of the brand column, exactly where the empty `<ul>` sat: after the mark
    // and the blurb.
    const kids = socialParent(root)?.children ?? [];
    expect(kids).toHaveLength(3);
    expect((kids[0] as { component?: string }).component).toBe(HOST_KEYS.siteBrand);
    expect(isSocial(kids[2] as Node)).toBe(true);
  });

  it('takes the row the newsletter footer reserved beside the copyright', () => {
    // The shape a brand-column rule structurally could not reach.
    const { root, changed } = upgradeFrameChrome(newsletterFooter());
    expect(changed).toBe(true);
    expect(socialCores(root)).toHaveLength(1);
    expect(socialParent(root)?.class).toContain('border-t');
  });

  it('does not mistake an emptied link list for the reserved row', () => {
    // Both of the footer's OTHER empty `<ul>`s are in this fixture, and neither is a social
    // row: one is the seed's emptied second link column, the other the dropped copyright
    // link trio — which even shares `items-center` with the real one.
    const { root, changed } = upgradeFrameChrome(columnsFooter(null));
    expect(socialCores(root)).toHaveLength(0);
    expect(changed).toBe(false);
  });

  it('reaches the captured cohort, which never had a row at all', () => {
    // Twenty two shipped designs. Declining here would mean a business on any of them can
    // list her accounts in Site identity and never see them on her own site.
    const { root, changed } = upgradeFrameChrome(capturedFooter());
    expect(changed).toBe(true);
    expect(socialCores(root)).toHaveLength(1);

    // Under the blurb, in the identity column — never in a link column.
    const kids = socialParent(root)?.children ?? [];
    expect(kids).toHaveLength(3);
    expect((kids[0] as { tag?: string }).tag).toBe('span');
    expect(isSocial(kids[2] as Node)).toBe(true);
  });

  it('declines when a live column had the row and the author removed it', () => {
    // The other side of the fixture above: a column carrying the brand CORE is from the era
    // that shipped the row, so its absence is a decision rather than an omission. The
    // captured cohort is told apart by having nothing live in that column at all.
    const { root, changed } = upgradeFrameChrome(columnsFooter(null));
    expect(socialCores(root)).toHaveLength(0);
    expect(changed).toBe(false);
  });

  it('is idempotent — a second pass adds nothing, in either placement', () => {
    const once = upgradeFrameChrome(
      columnsFooter(el('ul', 'mt-2 flex items-center gap-5', { children: [] }))
    );
    const twice = upgradeFrameChrome(once.root);
    expect(twice.changed).toBe(false);
    expect(socialCores(twice.root)).toHaveLength(1);

    const captured = upgradeFrameChrome(capturedFooter());
    const again = upgradeFrameChrome(captured.root);
    expect(again.changed).toBe(false);
    expect(socialCores(again.root)).toHaveLength(1);
  });

  it('gives the core no row class of its own', () => {
    // `SocialLinks` lays the marks out itself, so a second `gap-*` here would be settled by
    // stylesheet order rather than by anything anyone wrote.
    const { root } = upgradeFrameChrome(
      columnsFooter(el('ul', 'mt-2 flex items-center gap-5', { children: [] }))
    );
    const [core] = socialCores(root) as { class?: string }[];
    expect(core?.class).toBe('mt-2');
  });

  it('does not mutate the input tree', () => {
    const frame = columnsFooter(el('ul', 'mt-2 flex items-center gap-5', { children: [] }));
    const before = JSON.stringify(frame);
    upgradeFrameChrome(frame);
    expect(JSON.stringify(frame)).toBe(before);
  });
});
