'use client';

// Choosing several rows in a list pane, for every list pane.
//
// ── Why the whole ROW is kept, not its id ───────────────────────────────────
//
// A selection outlives the page it was made on. Somebody who ticks four things,
// pages forward and ticks two more expects to act on six — so the rows travel
// with the selection rather than being looked up again from a window that no
// longer contains them.
//
// ── Shift-click is a range, and the anchor is the last plain click ──────────
//
// Range selection is the difference between "pick these fifteen" being one
// gesture and being fifteen. The anchor moves on every ordinary click and stays
// put during a shift-click, which is what every file list has done for thirty
// years and therefore the only behaviour that will not surprise anyone.

import { useCallback, useRef, useState } from 'react';

export interface ListSelection<T> {
  /** Chosen rows by key, in the order they were chosen. */
  chosen: Map<string, T>;
  count: number;
  has: (key: string) => boolean;
  /** Every row on the CURRENT page that is allowed to be chosen. */
  selectable: T[];
  allOnPageChosen: boolean;
  someOnPageChosen: boolean;
  /** Handles a click on one row's checkbox, including shift-range. */
  toggle: (row: T, on: boolean, modifiers?: { shiftKey: boolean }) => void;
  toggleAllOnPage: () => void;
  clear: () => void;
}

export interface SelectionOptions<T> {
  /** Stable identity for a row. Two rows with the same key are the same row. */
  keyOf: (row: T) => string;
  /**
   * Rows this list refuses to act on — a reorder line with no supplier, a
   * product somebody else is editing. Unselectable rather than selectable and
   * then rejected, so the count in the bar is always the count that will act.
   */
  canChoose?: (row: T) => boolean;
}

export function useListSelection<T>(rows: T[], options: SelectionOptions<T>): ListSelection<T> {
  const { keyOf, canChoose } = options;
  const [chosen, setChosen] = useState<Map<string, T>>(new Map());
  // The last row clicked WITHOUT shift. Held in a ref because moving it must
  // not re-render — it is a gesture detail, not state anything draws.
  const anchor = useRef<string | null>(null);

  const selectable = canChoose ? rows.filter(canChoose) : rows;
  const allOnPageChosen =
    selectable.length > 0 && selectable.every((row) => chosen.has(keyOf(row)));
  const someOnPageChosen = selectable.some((row) => chosen.has(keyOf(row)));

  const clear = useCallback(() => {
    setChosen(new Map());
    anchor.current = null;
  }, []);

  const toggle = useCallback(
    (row: T, on: boolean, modifiers?: { shiftKey: boolean }) => {
      const key = keyOf(row);
      const range = modifiers?.shiftKey === true && anchor.current !== null;

      setChosen((current) => {
        const next = new Map(current);
        const apply = (target: T, add: boolean) => {
          if (add) next.set(keyOf(target), target);
          else next.delete(keyOf(target));
        };

        if (!range) {
          apply(row, on);
          return next;
        }

        // A range takes the state of the row that ENDS it, so shift-clicking an
        // unticked row ticks the span and shift-clicking a ticked one clears it.
        const from = selectable.findIndex((r) => keyOf(r) === anchor.current);
        const to = selectable.findIndex((r) => keyOf(r) === key);
        if (from === -1 || to === -1) {
          apply(row, on);
          return next;
        }
        const [lo, hi] = from <= to ? [from, to] : [to, from];
        for (let i = lo; i <= hi; i += 1) apply(selectable[i]!, on);
        return next;
      });

      if (!range) anchor.current = key;
    },
    [keyOf, selectable]
  );

  const toggleAllOnPage = useCallback(() => {
    setChosen((current) => {
      const next = new Map(current);
      for (const row of selectable) {
        if (allOnPageChosen) next.delete(keyOf(row));
        else next.set(keyOf(row), row);
      }
      return next;
    });
    anchor.current = null;
  }, [allOnPageChosen, keyOf, selectable]);

  return {
    chosen,
    count: chosen.size,
    has: (key: string) => chosen.has(key),
    selectable,
    allOnPageChosen,
    someOnPageChosen,
    toggle,
    toggleAllOnPage,
    clear,
  };
}
