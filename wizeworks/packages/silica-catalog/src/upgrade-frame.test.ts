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
