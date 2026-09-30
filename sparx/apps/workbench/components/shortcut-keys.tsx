'use client';

// The keys we tell somebody to press, on the keyboard they are actually holding.
//
// ── The defect this exists for ───────────────────────────────────────────
//
// The toolbar's search button printed `⌘K`, the launcher's footer printed
// `⌥↵ new window`, the empty workspace said `⌘K`, and Home taught the whole
// workbench with "Press ⌘K" and "Hold ⇧ when opening". Those are the Mac
// Command, Option and Shift keys. A Windows keyboard carries none of those
// symbols, so the person reading them is being told to press a key they cannot
// find. The shortcut itself always worked — the launcher binds
// `metaKey || ctrlKey` — so nothing was broken except the sentences that were
// supposed to teach it.
//
// This console's own guided tour already says "press Ctrl-K (⌘K on a Mac)". It
// was the only place that did. Found while testing the OTHER console's
// launcher, which carried the same glyphs in the same two components.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── Why it is read this way ──────────────────────────────────────────────
//
// The platform is not knowable on the server, and these captions are rendered
// there first. `useSyncExternalStore` takes a server snapshot, so the markup
// React builds on the server and the markup it builds on the client agree, and
// nothing has to be suppressed. The server snapshot is NOT a Mac: a tenant is
// more likely to be on Windows, so the first paint is right for most people and
// corrects itself in the same tick for the rest.
//
// Nothing subscribes, because nobody changes keyboard mid-session.

import { useSyncExternalStore, type ComponentProps } from 'react';
import { Kbd } from '@wizeworks/silicaui-react';

type KbdSize = ComponentProps<typeof Kbd>['size'];

/** Nothing to subscribe to: nobody swaps keyboard mid-session. */
function neverChanges(): () => void {
  return () => undefined;
}

function readIsMac(): boolean {
  // `userAgentData.platform` is the supported reading; `navigator.platform` is
  // deprecated but is still the only answer in Firefox and Safari, so it is the
  // fallback rather than the first choice.
  const withData = navigator as Navigator & { userAgentData?: { platform?: string } };
  const hinted = withData.userAgentData?.platform;
  // An empty hint is not an answer, so fall through to the deprecated reading
  // rather than concluding "not a Mac" from nothing.
  const platform = hinted !== undefined && hinted !== '' ? hinted : navigator.platform;
  return /mac/i.test(platform);
}

/** True when this person's modifier key is ⌘ rather than Ctrl. */
export function useIsMac(): boolean {
  return useSyncExternalStore(neverChanges, readIsMac, () => false);
}

/** The key that opens the search box, spelled for the keyboard in front of them. */
export function LauncherKey({ size }: { size?: KbdSize }) {
  const mac = useIsMac();
  return <Kbd size={size}>{mac ? '⌘K' : 'Ctrl K'}</Kbd>;
}

/**
 * Enter, with the modifier that decides where the pane lands.
 *
 * The words are the same three destinations the foot of every list already
 * names — open, alongside, new window — so the keyboard route and the mouse
 * route are taught in the same vocabulary.
 */
export function EnterKey({ hold, size }: { hold?: 'shift' | 'alt'; size?: KbdSize }) {
  const mac = useIsMac();
  const enter = mac ? '↵' : 'Enter';
  if (hold === 'shift') return <Kbd size={size}>{mac ? `⇧${enter}` : 'Shift Enter'}</Kbd>;
  if (hold === 'alt') return <Kbd size={size}>{mac ? `⌥${enter}` : 'Alt Enter'}</Kbd>;
  return <Kbd size={size}>{enter}</Kbd>;
}

/**
 * The same two keys as WORDS, for copy that is a sentence rather than a keycap.
 *
 * Home teaches the workbench in prose, and prose cannot hold a `<Kbd>`. Taking
 * the answer as an argument keeps those strings a plain list the file can still
 * be read as, rather than turning them into a component tree.
 */
export function launcherKeyText(mac: boolean): string {
  return mac ? '⌘K' : 'Ctrl-K';
}

/** The modifier that opens something alongside what you are already looking at. */
export function alongsideKeyText(mac: boolean): string {
  return mac ? '⇧' : 'Shift';
}
