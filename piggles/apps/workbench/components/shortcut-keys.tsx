'use client';

// The keys we tell somebody to press, on the keyboard she is actually holding.
//
// ── The defect this exists for ───────────────────────────────────────────
//
// The search bar across the top of every screen printed `⌘K`, and the
// launcher's own footer printed `⌥↵ new window`. Those are the Mac Command and
// Option keys. A Windows keyboard has neither symbol on it anywhere, and the
// owner reading the bar is being told to press a key she cannot find. The
// shortcut itself always worked — the launcher binds `metaKey || ctrlKey` — so
// nothing was broken except the only sentence that could have taught her.
//
// The product already knew the answer twice over. The guided tour says
// "Ctrl-K opens it from anywhere (⌘K on a Mac)", and the hint along the foot of
// every list says "Alt-click in a new window". Two places were written for the
// person in front of them and two were written for a Mac.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── Why it is read this way ──────────────────────────────────────────────
//
// The platform is not knowable on the server, and these captions are rendered
// there first. `useSyncExternalStore` takes a server snapshot, so the markup
// React builds on the server and the markup it builds on the client agree, and
// nothing has to be suppressed. The server snapshot is NOT a Mac: a business
// owner is more likely to be on Windows, so the first paint is right for most
// people and corrects itself in the same tick for the rest.
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

/** The key that opens the search box, spelled for the keyboard in front of her. */
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
