'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generate, grow, type Scheme } from './generate';
import {
  decode,
  encode,
  MAX_SWATCHES,
  MIN_SWATCHES,
  move,
  startingPalette,
  type Palette,
} from './model';

/**
 * Versioned, because ORDER changed meaning.
 *
 * Position used to be decoration and is now the role assignment, so a palette
 * saved by the older tool comes back with its colors in slots that mean nothing
 * — the brand pink restored as the page background, and a preview that looks
 * broken through no fault of the person looking at it. A returning visitor gets
 * the starter set once rather than a puzzle.
 */
const STORE_KEY = 'piggles.palette.slots';

interface History {
  past: Palette[];
  present: Palette;
  future: Palette[];
}

/** Shuffling ten times and wanting the third one back is the normal way this
 *  tool is used, so history is the feature rather than a nicety. Capped, because
 *  an unbounded stack of every drag frame is a memory leak with a shortcut. */
const LIMIT = 60;

const push = (h: History, next: Palette): History => ({
  past: [...h.past, h.present].slice(-LIMIT),
  present: next,
  future: [],
});

/** True when a keystroke belongs to whatever the visitor is typing in. Space is
 *  the shuffle key, and a shuffle triggered from inside a hex field would be
 *  indistinguishable from the tool eating your keyboard. */
function inField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return (
    /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ||
    el.isContentEditable ||
    Boolean(el.closest?.('[role="dialog"], [role="slider"], .color-picker'))
  );
}

export function usePalette(scheme: Scheme) {
  const [history, setHistory] = useState<History>({
    past: [],
    present: startingPalette(),
    future: [],
  });
  const seed = useRef(1);
  const palette = history.present;

  const commit = useCallback((next: Palette | ((p: Palette) => Palette)) => {
    setHistory((h) => {
      const resolved = typeof next === 'function' ? next(h.present) : next;
      return resolved === h.present ? h : push(h, resolved);
    });
  }, []);

  /** A live drag rewrites the present without adding a history entry — otherwise
   *  one undo per pixel of travel. The drop is what calls `commit`. */
  const preview = useCallback((next: (p: Palette) => Palette) => {
    setHistory((h) => {
      const resolved = next(h.present);
      return resolved === h.present ? h : { ...h, present: resolved };
    });
  }, []);

  const shuffle = useCallback(() => {
    seed.current += 1;
    commit((p) => generate(p, scheme, seed.current));
  }, [commit, scheme]);

  const undo = useCallback(() => {
    setHistory((h) =>
      h.past.length === 0
        ? h
        : {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1]!,
            future: [h.present, ...h.future].slice(0, LIMIT),
          }
    );
  }, []);

  const redo = useCallback(() => {
    setHistory((h) =>
      h.future.length === 0
        ? h
        : { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) }
    );
  }, []);

  const setHex = useCallback(
    (id: string, hex: string) =>
      commit((p) => p.map((s) => (s.id === id ? { ...s, hex: hex.toUpperCase() } : s))),
    [commit]
  );

  const toggleLock = useCallback(
    (id: string) => commit((p) => p.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s))),
    [commit]
  );

  const remove = useCallback(
    (id: string) => commit((p) => (p.length <= MIN_SWATCHES ? p : p.filter((s) => s.id !== id))),
    [commit]
  );

  const add = useCallback(() => {
    seed.current += 1;
    commit((p) => (p.length >= MAX_SWATCHES ? p : grow(p, seed.current)));
  }, [commit]);

  /**
   * Moves are applied to the LATEST palette, not the one this render closed over.
   *
   * A drag fires several pointermove events per frame. Each one advanced the
   * slot pointer synchronously but read `palette` from the render that had not
   * happened yet, so every move after the first was computed against a stale
   * array and the last one won — dragging the fourth color to the front swapped
   * the first two instead.
   */
  const reorder = useCallback(
    (from: number, to: number) => preview((p) => move(p, from, to)),
    [preview]
  );

  /**
   * A drag is many state updates and exactly one undo step.
   *
   * The moves themselves bypass history — otherwise crossing four columns costs
   * four presses of undo to put back. The snapshot taken on grab is what goes on
   * the stack when the pointer is released, and only if anything actually moved.
   */
  const dragFrom = useRef<Palette | null>(null);
  const beginDrag = useCallback(() => {
    dragFrom.current = palette;
  }, [palette]);

  const endDrag = useCallback(() => {
    const before = dragFrom.current;
    dragFrom.current = null;
    setHistory((h) =>
      !before || before === h.present
        ? h
        : { past: [...h.past, before].slice(-LIMIT), present: h.present, future: [] }
    );
  }, []);

  /**
   * Read once, after mount, and BEFORE anything writes back.
   *
   * Reading in the initialiser would render one tree on the server and another
   * here, which React repairs by discarding this one — the palette would visibly
   * flash through the starter set. But the write-back effect below has to be
   * held until this has run: effects fire in declaration order, so the starter
   * palette was overwriting `?c=` a tick before this ever looked at it, and a
   * link somebody had been sent opened on the default palette instead.
   */
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const fromUrl = decode(new URLSearchParams(window.location.search).get('c'));
    if (fromUrl) {
      setHistory({ past: [], present: fromUrl, future: [] });
      setLoaded(true);
      return;
    }
    try {
      const stored = decode(window.localStorage.getItem(STORE_KEY));
      if (stored) setHistory({ past: [], present: stored, future: [] });
    } catch {
      // Nothing stored, or storage blocked. The starter palette is a fine place
      // to begin and is the point of having one.
    }
    setLoaded(true);
  }, []);

  // The address bar IS the save file. It survives a refresh, it is what somebody
  // sends to their designer, and it costs nothing to keep current.
  useEffect(() => {
    if (!loaded) return;
    const url = new URL(window.location.href);
    url.searchParams.set('c', encode(palette));
    window.history.replaceState(null, '', url);
    try {
      window.localStorage.setItem(STORE_KEY, encode(palette));
    } catch {
      // Storage blocked. The link still works, which is the part that matters.
    }
  }, [palette, loaded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inField(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (e.code === 'Space' && !meta) {
        e.preventDefault();
        shuffle();
      } else if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        (e.shiftKey ? redo : undo)();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shuffle, undo, redo]);

  return {
    palette,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    shuffle,
    undo,
    redo,
    setHex,
    toggleLock,
    remove,
    add,
    reorder,
    beginDrag,
    endDrag,
    replace: commit,
  };
}
