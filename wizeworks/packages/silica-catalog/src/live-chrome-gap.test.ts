import { describe, expect, it } from 'vitest';
import { atom, el } from '@wizeworks/silicaui-html';
import type { Node } from '@wizeworks/silicaui-html';

import { HOST_KEYS, hostCore } from './host-nodes';
import { liveChromeGaps } from './live-chrome-gap';

/** A frame in the real shape: a wrapper holding a `<nav>` and a `<footer>`. */
const frame = (...children: Node[]): Node => el('div', 'site', { children });

const nav = (...children: Node[]): Node => el('nav', 'navbar', { children });

const cores = (gaps: { core: string }[]) => gaps.map((g) => g.core);

describe('what the live site is missing', () => {
  it('says nothing about a site that has never been published', () => {
    // "Your website has never been published" is the sentence that matters there, and
    // four gap lines beside it would bury it.
    expect(liveChromeGaps(frame(nav(hostCore(HOST_KEYS.siteAccountLink))), null)).toEqual([]);
  });

  it('says nothing when the live site already has everything', () => {
    const live = frame(nav(hostCore(HOST_KEYS.siteAccountLink)));
    expect(liveChromeGaps(live, live)).toEqual([]);
  });

  it('reports a core the author has saved but not published', () => {
    // She opened the builder, the repair ran on her draft, and it is waiting.
    const gaps = liveChromeGaps(
      frame(nav(hostCore(HOST_KEYS.siteAccountLink))),
      frame(nav(el('a', '', { attrs: { href: '/account/login' }, text: 'Sign in' })))
    );
    expect(cores(gaps)).toEqual([HOST_KEYS.siteAccountLink]);
  });

  it('reports it for an owner who has NEVER opened the builder', () => {
    // The case that matters most and the one a draft-versus-published diff cannot see:
    // both trees are the same, and both are stale. Asking what the repair WOULD add is
    // what finds it (issue 313).
    const stale = frame(nav(el('a', '', { attrs: { href: '/account/login' }, text: 'Sign in' })));
    expect(cores(liveChromeGaps(stale, stale))).toEqual([HOST_KEYS.siteAccountLink]);
  });

  it('does not nag about a control the author deliberately removed', () => {
    // She took the sign-in link out of her header and published that. There is no node
    // left for the repair to rewrite, so nothing is claimed missing — the repair only
    // ever swaps what is already there, it never invents a control.
    const bare = frame(nav(el('span', '', { text: 'Row & Co' })));
    expect(liveChromeGaps(bare, bare)).toEqual([]);
  });

  it('marks a gap her saved copy already has as one a PUBLISH resolves', () => {
    const gaps = liveChromeGaps(
      frame(nav(hostCore(HOST_KEYS.siteAccountLink))),
      frame(nav(el('a', '', { attrs: { href: '/account/login' }, text: 'Sign in' })))
    );
    expect(gaps[0]?.source).toBe('saved');
  });

  it('marks a gap only the repair supplies as one a publish CANNOT resolve', () => {
    // Both trees are the same and both are stale, so there is nothing to publish and the
    // Publish button is disabled. Calling this 'saved' is what sent an owner to a control
    // she could not press (issue 315).
    const stale = frame(nav(el('a', '', { attrs: { href: '/account/login' }, text: 'Sign in' })));
    expect(liveChromeGaps(stale, stale)[0]?.source).toBe('waiting');
  });

  it('prefers the shorter road when a gap is both', () => {
    // Her draft has the core AND the repair would add it to the published tree. A publish
    // genuinely puts it live, so she is not sent through the header editor first.
    const gaps = liveChromeGaps(
      frame(nav(hostCore(HOST_KEYS.siteAccountLink))),
      frame(nav(el('a', '', { attrs: { href: '/account/login' }, text: 'Sign in' })))
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.source).toBe('saved');
  });

  it('carries a sentence about the VISITOR, not about the tree', () => {
    const [gap] = liveChromeGaps(
      frame(nav(hostCore(HOST_KEYS.siteAccountLink))),
      frame(nav(el('span', '', { text: 'Row & Co' })))
    );
    expect(gap?.says).toContain('customers');
    expect(gap?.says).not.toContain('site.account-link');
  });

  it('finds a phone-panel sign-in too, whatever node kind it is in', () => {
    // The bar's copy is an <a> and the panel's is a Button component whose href lives
    // in props. A site missing only the second is still a site a phone cannot use.
    const stale = frame(nav(atom('Button', 'btn', { href: '/account/login', label: 'Sign in' })));
    expect(cores(liveChromeGaps(stale, stale))).toEqual([HOST_KEYS.siteAccountLink]);
  });
});
