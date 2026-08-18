'use client';

// What every theme control needs, resolved once.
//
// Light and dark are edited SEPARATELY. `values` is what the canvas will actually
// resolve for the mode on screen — the base tokens with the dark delta merged over
// them — while `setToken` writes to one bag only. A control that read the merged
// map and wrote both would silently undo a dark override the first time anyone
// nudged a color.
//
// COLOR is per mode. NOTHING ELSE IS. Corners, line thickness, control height,
// depth, focus outline and motion are one decision about the theme, not two: a
// site whose cards are round in the day and square at night is nobody's design.
// silica's own twenty presets agree — every one of their dark bags holds colors
// and not a single scalar. Routing those writes by mode meant setting the corners
// while Dark was selected wrote `--radius-box` into the dark delta, so the change
// vanished on switching back to Light and looked like a save that did not take —
// and on the published site the visitor's colour-scheme setting reshaped the
// cards.

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { resolveThemeTokens } from '@wizeworks/silicaui-html';
import type { StudioOp } from '../../ops/types';
import type { ThemeDoc } from '../../documents/types';
import { isEditable } from '../../documents/types';
import { useApply, useDoc } from '../context';
import { coalesceKey } from './tokens';

export type ThemeMode = 'light' | 'dark';

/** True for the tokens that mean a different thing under a different scheme. */
function isPerMode(token: string): boolean {
  return token.startsWith('--color-');
}

export interface ThemeEdit {
  mode: ThemeMode;
  /** Effective values for `mode` — base with the dark delta merged over it. */
  values: Record<string, string>;
  /** What THIS mode's bag holds, so a control can tell "inherited" from "chosen". */
  own: Record<string, string>;
  /**
   * What silica will actually PAINT for this mode — `values` plus a measured
   * `-content` for every role that has no valid one of its own.
   *
   * Separate from `values` because the two disagree exactly where it matters. A
   * theme that authors its ink in light and re-points the color in dark still has
   * that light ink sitting in the merged map, so a contrast reading taken from
   * `values` measured a pair the page had already stopped using and reported a
   * comfortable number for an unreadable button. Anything REPORTING reads this;
   * anything asking "did the author write this" still reads `own`.
   */
  resolved: Record<string, string>;
  editable: boolean;
  /** Write one token. `undefined` clears it back to the default. `label` is what
   *  undo will be called; repeated edits to one token fold into one step.
   *
   *  A color lands in the bag for the mode on screen. Anything else lands in the
   *  base and clears any stale dark delta, so one change means one value. */
  setToken: (token: string, value: string | undefined, label: string) => void;
  /** Create a token in the BASE bag whichever mode is on screen — for a color the
   *  author is inventing, which has to exist in both before it can differ in one. */
  addToken: (token: string, value: string, label: string) => void;
  /** Take a token out of BOTH bags. Clearing only the mode on screen leaves the
   *  other one holding the color, which is a delete that does not delete. */
  clearToken: (tokens: string[], label: string) => void;
}

const Context = createContext<ThemeEdit | null>(null);

export function ThemeEditProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const doc = useDoc<ThemeDoc>();
  const apply = useApply();
  const editable = isEditable(doc);

  const value = useMemo<ThemeEdit>(() => {
    const own = (mode === 'dark' ? doc.theme.dark : doc.theme.tokens) ?? {};
    const values = mode === 'dark' ? { ...doc.theme.tokens, ...own } : doc.theme.tokens;
    const dark = doc.theme.dark ?? {};
    const resolved = resolveThemeTokens(doc.theme, mode);

    const setToken: ThemeEdit['setToken'] = (token, tokenValue, label) => {
      if (isPerMode(token)) {
        apply(
          label,
          [{ kind: 'theme.setToken', mode, token, value: tokenValue }],
          coalesceKey(mode, token)
        );
        return;
      }

      // One value, in the base. The second op only exists for a theme that already
      // carries this token in its dark bag — from an import, or from before this
      // rule — and without it the stale delta would keep winning in dark and the
      // control would look broken in exactly the mode it was used in.
      const ops: StudioOp[] = [{ kind: 'theme.setToken', mode: 'light', token, value: tokenValue }];
      if (dark[token] !== undefined) {
        ops.push({ kind: 'theme.setToken', mode: 'dark', token, value: undefined });
      }
      apply(label, ops, coalesceKey('light', token));
    };

    return {
      mode,
      values,
      own,
      resolved,
      editable,
      setToken,
      addToken: (token, tokenValue, label) => {
        apply(label, [{ kind: 'theme.setToken', mode: 'light', token, value: tokenValue }]);
      },
      clearToken: (tokens, label) => {
        const ops: StudioOp[] = [];
        for (const token of tokens) {
          if (doc.theme.tokens[token] !== undefined) {
            ops.push({ kind: 'theme.setToken', mode: 'light', token, value: undefined });
          }
          if (dark[token] !== undefined) {
            ops.push({ kind: 'theme.setToken', mode: 'dark', token, value: undefined });
          }
        }
        if (ops.length) apply(label, ops);
      },
    };
  }, [apply, doc.theme, editable, mode]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useThemeEdit(): ThemeEdit {
  const value = useContext(Context);
  if (!value) throw new Error('useThemeEdit must be used inside a ThemeEditProvider');
  return value;
}
