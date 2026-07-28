import { describe, it, expect } from 'vitest';
import type { Op } from '@wizeworks/silicaui-builder/react';

import { invertOps } from './silica-op-invert';
import type { SilicaNode, SilicaSite, SilicaTheme } from './site-sync';

// The property under test throughout: an inverse is TARGETED. It names the one node
// the action touched and restores the one value it changed — which is what lets undo
// stay alive while someone else is editing, instead of restoring a whole-site
// snapshot that would delete their work along the way.

const THEME: SilicaTheme = { name: 'sparx', tokens: { '--color-primary': '#e04631' } };

const PAGE_TARGET = { scope: 'page', id: 'page-home' } as const;
const SITE_TARGET = { scope: 'site' } as const;

function el(
  id: string,
  tag: string,
  extra: Record<string, unknown> = {},
  children: unknown[] = []
): SilicaNode {
  return { kind: 'element', id, tag, ord: `a${id}`, ...extra, children } as SilicaNode;
}

/** home: <section id=root> <h1 id=title class="text-4xl"> · <p id=copy> · <Button id=cta> */
function siteFixture(): SilicaSite {
  return {
    version: '1.0.0',
    theme: THEME,
    pages: [
      {
        id: 'page-home',
        name: 'Home',
        slug: '/',
        root: el('root', 'section', {}, [
          el('title', 'h1', { class: 'text-4xl' }, ['Original heading']),
          el('copy', 'p', {}, [
            'Call ',
            el('link', 'a', { attrs: { href: '/contact' } }, ['us']),
            ' today',
          ]),
          {
            kind: 'component',
            id: 'cta',
            component: 'Button',
            ord: 'acta',
            props: { label: 'Shop now', color: 'primary' },
          },
        ]),
      },
      { id: 'page-about', name: 'About', slug: '/about', root: el('about-root', 'section') },
    ],
  };
}

describe('invertOps — the scalar node edits', () => {
  it('restores the previous class, naming only the node that changed', () => {
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'title', class: 'text-sm' },
    ]);
    expect(inverse).toEqual([
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'title', class: 'text-4xl' },
    ]);
  });

  it('clears a class the action introduced (null, not an empty string)', () => {
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'copy', class: 'italic' },
    ]);
    expect(inverse).toEqual([
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'copy', class: null },
    ]);
  });

  it('restores a component prop, and DELETES one the action introduced', () => {
    const inverse = invertOps(siteFixture(), [
      {
        target: PAGE_TARGET,
        kind: 'node.setProps',
        nodeId: 'cta',
        patch: { label: 'Buy', size: 'lg' },
      },
    ]);
    expect(inverse).toEqual([
      {
        target: PAGE_TARGET,
        kind: 'node.setProps',
        nodeId: 'cta',
        // `size` did not exist before, so undo must remove it — not set it to
        // undefined, which JSON drops and the engine would never see.
        patch: { label: 'Shop now', size: null },
      },
    ]);
  });
});

describe('invertOps — text, where a scalar inverse would be lossy', () => {
  it('inverts a component text edit as a patch on the key the engine wrote', () => {
    // The engine writes `label` when that key exists and `text` otherwise; the
    // inverse is decided from the same prior props, so the two always agree.
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.setText', nodeId: 'cta', text: 'Buy' },
    ]);
    expect(inverse).toEqual([
      {
        target: PAGE_TARGET,
        kind: 'node.setProps',
        nodeId: 'cta',
        patch: { label: 'Shop now' },
      },
    ]);
  });

  it('inverts a plain-string element as a text edit', () => {
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.setText', nodeId: 'title', text: 'New heading' },
    ]);
    expect(inverse).toEqual([
      { target: PAGE_TARGET, kind: 'node.setText', nodeId: 'title', text: 'Original heading' },
    ]);
  });

  it('re-inserts the node when its children were richer than one string', () => {
    // `node.setText` flattens `<p>Call <a>us</a> today</p>` to one sentence. No
    // setText can put the link back, so the inverse restores the subtree itself.
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.setText', nodeId: 'copy', text: 'Call us today' },
    ]);
    expect(inverse).toHaveLength(2);
    expect(inverse?.[0]).toEqual({
      target: PAGE_TARGET,
      kind: 'node.remove',
      nodeId: 'copy',
    });
    const insert = inverse?.[1] as Extract<Op, { kind: 'node.insert' }>;
    expect(insert.kind).toBe('node.insert');
    expect(insert.parentId).toBe('root');
    expect(insert.ord).toBe('acopy');
    expect(insert.node).toMatchObject({ id: 'copy', tag: 'p' });
    // The link survives — that is the whole reason this case exists.
    expect(JSON.stringify(insert.node)).toContain('/contact');
  });
});

describe('invertOps — structure', () => {
  it('inverts a removal into an insert that restores the POSITION, not just the node', () => {
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.remove', nodeId: 'cta' },
    ]);
    const insert = inverse?.[0] as Extract<Op, { kind: 'node.insert' }>;
    expect(insert.kind).toBe('node.insert');
    expect(insert.parentId).toBe('root');
    expect(insert.ord).toBe('acta');
    expect(insert.node).toMatchObject({ id: 'cta', component: 'Button' });
  });

  it('inverts an insert into a removal of exactly that node', () => {
    const inverse = invertOps(siteFixture(), [
      {
        target: PAGE_TARGET,
        kind: 'node.insert',
        parentId: 'root',
        ord: 'z',
        node: el('fresh', 'div'),
      },
    ]);
    expect(inverse).toEqual([{ target: PAGE_TARGET, kind: 'node.remove', nodeId: 'fresh' }]);
  });

  it('inverts a move back to the parent and ordering key it came from', () => {
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.move', nodeId: 'cta', parentId: 'copy', ord: 'm' },
    ]);
    expect(inverse).toEqual([
      { target: PAGE_TARGET, kind: 'node.move', nodeId: 'cta', parentId: 'root', ord: 'acta' },
    ]);
  });

  it('undoes a multi-op action in reverse, and skips nodes the action itself created', () => {
    // "Wrap in a container, then style it" — one action, two ops. Undoing the
    // styling first would be describing a node that is about to stop existing, and
    // its prior class does not exist in `before` to read. So the whole action
    // collapses to removing what it added.
    const inverse = invertOps(siteFixture(), [
      {
        target: PAGE_TARGET,
        kind: 'node.insert',
        parentId: 'root',
        ord: 'w',
        node: el('wrap', 'div', {}, [el('wrap-inner', 'span')]),
      },
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'wrap', class: 'p-8' },
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'wrap-inner', class: 'block' },
    ]);
    expect(inverse).toEqual([{ target: PAGE_TARGET, kind: 'node.remove', nodeId: 'wrap' }]);
  });
});

describe('invertOps — pages and the theme', () => {
  it('restores a deleted page AND the roster position it held', () => {
    // `page.create` appends, so the page alone would come back last in the switcher.
    const inverse = invertOps(siteFixture(), [
      { target: SITE_TARGET, kind: 'page.delete', pageId: 'page-home' },
    ]);
    expect(inverse).toHaveLength(2);
    expect(inverse?.[0]).toMatchObject({ kind: 'page.create', page: { id: 'page-home' } });
    expect(inverse?.[1]).toEqual({
      target: SITE_TARGET,
      kind: 'page.reorder',
      pageIds: ['page-home', 'page-about'],
    });
  });

  it('restores a renamed page', () => {
    const inverse = invertOps(siteFixture(), [
      { target: SITE_TARGET, kind: 'page.rename', pageId: 'page-about', name: 'Our story' },
    ]);
    expect(inverse).toEqual([
      { target: SITE_TARGET, kind: 'page.rename', pageId: 'page-about', name: 'About' },
    ]);
  });

  it('restores the previous theme', () => {
    const inverse = invertOps(siteFixture(), [
      { target: SITE_TARGET, kind: 'theme.set', theme: { name: 'other', tokens: {} } },
    ]);
    expect(inverse).toEqual([{ target: SITE_TARGET, kind: 'theme.set', theme: THEME }]);
  });

  it('clones what it carries out, so the caller cannot mutate their own snapshot', () => {
    const before = siteFixture();
    const inverse = invertOps(before, [
      { target: SITE_TARGET, kind: 'theme.set', theme: { name: 'other', tokens: {} } },
    ]);
    const restored = (inverse?.[0] as Extract<Op, { kind: 'theme.set' }>).theme;
    expect(restored).not.toBe(before.theme);
    restored.tokens['--color-primary'] = 'tampered';
    expect(before.theme.tokens['--color-primary']).toBe('#e04631');
  });
});

describe('invertOps — refusing rather than guessing', () => {
  it('refuses the WHOLE batch when one op is not invertible', () => {
    // Undoing the creation of a saved component means deleting the master AND
    // detaching every instance — a cascade whose node ids silica mints itself.
    // Inventing them here would leave two clients with documents that look
    // identical and no longer merge, so this returns null and the host drops its
    // history rather than offering an undo that corrupts the site.
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'title', class: 'text-sm' },
      {
        target: SITE_TARGET,
        kind: 'symbol.set',
        symbol: { id: 'sym-new', name: 'Hero', root: el('sym-root', 'section') },
      },
    ]);
    expect(inverse).toBeNull();
  });

  it('inverts an EDIT to an existing symbol master, which is not the same thing', () => {
    const before = siteFixture();
    before.symbols = { 'sym-1': { id: 'sym-1', name: 'Hero', root: el('sym-root', 'section') } };
    const inverse = invertOps(before, [
      {
        target: SITE_TARGET,
        kind: 'symbol.set',
        symbol: { id: 'sym-1', name: 'Hero v2', root: el('sym-root', 'div') },
      },
    ]);
    expect(inverse).toMatchObject([{ kind: 'symbol.set', symbol: { name: 'Hero' } }]);
  });

  it('refuses when the op names a node that is not in the snapshot', () => {
    // The document has drifted from what the caller thinks it held. Guessing a
    // prior value there would write a document nobody authored.
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'ghost', class: 'x' },
    ]);
    expect(inverse).toBeNull();
  });

  it('refuses when the op names a page that is not in the snapshot', () => {
    const inverse = invertOps(siteFixture(), [
      { target: SITE_TARGET, kind: 'page.rename', pageId: 'ghost', name: 'x' },
    ]);
    expect(inverse).toBeNull();
  });
});

describe('invertOps — the co-editing property', () => {
  it('touches nothing outside the node the action edited', () => {
    // The regression this whole module exists to prevent: silica's built-in undo is
    // a whole-site snapshot restore, so undoing a heading tweak would also revert a
    // co-editor's paragraph on a page the author never opened.
    const inverse = invertOps(siteFixture(), [
      { target: PAGE_TARGET, kind: 'node.setClass', nodeId: 'title', class: 'text-sm' },
      { target: PAGE_TARGET, kind: 'node.setText', nodeId: 'title', text: 'Hi' },
    ]);
    expect(inverse).not.toBeNull();
    for (const op of inverse ?? []) {
      expect(op.kind).not.toBe('site.replace');
      expect(op).toMatchObject({ nodeId: 'title' });
    }
  });
});
