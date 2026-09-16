// What a pane's tab is called, and who gets to decide.
//
// Two things name a tab and only one of them may name a SCREEN. The catalog
// title, read through `resolveTitle`, is the screen's name — one entry names it
// in the rail, the launcher, the command palette, the pane's tab and the status
// bar at once. `ctx.setTitle` names the RECORD in the pane, and it outranks the
// catalog because "INV-000004" has to beat "Invoice".
//
// Fifty-two surfaces handed their OWN catalog name to `setTitle` from a mount
// effect, which is the second thing outranking the first for no gain. Most
// restated a name nobody had changed, so they were not lies — only lies in
// waiting: the moment the catalog entry is edited, the constant wins silently
// and the tab is the one place the new name never reaches. Two were already
// wrong. The cart pane was titled from both places at once, and the page-check
// pane set the constant "Page check" on every check it opened, so three open
// checks were three identical tabs and the only way to tell them apart was to
// click each one.
//
// The tab is also PERSISTED, which is what makes this stick: the frozen word
// goes into the saved layout and comes back on every reload. So there are two
// rules, and both are tested here — `setTitle` CLEARS an own-name instead of
// storing it, and `hydrate` sweeps one out of a layout that was saved before
// either rule existed. The sweep is not optional cleanup: the effects that used
// to hand the stale word back on mount are gone, so nothing else would remove it.
//
// The surfaces here are REGISTERED BY THIS FILE rather than taken from the real
// catalog, for the same reason the deep-link gate test does it: the rule is the
// subject, and importing three hundred React surfaces to ask a question about
// two strings would test the catalog instead.

import { beforeEach, describe, expect, it } from 'vitest';

import { isOwnStaticTitle, registerSurface, type SurfaceDefinition } from '../surfaces/registry';
import { WorkbenchController } from './controller';
import type { PaneDescriptor } from '../surfaces/descriptor';
import type { PaneHost } from './pane-host';

const stub = (key: string, title: SurfaceDefinition['title']): SurfaceDefinition =>
  ({
    key,
    title,
    module: 'platform',
    icon: null,
    component: () => null,
  }) as unknown as SurfaceDefinition;

/** A screen with a fixed name. Nothing in it is a record, so nothing may rename it. */
const SCREEN = 'test.title.screen';
/** A record pane. Its name is the record's, and arrives late. */
const RECORD = 'test.title.record';

registerSurface(stub(SCREEN, 'Page check'));
registerSurface(stub(RECORD, (params) => (params.id ? 'Invoice' : 'New invoice')));

/** Records what the host was last told to show, which is what a person reads. */
function fakeHost(): PaneHost & { tabs: Map<string, string> } {
  const tabs = new Map<string, string>();
  return {
    tabs,
    has: (paneId) => tabs.has(paneId),
    add: (descriptor: PaneDescriptor, title: string) => tabs.set(descriptor.id, title),
    close: (paneId) => void tabs.delete(paneId),
    focus: () => undefined,
    setTitle: (paneId, title) => void tabs.set(paneId, title),
    retarget: (paneId, title) => void tabs.set(paneId, title),
    serialize: () => null,
    capabilities: { split: true, popout: false },
  };
}

let controller: WorkbenchController;
let host: ReturnType<typeof fakeHost>;

beforeEach(() => {
  controller = new WorkbenchController();
  host = fakeHost();
  controller.attach(host);
});

describe('a surface handing back its own name', () => {
  it('leaves the tab answering to the catalog, so a rename reaches it', () => {
    const paneId = controller.open(SCREEN);
    expect(paneId).not.toBeNull();

    // Exactly what the page-check pane did on mount.
    controller.setTitle(paneId!, 'Page check');

    // Nothing stored means the registry answers, so editing the catalog entry
    // renames this tab. A stored own-name would freeze it forever.
    expect(controller.getDescriptor(paneId!)?.title).toBeUndefined();
  });

  it('drops a stale name a saved layout is still carrying', () => {
    // A layout saved while the surfaces still named themselves: the old word is
    // in localStorage, and no surface hands it back any more — those effects are
    // gone. Without a sweep here, a saved arrangement would go on showing the
    // frozen word and no rename would ever reach it.
    const stale: PaneDescriptor = { id: 'p_old', surface: SCREEN, title: 'Page check' };
    controller.hydrate({ p_old: stale });

    expect(controller.getDescriptor('p_old')?.title).toBeUndefined();
  });

  it('leaves a record name in a saved layout alone', () => {
    // The reason the sweep is not "drop every saved title": a record pane's
    // saved name is what stops the tab flashing "Invoice" on every restore.
    const saved: PaneDescriptor = { id: 'p_inv', surface: RECORD, title: 'INV-000004' };
    controller.hydrate({ p_inv: saved });

    expect(controller.getDescriptor('p_inv')?.title).toBe('INV-000004');
  });
});

describe('a surface naming the record it is showing', () => {
  it('keeps the record name, which is the whole point of setTitle', () => {
    const paneId = controller.open(RECORD, { id: '4' });
    controller.setTitle(paneId!, 'INV-000004');

    expect(controller.getDescriptor(paneId!)?.title).toBe('INV-000004');
    expect(host.tabs.get(paneId!)).toBe('INV-000004');
  });

  it('keeps a record whose name happens to match the create-case wording', () => {
    // A function title is never an own-name: it exists to name a record, so
    // there is no static string for it to collide with. A tenant who names a
    // draft "New invoice" still gets their own words on the tab.
    const paneId = controller.open(RECORD);
    controller.setTitle(paneId!, 'New invoice');

    expect(controller.getDescriptor(paneId!)?.title).toBe('New invoice');
  });
});

describe('the rule itself', () => {
  it('recognises the surface own name', () => {
    expect(isOwnStaticTitle(SCREEN, 'Page check')).toBe(true);
  });

  it('does not touch a record name', () => {
    // What the page-check pane sets now: the page it scored, then the qualifier.
    expect(isOwnStaticTitle(SCREEN, 'About us · page check')).toBe(false);
  });

  it('never claims an own name for a surface that names records', () => {
    expect(isOwnStaticTitle(RECORD, 'New invoice')).toBe(false);
  });

  it('says nothing about a surface it has never heard of', () => {
    // An unknown key must not be read as "own name and therefore droppable" —
    // that would silently discard the title of any pane this console does not
    // define, which is how a deep link from another build loses its tab name.
    expect(isOwnStaticTitle('test.title.not-registered', 'Anything')).toBe(false);
  });
});
