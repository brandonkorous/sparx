'use client';

// What every theme control needs, resolved once.
//
// Light and dark are edited SEPARATELY. `values` is what the canvas will actually
// resolve for the mode on screen — the base tokens with the dark delta merged over
// them — while `setToken` writes to one bag only. A control that read the merged
// map and wrote both would silently undo a dark override the first time anyone
// nudged a color.

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ThemeDoc } from '../../documents/types';
import { isEditable } from '../../documents/types';
import { useApply, useDoc } from '../context';
import { coalesceKey } from './tokens';

export type ThemeMode = 'light' | 'dark';

export interface ThemeEdit {
  mode: ThemeMode;
  /** Effective values for `mode` — base with the dark delta merged over it. */
  values: Record<string, string>;
  /** What THIS mode's bag holds, so a control can tell "inherited" from "chosen". */
  own: Record<string, string>;
  editable: boolean;
  /** Write one token. `undefined` clears it back to the default. `label` is what
   *  undo will be called; repeated edits to one token fold into one step. */
  setToken: (token: string, value: string | undefined, label: string) => void;
}

const Context = createContext<ThemeEdit | null>(null);

export function ThemeEditProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const doc = useDoc<ThemeDoc>();
  const apply = useApply();
  const editable = isEditable(doc);

  const value = useMemo<ThemeEdit>(() => {
    const own = (mode === 'dark' ? doc.theme.dark : doc.theme.tokens) ?? {};
    const values = mode === 'dark' ? { ...doc.theme.tokens, ...own } : doc.theme.tokens;
    return {
      mode,
      values,
      own,
      editable,
      setToken: (token, tokenValue, label) => {
        apply(
          label,
          [{ kind: 'theme.setToken', mode, token, value: tokenValue }],
          coalesceKey(mode, token)
        );
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
