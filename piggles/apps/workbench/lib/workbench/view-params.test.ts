// A pane's tab lives in its address (persona issue 374).
//
// A product has seven tabs, and the tab was `useState` and nothing else: a
// reload, a copied link and a restored layout all came back on Overview, and a
// link naming a tab opened a SECOND pane on a product already open on another.
// Tabs are now declared view params: in the address and the saved layout, left
// out of what makes two panes the same pane.
//
//   1. A tab change re-addresses the pane: the params carry it, the default
//      tab removes it, and a change to nothing emits nothing.
//   2. Opening the same record again focuses the open pane and moves it to the
//      tab asked for. Opening it with no tab leaves the tab alone.
//   3. A different record is still a different pane.
//   4. A surface may only change params it declared. The rest are what the
//      pane IS, and a pane does not turn itself into another record.
//
// Surfaces are registered by this file, as pane-title.test.ts does, so the
// rule is tested rather than the catalog.

import { beforeEach, describe, expect, it } from 'vitest';

import { paneIdentityKey, registerSurface, type SurfaceDefinition } from '../surfaces/registry';
import { WorkbenchController } from './controller';
import type { PaneDescriptor } from '../surfaces/descriptor';
import type { PaneHost } from './pane-host';

const RECORD = 'test.view.record';
const PLAIN = 'test.view.plain';

registerSurface({
  key: RECORD,
  title: 'Product',
  module: 'platform',
  icon: null,
  component: () => null,
  viewParams: ['tab'],
} as unknown as SurfaceDefinition);
registerSurface({
  key: PLAIN,
  title: 'Order',
  module: 'platform',
  icon: null,
  component: () => null,
} as unknown as SurfaceDefinition);

function fakeHost(): PaneHost & { panes: Set<string>; focused: string[] } {
  const panes = new Set<string>();
  const focused: string[] = [];
  return {
    panes,
    focused,
    has: (paneId) => panes.has(paneId),
    add: (descriptor: PaneDescriptor) => void panes.add(descriptor.id),
    close: (paneId) => void panes.delete(paneId),
    focus: (paneId) => void focused.push(paneId),
    setTitle: () => undefined,
    retarget: () => undefined,
    serialize: () => null,
    capabilities: { split: true, popout: false },
  };
}

let controller: WorkbenchController;
let host: ReturnType<typeof fakeHost>;
let emits: number;

beforeEach(() => {
  controller = new WorkbenchController();
  host = fakeHost();
  controller.attach(host);
  emits = 0;
  controller.subscribe(() => {
    emits += 1;
  });
});

const params = (paneId: string) => controller.getDescriptor(paneId)?.params;

describe('a tab change', () => {
  it('re-addresses the pane, and the default tab clears it', () => {
    const pane = controller.open(RECORD, { id: 'p1' })!;
    controller.setViewParams(pane, { tab: 'pricing' });
    expect(params(pane)).toEqual({ id: 'p1', tab: 'pricing' });
    controller.setViewParams(pane, { tab: null });
    expect(params(pane)).toEqual({ id: 'p1' });
  });

  it('emits nothing when nothing changed', () => {
    const pane = controller.open(RECORD, { id: 'p1', tab: 'seo' })!;
    emits = 0;
    controller.setViewParams(pane, { tab: 'seo' });
    expect(emits).toBe(0);
  });
});

describe('opening a record that is already open', () => {
  it('focuses that pane and moves it to the tab asked for', () => {
    const pane = controller.open(RECORD, { id: 'p1', tab: 'pricing' })!;
    const again = controller.open(RECORD, { id: 'p1', tab: 'seo' });
    expect(again).toBe(pane);
    expect(host.panes.size).toBe(1);
    expect(params(pane)).toEqual({ id: 'p1', tab: 'seo' });
  });

  it('leaves the tab alone when no tab was asked for', () => {
    const pane = controller.open(RECORD, { id: 'p1', tab: 'pricing' })!;
    expect(controller.open(RECORD, { id: 'p1' })).toBe(pane);
    expect(params(pane)).toEqual({ id: 'p1', tab: 'pricing' });
  });

  it('opens a different record as a different pane', () => {
    controller.open(RECORD, { id: 'p1', tab: 'pricing' });
    controller.open(RECORD, { id: 'p2', tab: 'pricing' });
    expect(host.panes.size).toBe(2);
  });

  it('treats every param of a surface with no view params as identity', () => {
    controller.open(PLAIN, { id: 'o1', tab: 'a' });
    controller.open(PLAIN, { id: 'o1', tab: 'b' });
    expect(host.panes.size).toBe(2);
  });
});

describe('what a surface may change', () => {
  it('refuses a param it did not declare', () => {
    const pane = controller.open(RECORD, { id: 'p1' })!;
    expect(() => controller.setViewParams(pane, { id: 'p2' })).toThrow(/not a view param/);
    expect(params(pane)).toEqual({ id: 'p1' });
  });

  it('keys identity without the view params', () => {
    const a = { id: 'x', surface: RECORD, params: { id: 'p1', tab: 'seo' } };
    const b = { id: 'y', surface: RECORD, params: { id: 'p1' } };
    expect(paneIdentityKey(a)).toBe(paneIdentityKey(b));
  });
});
