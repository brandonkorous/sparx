// The stale-frame heal. These tests are mostly about what it must NOT touch: it rewrites
// a tenant's stored draft, so the blast radius is the thing under test.

import { describe, expect, it } from 'vitest';
import { atom, bind, el } from '@wizeworks/silicaui-html';
import type { Node } from '@wizeworks/silicaui-html';

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

const findBrand = (node: Node): Node | null => {
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
