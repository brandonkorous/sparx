'use client';

// "You have work your visitors can't see yet" — the guard on the way out of the
// studio.
//
// WHY THIS EXISTS. A silica site has two states an author can confuse: SAVED (the
// draft is durably stored) and PUBLISHED (visitors are served it). The studio
// autosaves, so leaving never loses work — but leaving with unpublished changes
// means the site the author just spent an hour on is still invisible, and nothing
// about closing a tab says so. The toolbar badge is the primary signal; this is the
// backstop for an author who didn't read it.
//
// TWO EXIT PATHS, TWO MECHANISMS. A dashboard route change never touches the
// browser's navigation lifecycle, so `beforeunload` (which the studio registers
// itself) covers only closing/reloading the tab. In-app navigation — the sidebar,
// the breadcrumb, any <Link> — is a click React Router-style frameworks handle
// internally, so the only place to intercept it is the click itself, in the capture
// phase, before Next's router sees it.
//
// DELIBERATELY NOT A ROUTER PATCH. Next's App Router exposes no navigation-blocking
// API, and the known workarounds monkey-patch `history.pushState` or the router
// singleton. Those break subtly on version bumps and would sit under EVERY dashboard
// route. A scoped click listener is uglier in theory and far safer in practice: its
// blast radius is one mounted component, and if it ever stops matching, the failure
// mode is "the warning doesn't appear" — never "navigation is broken".

import { useEffect } from 'react';

/** Is this click one the browser will treat as a plain in-app navigation? A modified
 *  click (new tab, download, external target) leaves the studio mounted, so warning
 *  about it would be a false alarm. */
function isPlainNavigation(e: MouseEvent): boolean {
  return !(
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  );
}

/** The same-origin, in-app destination this click leads to, or null when it isn't a
 *  navigation we should guard (external link, new tab, download, same page). */
function navigationTarget(e: MouseEvent): HTMLAnchorElement | null {
  if (!isPlainNavigation(e)) return null;
  const anchor = (e.target as Element | null)?.closest?.('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  if (anchor.origin !== window.location.origin) return null;
  // An in-page anchor or a link back to the studio itself isn't leaving.
  if (anchor.pathname === window.location.pathname) return null;
  return anchor;
}

export interface UnpublishedGuardOptions {
  /** Whether there is unpublished work — the guard is inert when false. */
  active: boolean;
  /** Resolves true to proceed with the navigation, false to stay. Runs the confirm
   *  dialog; kept as a callback so the copy lives with the surface that owns it. */
  confirmLeave: () => Promise<boolean>;
}

/** Warn before an in-app navigation away from unpublished work. Pair with the
 *  studio's own `beforeunload` handler, which covers closing/reloading the tab. */
export function useUnpublishedGuard({ active, confirmLeave }: UnpublishedGuardOptions): void {
  useEffect(() => {
    if (!active) return;

    const onClick = (e: MouseEvent) => {
      const anchor = navigationTarget(e);
      if (!anchor) return;
      // Stop THIS click, then re-issue the navigation if the author confirms. The
      // dialog is async and a click is not, so there is no way to "hold" it.
      e.preventDefault();
      e.stopPropagation();
      const href = anchor.href;
      void confirmLeave().then((leave) => {
        if (leave) window.location.assign(href);
      });
    };

    // Capture phase: Next's <Link> handles click on the bubble phase, so a bubble
    // listener would fire after the router had already begun navigating.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, confirmLeave]);
}
