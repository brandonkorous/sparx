import { describe, expect, it } from 'vitest';
import { isLayoutWrapper, layerRows, rowIcon, rowLabel } from './layer-tree';
import { el } from '../../testing/fixtures';

/** A footer as it really gets authored: three nested boxes before a word appears. */
const footer = () =>
  el('footer-root', [
    el('wrap', [el('cols', [el('col', [el('legal', ['© Bakery'], 'p')])])]),
    el('named', [el('inner', ['Hours'], 'span')]),
  ]);

describe('folding layout-only wrappers', () => {
  it('drops the scaffolding and lifts its children', () => {
    const simple = layerRows(footer(), { depth: 'simple' });
    const ids = simple.map((row) => row.id);
    // The three boxes exist on the canvas and are still every move's parent — they
    // just do not earn a row.
    expect(ids).not.toContain('wrap');
    expect(ids).not.toContain('cols');
    expect(ids).toContain('legal');
  });

  it('lists everything when asked to', () => {
    const all = layerRows(footer(), { depth: 'all' }).map((row) => row.id);
    expect(all).toContain('wrap');
    expect(all).toContain('cols');
  });

  it('keeps a wrapper that has a reason to be findable', () => {
    expect(isLayoutWrapper(el('x', [el('y')]))).toBe(true);
    expect(isLayoutWrapper({ ...el('x', [el('y')]), label: 'Hero' })).toBe(false);
    expect(isLayoutWrapper({ ...el('x', [el('y')]), locked: 'author' })).toBe(false);
    expect(isLayoutWrapper({ ...el('x', [el('y')]), instanceOf: 'sym' })).toBe(false);
    // Nothing inside it — folding would drop the only row for an empty box the
    // author is about to fill.
    expect(isLayoutWrapper(el('x', []))).toBe(false);
    // A section is a thing, not scaffolding, whatever it holds.
    expect(isLayoutWrapper(el('x', [el('y')], 'section'))).toBe(false);
  });

  it('never folds the root, even when it looks like a wrapper', () => {
    const rows = layerRows(el('root', [el('a', ['hi'])]), { depth: 'simple' });
    expect(rows[0]?.id).toBe('root');
  });
});

describe('naming a row', () => {
  it('prefers the name the author gave it', () => {
    expect(rowLabel({ ...el('x', ['Some words']), label: 'Hero' })).toBe('Hero');
  });

  it('falls back to the words it holds', () => {
    expect(rowLabel(el('x', ['Fresh bread daily']))).toBe('Fresh bread daily');
  });

  it('truncates a paragraph rather than blowing out the rail', () => {
    const long = 'a'.repeat(80);
    expect(rowLabel(el('x', [long])).length).toBeLessThanOrEqual(40);
  });

  it('says what kind of thing it is in plain English, never a tag', () => {
    // A business owner has no reason to know what an `<aside>` is.
    expect(rowLabel(el('x', [el('y')], 'aside'))).toBe('Side panel');
    expect(rowLabel(el('x', [el('y')], 'nav'))).toBe('Menu');
    expect(rowLabel(el('x', [el('y')], 'div'))).toBe('Group');
  });

  it('names an instance for what it is', () => {
    expect(rowLabel({ ...el('x'), instanceOf: 'sym' })).toBe('Saved design');
    expect(rowIcon({ ...el('x'), instanceOf: 'sym' })).toBe('shared');
  });

  it('reads a bare box by what it does', () => {
    expect(rowIcon({ ...el('x', [el('y')]), class: 'grid grid-cols-2' })).toBe('grid');
    expect(rowIcon({ ...el('x', [el('y')]), class: 'flex gap-4' })).toBe('stack');
    expect(rowIcon(el('x', [el('y')]))).toBe('box');
  });
});

describe('instances', () => {
  it('does not list a master’s insides', () => {
    const root = el('root', [{ ...el('inst', [el('leaked', ['nope'])]), instanceOf: 'sym' }]);
    const ids = layerRows(root, { depth: 'all' }).map((row) => row.id);
    // Editing the master belongs to the component pane; rows here would offer
    // edits that either detach the piece or change every other instance silently.
    expect(ids).toContain('inst');
    expect(ids).not.toContain('leaked');
  });
});

describe('editability', () => {
  it('marks rows outside the editable set', () => {
    const rows = layerRows(el('root', [el('a', ['x'])]), {
      depth: 'all',
      editableIds: new Set(['root']),
    });
    expect(rows.find((row) => row.id === 'root')?.editable).toBe(true);
    expect(rows.find((row) => row.id === 'a')?.editable).toBe(false);
  });
});
