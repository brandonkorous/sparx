import { describe, expect, it, vi } from 'vitest';
import { DocumentStore } from './document-store';
import { findNode } from '../tree/walk';
import { el, pageDoc, themeDoc } from '../testing/fixtures';

describe('applying and undoing', () => {
  it('marks dirty on an edit and clean again once undone past it', () => {
    // Counted rather than diffed: undoing back to the last save has to report
    // clean, or the close-guard nags about work the author already took back.
    const store = new DocumentStore(pageDoc());
    expect(store.dirty).toBe(false);

    store.apply('Set class', [{ kind: 'node.setClass', id: 'hero', value: 'py-16' }]);
    expect(store.dirty).toBe(true);

    store.undo();
    expect(store.dirty).toBe(false);

    store.redo();
    expect(store.dirty).toBe(true);
  });

  it('clears dirty on save and re-dirties if you undo below the save point', () => {
    const store = new DocumentStore(pageDoc());
    store.apply('Set class', [{ kind: 'node.setClass', id: 'hero', value: 'py-16' }]);
    store.markSaved(2);
    expect(store.dirty).toBe(false);
    expect(store.current.rev).toBe(2);

    store.undo();
    // The document now differs from what the server holds — which is exactly what
    // dirty means, even though the author got there by undoing.
    expect(store.dirty).toBe(true);
  });

  it('applies a batch all-or-nothing', () => {
    const store = new DocumentStore(pageDoc());
    const before = store.current.root;

    const ok = store.apply('Two edits, one impossible', [
      { kind: 'node.setClass', id: 'hero', value: 'py-16' },
      { kind: 'node.setClass', id: 'ghost', value: 'py-16' },
    ]);

    expect(ok).toBe(false);
    // A partially applied batch has no inverse that restores it, so accepting one
    // would corrupt undo for every action after it.
    expect(store.current.root).toBe(before);
    expect(store.dirty).toBe(false);
  });

  it('undoes a multi-op batch back to front', () => {
    const store = new DocumentStore(pageDoc());
    store.apply('Add and move', [
      { kind: 'node.insert', parentId: 'body-root', index: 1, node: el('added', ['x']) },
      { kind: 'node.move', id: 'added', parentId: 'hero', index: 0 },
    ]);
    expect(findNode(store.current.root, 'added')).toBeDefined();

    expect(store.undo()).toBe(true);
    expect(findNode(store.current.root, 'added')).toBeUndefined();
  });

  it('notifies subscribers and keeps the snapshot stable between changes', () => {
    const store = new DocumentStore(pageDoc());
    const listener = vi.fn();
    store.subscribe(listener);

    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);

    store.apply('Set class', [{ kind: 'node.setClass', id: 'hero', value: 'py-16' }]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(first);
  });

  it('drops history on reset', () => {
    const store = new DocumentStore(pageDoc());
    store.apply('Set class', [{ kind: 'node.setClass', id: 'hero', value: 'py-16' }]);
    store.reset(pageDoc());
    // The stacks described a lineage this document no longer has.
    expect(store.getSnapshot().canUndo).toBe(false);
    expect(store.dirty).toBe(false);
  });
});

describe('theme documents', () => {
  it('keeps light and dark token edits apart', () => {
    const store = new DocumentStore(themeDoc());
    store.apply('Dark primary', [
      { kind: 'theme.setToken', mode: 'dark', token: '--color-primary', value: '#B84A5C' },
    ]);

    expect(store.current.theme.tokens['--color-primary']).toBe('#FF6F86');
    expect(store.current.theme.dark?.['--color-primary']).toBe('#B84A5C');

    store.undo();
    expect(store.current.theme.dark?.['--color-primary']).toBeUndefined();
  });

  it('refuses a tree op on a theme', () => {
    const store = new DocumentStore(themeDoc());
    expect(store.apply('Nope', [{ kind: 'node.setClass', id: 'x', value: 'p-4' }])).toBe(false);
  });
});

describe('selection', () => {
  it('only notifies when the selection actually moves', () => {
    const store = new DocumentStore(pageDoc());
    const listener = vi.fn();
    store.subscribe(listener);

    store.select(['hero']);
    store.select(['hero']);
    expect(listener).toHaveBeenCalledTimes(1);

    store.select(['hero', 'title']);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('coalescing a continuous edit', () => {
  const set = (value: string) => [
    { kind: 'theme.setToken' as const, mode: 'light' as const, token: '--color-primary', value },
  ];
  /** What the fixture's look starts on — what undo has to land back on. */
  const START = themeDoc().theme.tokens['--color-primary'];

  it('folds every frame of one drag into a single undo step', () => {
    // Without this, dragging a colour picker pushes a batch per frame and the
    // 200-deep stack throws away the work the author actually wants back.
    const store = new DocumentStore(themeDoc());
    const key = 'theme.setToken:light:--color-primary';

    store.apply('Set main color', set('#111111'), key);
    store.apply('Set main color', set('#222222'), key);
    store.apply('Set main color', set('#333333'), key);

    expect(store.current.theme.tokens['--color-primary']).toBe('#333333');
    expect(store.dirty).toBe(true);

    store.undo();
    // Back to where the drag STARTED, not to the previous frame of it.
    expect(store.current.theme.tokens['--color-primary']).toBe(START);
    expect(store.dirty).toBe(false);
    expect(store.getSnapshot().canUndo).toBe(false);
  });

  it('redoes the folded step to where the drag ended', () => {
    const store = new DocumentStore(themeDoc());
    const key = 'theme.setToken:light:--color-primary';
    store.apply('Set main color', set('#111111'), key);
    store.apply('Set main color', set('#222222'), key);

    store.undo();
    store.redo();
    expect(store.current.theme.tokens['--color-primary']).toBe('#222222');
  });

  it('starts a new step for a different control', () => {
    const store = new DocumentStore(themeDoc());
    store.apply('Set main color', set('#111111'), 'theme.setToken:light:--color-primary');
    store.apply(
      'Set corners',
      [{ kind: 'theme.setToken', mode: 'light', token: '--radius-box', value: '1rem' }],
      'theme.setToken:light:--radius-box'
    );

    store.undo();
    expect(store.current.theme.tokens['--radius-box']).toBe(
      themeDoc().theme.tokens['--radius-box']
    );
    // The colour edit is its own step and survives.
    expect(store.current.theme.tokens['--color-primary']).toBe('#111111');
  });

  it('does not fold an edit that arrives after an undo', () => {
    // The batch on top after an undo is a DIFFERENT lineage; folding into it
    // would rewrite a step the author had already taken back.
    const store = new DocumentStore(themeDoc());
    const key = 'theme.setToken:light:--color-primary';
    store.apply('Set main color', set('#111111'), key);
    store.undo();
    store.apply('Set main color', set('#222222'), key);

    store.undo();
    expect(store.current.theme.tokens['--color-primary']).toBe(START);
    expect(store.getSnapshot().canUndo).toBe(false);
  });

  it('does not fold across a save, so dirty flips again', () => {
    const store = new DocumentStore(themeDoc());
    const key = 'theme.setToken:light:--color-primary';
    store.apply('Set main color', set('#111111'), key);
    store.markSaved(2);
    expect(store.dirty).toBe(false);

    store.apply('Set main color', set('#222222'), key);
    expect(store.dirty).toBe(true);
  });

  it('leaves an uncoalesced apply as its own step', () => {
    const store = new DocumentStore(themeDoc());
    store.apply('Set main color', set('#111111'));
    store.apply('Set main color', set('#222222'));

    store.undo();
    expect(store.current.theme.tokens['--color-primary']).toBe('#111111');
  });
});
