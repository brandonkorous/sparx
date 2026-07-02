// The NavMenu quick-editor's node ⇄ rows transforms (docs/57 rebuild). A NavMenu is
// a CONTAINER of NavItem children; the editor reads those into flat editable rows
// and writes them back as a fresh child list. These lock the round-trip: existing
// node identity (id/class/name) survives, new rows mint ids, the legacy flat-links
// prop is dropped, and empty rows are pruned.

import { describe, expect, it } from 'vitest';
import type { BuilderNode } from './model';
import { applyRows, newRow, readRows, reorder } from './nav-menu-editor-model';

function navItem(id: string, label: string, href: string, children?: BuilderNode[]): BuilderNode {
  const node: BuilderNode = { id, type: 'NavItem', props: { label, href } };
  if (children) node.children = children;
  return node;
}

function navMenu(children: BuilderNode[], extraProps: Record<string, unknown> = {}): BuilderNode {
  return { id: 'menu-1', type: 'NavMenu', props: { orientation: 'row', ...extraProps }, children };
}

describe('readRows', () => {
  it('reads NavItem children (with one dropdown) into rows', () => {
    const menu = navMenu([
      navItem('a', 'Home', '/'),
      navItem('b', 'Shop', '', [navItem('b1', 'New', '/new'), navItem('b2', 'Sale', '/sale')]),
    ]);
    const rows = readRows(menu);
    expect(rows.map((r) => r.label)).toEqual(['Home', 'Shop']);
    expect(rows[0]!.id).toBe('a');
    expect(rows[1]!.children.map((c) => c.href)).toEqual(['/new', '/sale']);
  });

  it('seeds rows from a not-yet-migrated NavMenu (legacy props.links)', () => {
    const menu: BuilderNode = {
      id: 'menu-1',
      type: 'NavMenu',
      props: {
        orientation: 'row',
        links: [
          { label: 'Work', href: '/work', openInNewTab: true },
          { label: 'About', href: '/about' },
        ],
      },
    };
    const rows = readRows(menu);
    expect(rows.map((r) => r.label)).toEqual(['Work', 'About']);
    expect(rows[0]!.href).toBe('/work');
    expect(rows[0]!.openInNewTab).toBe(true);
    // Seeded rows get freshly-minted ids (not present on the legacy prop).
    expect(rows[0]!.id).toMatch(/^navitem-/);
  });
});

describe('applyRows', () => {
  it('rebuilds NavItem children, preserving existing id/class and minting new ids', () => {
    const existing = navMenu([{ ...navItem('a', 'Home', '/'), class: 'font-bold' }]);
    const rows = readRows(existing);
    rows[0]!.label = 'Start';
    rows.push({
      id: newRow(false).id,
      label: 'Blog',
      href: '/blog',
      openInNewTab: false,
      children: [],
    });

    const next = applyRows(existing, rows);
    expect(next.type).toBe('NavMenu');
    expect(next.children).toHaveLength(2);
    // Existing node keeps its id + class; its label prop is updated.
    expect(next.children![0]!.id).toBe('a');
    expect(next.children![0]!.class).toBe('font-bold');
    expect(next.children![0]!.props.label).toBe('Start');
    // The added row is a NavItem carrying the new href.
    expect(next.children![1]!.type).toBe('NavItem');
    expect(next.children![1]!.props.href).toBe('/blog');
  });

  it('clears the legacy links prop on the menu AND drops empty-label rows', () => {
    const legacy: BuilderNode = {
      id: 'menu-1',
      type: 'NavMenu',
      props: { orientation: 'row', links: [{ label: 'X', href: '/x' }] },
    };
    const rows = readRows(legacy);
    rows.push({ id: 'blank', label: '   ', href: '/', openInNewTab: false, children: [] });

    const next = applyRows(legacy, rows);
    expect(next.props.links).toBeUndefined();
    // The blank-label row is pruned; only the real link survives.
    expect(next.children).toHaveLength(1);
    expect(next.children![0]!.props.label).toBe('X');
    expect(next.children![0]!.props.links).toBeUndefined();
  });

  it('drops href for a childless row that has none, and nests dropdown items', () => {
    const menu = navMenu([]);
    const next = applyRows(menu, [
      {
        id: 'd',
        label: 'More',
        href: '',
        openInNewTab: false,
        children: [newRowLike('More · A', '/a')],
      },
    ]);
    const dropdown = next.children![0]!;
    expect(dropdown.props.href).toBeUndefined();
    expect(dropdown.children).toHaveLength(1);
    expect(dropdown.children![0]!.props.href).toBe('/a');
  });
});

describe('round-trip', () => {
  it('read → apply preserves labels, hrefs, structure, and existing ids', () => {
    const menu = navMenu([
      navItem('a', 'Home', '/'),
      navItem('b', 'Shop', '/shop', [navItem('b1', 'New', '/new')]),
    ]);
    const next = applyRows(menu, readRows(menu));
    expect(next.children!.map((c) => c.id)).toEqual(['a', 'b']);
    expect(next.children![1]!.children![0]!.props).toMatchObject({ label: 'New', href: '/new' });
  });
});

describe('reorder', () => {
  const rows = [newRowLike('A', '/a'), newRowLike('B', '/b'), newRowLike('C', '/c')];
  it('swaps a row with its neighbour', () => {
    expect(reorder(rows, 0, 1).map((r) => r.label)).toEqual(['B', 'A', 'C']);
    expect(reorder(rows, 2, -1).map((r) => r.label)).toEqual(['A', 'C', 'B']);
  });
  it('no-ops past either end', () => {
    expect(reorder(rows, 0, -1)).toBe(rows);
    expect(reorder(rows, 2, 1)).toBe(rows);
  });
});

function newRowLike(label: string, href: string) {
  return { id: `row-${label}`, label, href, openInNewTab: false, children: [] };
}
