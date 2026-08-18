'use client';

// Which presentation this window gets.
//
// The ONE viewport media query in the app, and it earns the exception. Surfaces
// use @container because a pane's width is unrelated to the screen's — but this
// question is genuinely about the device: is there room to arrange panes side by
// side at all, and is the pointer likely a thumb. That is a viewport fact.
//
// 64rem (1024px) is the line. Below it a dock is not cramped, it is pointless:
// two panes at 500px each show nothing useful, and the tab strip eats the height
// the work needs. A tablet in portrait therefore gets the stack, which is the
// right answer — arranging panels is a mouse-and-monitor activity.

import { useSyncExternalStore } from 'react';

const COMPACT_QUERY = '(max-width: 63.999rem)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function getSnapshot(): boolean {
  return window.matchMedia(COMPACT_QUERY).matches;
}

/**
 * False on the server and on the first client render.
 *
 * Deliberate: the server cannot know the viewport, so it has to guess, and
 * guessing "desktop" means a phone renders the dock for one frame before
 * swapping. Guessing "mobile" would mean every desktop does the same. Desktop
 * is the safer guess because the swap happens before the dock finishes booting
 * (the shell waits on a site fetch either way), so nothing visible flips.
 */
function getServerSnapshot(): boolean {
  return false;
}

export function useIsCompact(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
