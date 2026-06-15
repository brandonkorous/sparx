'use client';

// The Builder editor keymap (docs/builder/05 §2.6) — ONE keyboard handler bound by
// the shell over the whole editor, mapping shortcuts to the editor brain's
// handlers. Shared verbatim by every surface (the single-tree workspace + the
// unified studio), so the keymap can't drift between them, and it's the source of
// truth the `?` overlay lists (SHORTCUTS below).
//
// `mod` is ⌘ on macOS, Ctrl elsewhere — accepted interchangeably (metaKey ||
// ctrlKey) so the same binding works on both. Shortcuts are inert while a text
// field is focused (typing in the inspector / a rename never reorders the canvas),
// and the destructive Delete still routes through the confirm-gated handler
// (feedback_destructive_actions_confirm) — the keymap only triggers it, the editor
// owns the guard.

import * as React from 'react';

export type NudgeDir = 'up' | 'down' | 'left' | 'right';

export interface KeymapHandlers {
  undo?: () => void;
  redo?: () => void;
  copy?: () => void;
  paste?: () => void | Promise<void>;
  duplicate?: () => void;
  /** Delete the selection (the editor confirms before destroying). */
  remove?: () => void;
  copyStyles?: () => void;
  pasteStyles?: () => void;
  selectAll?: () => void;
  selectParent?: () => void;
  clear?: () => void;
  nudge?: (dir: NudgeDir) => void;
  save?: () => void;
  toggleHelp?: () => void;
  /** Whether a node is selected — gates the plain-arrow nudge so arrows still scroll
   *  the canvas when nothing is selected. */
  hasSelection?: boolean;
}

export interface Shortcut {
  /** Key tokens; the literal `'mod'` renders as ⌘ / Ctrl in the overlay. */
  combo: string[];
  label: string;
}
export interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

/** The documented keymap, grouped for the `?` overlay (docs/builder/05 §2.6). */
export const SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'History',
    items: [
      { combo: ['mod', 'Z'], label: 'Undo' },
      { combo: ['mod', '⇧', 'Z'], label: 'Redo' },
    ],
  },
  {
    title: 'Edit',
    items: [
      { combo: ['mod', 'D'], label: 'Duplicate' },
      { combo: ['mod', 'C'], label: 'Copy' },
      { combo: ['mod', 'V'], label: 'Paste' },
      { combo: ['⌫'], label: 'Delete' },
    ],
  },
  {
    title: 'Styles',
    items: [
      { combo: ['mod', '⇧', 'C'], label: 'Copy styles' },
      { combo: ['mod', '⇧', 'V'], label: 'Paste styles' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { combo: ['mod', 'A'], label: 'Select all' },
      { combo: ['mod', '↑'], label: 'Select parent' },
      { combo: ['Esc'], label: 'Clear selection' },
    ],
  },
  {
    title: 'Arrange',
    items: [
      { combo: ['↑', '↓'], label: 'Move up / down' },
      { combo: ['←', '→'], label: 'Move out / in' },
    ],
  },
  {
    title: 'General',
    items: [
      { combo: ['mod', 'S'], label: 'Save' },
      { combo: ['?'], label: 'Show shortcuts' },
    ],
  },
];

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Bind the editor keymap to the window while `enabled`. Handlers are read through
 *  a ref so the listener isn't re-subscribed on every render. */
export function useEditorKeymap(handlers: KeymapHandlers, enabled = true): void {
  const ref = React.useRef(handlers);
  ref.current = handlers;

  React.useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key;
      const lower = k.length === 1 ? k.toLowerCase() : k;

      // Help overlay — "?" (Shift+/ on most layouts).
      if (k === '?' && h.toggleHelp) {
        e.preventDefault();
        h.toggleHelp();
        return;
      }

      if (mod && lower === 'z') {
        e.preventDefault();
        if (e.shiftKey) h.redo?.();
        else h.undo?.();
        return;
      }
      if (mod && lower === 'y') {
        e.preventDefault();
        h.redo?.();
        return;
      }
      if (mod && e.shiftKey && lower === 'c') {
        e.preventDefault();
        h.copyStyles?.();
        return;
      }
      if (mod && e.shiftKey && lower === 'v') {
        e.preventDefault();
        h.pasteStyles?.();
        return;
      }
      if (mod && lower === 'c') {
        e.preventDefault();
        h.copy?.();
        return;
      }
      if (mod && lower === 'v') {
        e.preventDefault();
        void h.paste?.();
        return;
      }
      if (mod && lower === 'd') {
        e.preventDefault();
        h.duplicate?.();
        return;
      }
      if (mod && lower === 'a') {
        e.preventDefault();
        h.selectAll?.();
        return;
      }
      if (mod && lower === 's') {
        e.preventDefault();
        h.save?.();
        return;
      }
      if (mod && k === 'ArrowUp') {
        e.preventDefault();
        h.selectParent?.();
        return;
      }
      if (k === 'Delete' || k === 'Backspace') {
        e.preventDefault(); // also stops Backspace from navigating back
        h.remove?.();
        return;
      }
      if (k === 'Escape') {
        h.clear?.();
        return;
      }
      // Plain arrows reorder the selected node; without a selection they fall
      // through so the canvas scrolls as usual.
      if (!mod && h.hasSelection && h.nudge) {
        const dir: NudgeDir | null =
          k === 'ArrowUp'
            ? 'up'
            : k === 'ArrowDown'
              ? 'down'
              : k === 'ArrowLeft'
                ? 'left'
                : k === 'ArrowRight'
                  ? 'right'
                  : null;
        if (dir) {
          e.preventDefault();
          h.nudge(dir);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
