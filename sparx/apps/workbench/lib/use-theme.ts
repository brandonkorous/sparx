'use client';

// The workbench's appearance, applied to THIS document and kept in step with
// every other window.
//
// Every window that paints workbench chrome mounts this — the main shell and each
// detached popout — because a popout is a separate `document` with its own React
// root and nothing about it is shared by reference. One hook, mounted per
// window, is what keeps "dark" from meaning dark in one of them.
//
// ── THE TWO VALUES, AND WHERE EACH ONE LIVES ────────────────────────────────
//
// The CHOICE ('system' | 'light' | 'dark') lives in React state here, seeded
// from localStorage after mount and broadcast to the other windows on the bus.
// The THEME ('light' | 'dark') is NOT mirrored in state — it is read straight
// off `data-theme` with `useDocumentTheme`, so the icon in the top bar can never
// disagree with the document it is sitting on. Writing the attribute and then
// reading it back is deliberate: one direction of truth, no second copy to fall
// out of step. That is precisely what went wrong before.
//
// ── WHY THE CHOICE STARTS AS `null` ─────────────────────────────────────────
//
// The server cannot know it, so the first client render has to match a server
// render that assumed nothing. `null` means "not resolved yet" and the effect
// that writes `data-theme` SKIPS it — the pre-paint script has already put the
// right answer there, and applying a placeholder first would repaint the whole
// workbench light for a frame on the way to dark. Unresolved is not a state a
// person ever sees; it is one commit long.

import { useCallback, useEffect, useRef, useState } from 'react';
import { openBus, type BusMessage } from './bus';
import { useDocumentTheme } from './use-document-theme';
import {
  applyThemeToDocument,
  readThemeChoice,
  systemTheme,
  watchSystemTheme,
  writeThemeChoice,
  type Theme,
  type ThemeChoice,
} from './theme';

export interface WorkbenchTheme {
  /** What the person picked. `system` until they pick otherwise. */
  choice: ThemeChoice;
  /** What that resolves to right now — what the document is actually wearing. */
  theme: Theme;
  /** Picks a new appearance: applied here, remembered, and sent to every other
   *  open window. */
  setChoice: (next: ThemeChoice) => void;
}

export function useWorkbenchTheme(): WorkbenchTheme {
  const [choice, setChoiceState] = useState<ThemeChoice | null>(null);
  const [system, setSystem] = useState<Theme>('light');
  const post = useRef<((message: BusMessage) => void) | null>(null);
  // What the document is actually wearing, observed rather than remembered —
  // this is the value the top bar's icon and the feedback screenshot read.
  const applied = useDocumentTheme();

  // Both after mount: localStorage does not exist on the server and
  // `prefers-color-scheme` is a property of the machine looking at the page, not
  // of the render that produced it.
  useEffect(() => {
    setChoiceState(readThemeChoice());
    setSystem(systemTheme());
    // Subscribed for the lifetime of the window, not just while `system` is the
    // choice: unsubscribing on pin and resubscribing on unpin is more moving
    // parts than a listener that sets a value nobody reads.
    return watchSystemTheme(() => {
      setSystem(systemTheme());
    });
  }, []);

  // The bus carries the CHOICE, never the resolved theme. Each window resolves
  // for itself, which is the only thing that can be right — and it keeps the
  // three menus in three windows all showing the same tick.
  useEffect(() => {
    const bus = openBus((message) => {
      if (message.type === 'theme.changed') setChoiceState(message.choice);
    });
    post.current = bus.post;
    return () => {
      post.current = null;
      bus.close();
    };
  }, []);

  const resolved: Theme = choice === null ? 'light' : choice === 'system' ? system : choice;

  // Keyed on the resolved value and run in an effect, which also makes it
  // self-healing: anything that remounts this tree — a dev fast refresh, a
  // recovered error boundary — re-asserts the appearance on the way back up.
  useEffect(() => {
    if (choice === null) return;
    applyThemeToDocument(document, resolved);
  }, [choice, resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    writeThemeChoice(next);
    post.current?.({ type: 'theme.changed', choice: next });
  }, []);

  return { choice: choice ?? 'system', theme: applied, setChoice };
}
