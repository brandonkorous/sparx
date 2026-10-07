// Two people on one computer keep their own workbench (sparx persona issue 123).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

const { personalKey, setStorageOwner } = await import('./storage-owner');
const { loadLayout, saveLayout } = await import('./persistence');
const { readListView, writeListView } = await import('../view-preference');

const DOTY = 'user-doty';
const MIKE = 'user-mike';
const SITE = 'site-gillett';

describe('personal browser storage', () => {
  beforeEach(() => store.clear());

  it('gives each person their own open panes on the same site', () => {
    setStorageOwner(DOTY);
    saveLayout(SITE, { grid: 'doty' }, { a: { surface: 'commerce.orders' } as never });

    setStorageOwner(MIKE);
    expect(loadLayout(SITE)).toBeNull();
    saveLayout(SITE, { grid: 'mike' }, { b: { surface: 'scheduling.calendar' } as never });

    setStorageOwner(DOTY);
    expect(loadLayout(SITE)?.grid).toEqual({ grid: 'doty' });
  });

  it('keeps the list-or-board choice per person', () => {
    setStorageOwner(DOTY);
    writeListView('crm.deals', 'table');
    setStorageOwner(MIKE);
    expect(readListView('crm.deals', 'board')).toBe('board');
  });

  it('hands a value saved before this to exactly one person', () => {
    store.set('sparx-workbench-list-view', JSON.stringify({ 'crm.deals': 'table' }));

    setStorageOwner(DOTY);
    expect(readListView('crm.deals', 'board')).toBe('table');
    expect(store.has('sparx-workbench-list-view')).toBe(false);

    setStorageOwner(MIKE);
    expect(readListView('crm.deals', 'board')).toBe('board');
  });

  it('names the person in the key', () => {
    setStorageOwner(MIKE);
    expect(personalKey('sparx-workbench-beta-read')).toBe('sparx-workbench-beta-read@user-mike');
  });
});

// Every file that keeps something in the browser either keys it to the person or
// is named here as belonging to the computer. A new store has to pick a side.
const COMPUTER_OWNED = [
  'lib/theme.ts', // light or dark, for this screen
  'lib/window-mode.ts', // windows or tabs, for this screen
  'lib/window-zoom.ts', // zoom, for this screen
  'lib/workbench/deep-link-switch.ts', // one tab's retry count, sessionStorage
  'surfaces/crm/calls-data.ts', // the phone on this desk
  'surfaces/inventory/count-location.ts', // the warehouse this scanner is in
  'surfaces/inventory/scan-data.ts', // this scanner's offline queue and id
];

describe('browser storage in the workbench', () => {
  it('belongs to the person unless it is named as the computer', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { dirname, join, relative, sep } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const app = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) files.push(full);
      }
    };
    for (const root of ['lib', 'components', 'surfaces', 'app']) walk(join(app, root));
    expect(files.length).toBeGreaterThan(200);

    const storing = files
      .filter((file) =>
        /(local|session)Storage\.(getItem|setItem)\(/.test(readFileSync(file, 'utf8'))
      )
      .map((file) => relative(app, file).split(sep).join('/'));
    expect(storing.length).toBeGreaterThan(8);

    const unowned = storing.filter(
      (file) =>
        !COMPUTER_OWNED.includes(file) &&
        !readFileSync(join(app, file), 'utf8').includes('personalKey(')
    );
    expect(unowned).toEqual([]);
  });
});
