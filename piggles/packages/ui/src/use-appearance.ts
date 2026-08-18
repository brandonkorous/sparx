'use client';

// The appearance of THIS document, kept in step with every other window.
//
// Every window that paints Piggles chrome mounts this exactly once — a browser
// tab, and in the console a detached pane's popout, which is a separate
// `document` with its own React root and shares nothing by reference. One hook,
// mounted per window, is what keeps "dark" from meaning dark in only one of
// them.
//
// ── THE TWO VALUES, AND WHERE EACH ONE LIVES ────────────────────────────────
//
// The APPEARANCE ('system' | 'light' | 'dark') lives in React state here, seeded
// from localStorage after mount and announced to the other windows. The THEME
// ('light' | 'dark') is NOT mirrored in state — it is read straight off
// `data-theme`, so a control showing the appearance can never disagree with the
// document it is sitting on. Writing the attribute and then reading it back is
// deliberate: one direction of truth, no second copy to fall out of step. A
// second copy is precisely what went wrong before.
//
// ── WHY THE APPEARANCE STARTS AS `null` ─────────────────────────────────────
//
// The server cannot know it, so the first client render has to match a server
// render that assumed nothing. `null` means "not resolved yet" and the effect
// that writes `data-theme` SKIPS it — the pre-paint script has already put the
// right answer there, and applying a placeholder first would repaint the whole
// app light for a frame on the way to dark. Unresolved is not a state a person
// ever sees; it is one commit long.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  applyAppearance,
  readAppearance,
  systemAppearance,
  watchSystemAppearance,
  writeAppearance,
  type Appearance,
  type ResolvedAppearance,
} from './appearance';

/** The message every window agrees on. Deliberately the shape the console's own
 *  bus already carried, so the console can share ONE channel between appearance
 *  and its other cross-window traffic rather than opening a second. */
interface AppearanceMessage {
  type: 'theme.changed';
  choice: Appearance;
}

export interface AppearanceState {
  /** What the person picked. `system` until they pick otherwise. */
  choice: Appearance;
  /** What that resolves to right now — what the document is actually wearing. */
  theme: ResolvedAppearance;
  /** Picks a new appearance: applied here, remembered, and announced to every
   *  other open window. */
  setChoice: (next: Appearance) => void;
}

export interface AppearanceOptions {
  /** Where the choice is remembered. Per app, because localStorage is per origin
   *  — and because `piggles-console-theme` in a customer's browser says less
   *  about them than a shared key would. */
  storageKey: string;
  /**
   * BroadcastChannel name, so two open windows of the same app agree.
   *
   * The channel carries the CHOICE, never the resolved theme: `system` has to be
   * resolved per window against that window's own machine, and sending 'dark'
   * would pin a window that was meant to follow.
   */
  channel: string;
}

/** What the document is wearing, observed rather than remembered. A
 *  MutationObserver rather than a one-off read, so anything that writes the
 *  attribute — this hook, the pre-paint script, a future third thing — is
 *  reflected without a second source of truth. */
function useDocumentAppearance(): ResolvedAppearance {
  const subscribe = useCallback((onChange: () => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
    // The server render cannot know the persisted choice; the pre-paint script
    // has already set the attribute before this ever mounts on the client.
    () => 'light'
  );
}

export function useAppearance({ storageKey, channel }: AppearanceOptions): AppearanceState {
  const [choice, setChoiceState] = useState<Appearance | null>(null);
  const [system, setSystem] = useState<ResolvedAppearance>('light');
  const post = useRef<((message: AppearanceMessage) => void) | null>(null);
  const applied = useDocumentAppearance();

  // Both after mount: localStorage does not exist on the server, and
  // `prefers-color-scheme` is a property of the machine looking at the page, not
  // of the render that produced it.
  useEffect(() => {
    setChoiceState(readAppearance(storageKey));
    setSystem(systemAppearance());
    // Subscribed for the lifetime of the window, not just while `system` is the
    // choice: unsubscribing on pin and resubscribing on unpin is more moving
    // parts than a listener that sets a value nobody reads.
    return watchSystemAppearance(() => {
      setSystem(systemAppearance());
    });
  }, [storageKey]);

  useEffect(() => {
    // Absent in a server render and in older Safari. A missing channel must not
    // take the app down — it degrades to single-window behaviour, which is what
    // all but one of these surfaces has anyway.
    if (typeof BroadcastChannel === 'undefined') return;
    const bus = new BroadcastChannel(channel);
    bus.onmessage = (event: MessageEvent<AppearanceMessage>) => {
      if (event.data?.type === 'theme.changed') setChoiceState(event.data.choice);
    };
    post.current = (message) => {
      bus.postMessage(message);
    };
    return () => {
      post.current = null;
      bus.close();
    };
  }, [channel]);

  const resolved: ResolvedAppearance =
    choice === null ? 'light' : choice === 'system' ? system : choice;

  // Keyed on the resolved value and run in an effect, which also makes it
  // self-healing: anything that remounts this tree — a dev fast refresh, a
  // recovered error boundary — re-asserts the appearance on the way back up.
  useEffect(() => {
    if (choice === null) return;
    applyAppearance(document, resolved);
  }, [choice, resolved]);

  const setChoice = useCallback(
    (next: Appearance) => {
      setChoiceState(next);
      writeAppearance(storageKey, next);
      post.current?.({ type: 'theme.changed', choice: next });
    },
    [storageKey]
  );

  return { choice: choice ?? 'system', theme: applied, setChoice };
}
