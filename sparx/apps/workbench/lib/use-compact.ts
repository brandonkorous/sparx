'use client';

// The ONE viewport media query in the app, and it earns the exception. Surfaces
// use @container because a pane's width is unrelated to the screen's — this
// question is about the DEVICE: is there room to arrange panes side by side at
// all, and is the pointer likely a thumb.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { COMPACT_COOKIE, COMPACT_QUERY } from './compact';

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
 * `initial` is the server's answer (lib/compact.ts), and the first CLIENT render
 * has to use the same one — that is the whole fix. Hydrating against a hardcoded
 * "desktop" is what painted the rail, the dock and the strip onto a phone for as
 * long as hydration took, then swapped them for the stack.
 */
export function useIsCompact(initial: boolean): boolean {
  const hydrated = useCallback(() => initial, [initial]);
  const compact = useSyncExternalStore(subscribe, getSnapshot, hydrated);

  // Leaves this browser's REAL answer for the next load, so a refresh never
  // guesses — including the narrow desktop window no request header describes.
  // Session-scoped: a viewport is a fact about right now, not a preference.
  useEffect(() => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COMPACT_COOKIE}=${compact ? '1' : '0'}; path=/; SameSite=Lax${secure}`;
  }, [compact]);

  return compact;
}
