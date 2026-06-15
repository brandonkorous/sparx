// Per-zone routing guard for the unified studio (docs/builder/03 §6). The studio's
// data-loss-class safety — a layout edit and a page edit never stomp each other —
// rests on (a) resolving a node's zone from which tree owns it, and (b) rejecting
// any reorder that crosses the Outlet boundary. These are the pure decisions; the
// hook layers the per-zone debounced save on top, so getting these right is what
// keeps a save from ever landing in the wrong store.

import { describe, expect, it } from 'vitest';
import type { BuilderNode } from './model';
import { findOutletId, studioMoveZone, studioZoneOf } from './studio-routing';

function n(id: string, type = 'Section', children?: BuilderNode[]): BuilderNode {
  return { id, type, props: {}, ...(children ? { children } : {}) };
}

// Site layout (chrome): root › Header[Logo, NavMenu] · Outlet · Footer[SocialLinks].
const layout = n('layout-root', 'Section', [
  n('header', 'Section', [n('logo', 'Logo'), n('nav', 'NavMenu')]),
  n('outlet', 'Outlet'),
  n('footer', 'Section', [n('social', 'SocialLinks')]),
]);
// Active page: root › Hero[Heading] · Grid.
const page = n('page-root', 'Section', [
  n('hero', 'Section', [n('headline', 'Heading')]),
  n('grid', 'Grid'),
]);

describe('studioZoneOf — zone is derived from tree membership, not stored', () => {
  it('resolves layout-owned nodes (incl. the Outlet + root) to layout', () => {
    expect(studioZoneOf(layout, page, 'header')).toBe('layout');
    expect(studioZoneOf(layout, page, 'logo')).toBe('layout');
    expect(studioZoneOf(layout, page, 'outlet')).toBe('layout');
    expect(studioZoneOf(layout, page, 'layout-root')).toBe('layout');
  });
  it('resolves page-owned nodes (incl. the page root) to page', () => {
    expect(studioZoneOf(layout, page, 'hero')).toBe('page');
    expect(studioZoneOf(layout, page, 'headline')).toBe('page');
    expect(studioZoneOf(layout, page, 'page-root')).toBe('page');
  });
  it('returns null for an unknown id (vanished mid-drag)', () => {
    expect(studioZoneOf(layout, page, 'ghost')).toBeNull();
  });
  it('handles a missing page tree (nothing in the Outlet yet)', () => {
    expect(studioZoneOf(layout, null, 'header')).toBe('layout');
    expect(studioZoneOf(layout, null, 'hero')).toBeNull();
  });
});

describe('studioMoveZone — reorders stay within one zone (the data-loss firewall)', () => {
  it('allows a within-layout reorder', () => {
    expect(studioMoveZone(layout, page, 'logo', 'footer')).toBe('layout');
  });
  it('allows a within-page reorder', () => {
    expect(studioMoveZone(layout, page, 'headline', 'grid')).toBe('page');
  });
  it('REJECTS a page node dropped under a layout parent (would mis-route the save)', () => {
    expect(studioMoveZone(layout, page, 'hero', 'header')).toBeNull();
  });
  it('REJECTS a layout node dropped under a page parent', () => {
    expect(studioMoveZone(layout, page, 'header', 'grid')).toBeNull();
  });
  it('rejects an unknown drag or an unknown parent', () => {
    expect(studioMoveZone(layout, page, 'ghost', 'footer')).toBeNull();
    expect(studioMoveZone(layout, page, 'logo', 'ghost')).toBeNull();
  });
});

describe('findOutletId — where the page grafts into the composed tree', () => {
  it('finds the Outlet node in the layout', () => {
    expect(findOutletId(layout)).toBe('outlet');
  });
  it('returns null when a tree has no Outlet (the page tree)', () => {
    expect(findOutletId(page)).toBeNull();
  });
});
