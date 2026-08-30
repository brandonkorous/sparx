'use client';

// Arriving somewhere: what the address bar ASKED for.
//
// This half reads the URL and nothing else. Whether the ask can be honoured is
// `deep-link-resolve`, and the per-tab guard against reload loops is
// `deep-link-switch`. The notes below are about the journey all three make.
//
// The workbench is an MDI, so a URL here cannot mean "show this page". It names
// ONE destination, which arrives as a pane on top of whatever the operator
// already had arranged. Nothing about the layout is in the address, and nothing
// in the address replaces the layout.
//
// Four things have to go right, and each used to be missed somewhere:
//
//   • BOTH PRESENTATIONS. This module is host-agnostic and is called by the dock
//     AND by the mobile stack. The resolution used to live inside the dock's
//     `onReady`, which meant every link opened on a phone silently did nothing —
//     the single largest hole, since a phone is where an emailed link is opened.
//   • THE SITE. A link crosses businesses (that is the point of pasting one into
//     a chat), so `?site=` is part of the address and the arrival gate switches
//     workspaces before opening rather than showing the right surface against the
//     wrong data.
//   • SAYING SO WHEN IT FAILS. An unknown path, a module this account doesn't
//     have, a business this person can't reach — each opens the
//     `platform.link.unresolved` pane, which is a pane like any other: closable,
//     survivable, and able to explain itself. Doing nothing was the old answer to
//     all three.
//   • SURVIVING THE REMOUNT. React strict mode mounts, unmounts and remounts the
//     host, and `hydrate()` clears the controller in between — so the pane opened
//     on the first pass is gone by the second. The intent is therefore captured
//     ONCE at module scope and re-applied on every attach, which is idempotent
//     because `controller.open` focuses an already-open match instead of
//     duplicating it. (The previous implementation used a five-second timer to
//     retire the intent, which raced the boot on any session where resolving the
//     active site took longer than that.)

import { matchPath, normalizePath, SITE_PARAM } from '@wizeworks/links';
import type { SurfaceParams } from '../surfaces/descriptor';
import { decodeDescriptor } from '../surfaces/descriptor';

/** Why a link could not be honoured. Mirrored by the unresolved-link surface. */
export type UnresolvedReason =
  /** No route in the address table matches — a typo, or a link from a build that had a surface we no longer do. */
  | 'unknown-path'
  /** The surface exists but this account does not have that module turned on. */
  | 'module-disabled'
  /** The module is on, but this person's access does not reach it. */
  | 'no-access'
  /** The link named a business this person cannot open. */
  | 'site-unavailable';

export const UNRESOLVED_SURFACE = 'platform.link.unresolved';

export interface DeepLinkTarget {
  readonly surface: string;
  readonly params?: SurfaceParams;
}

/** What the address bar asked for, before we know whether it can be honoured. */
export interface DeepLink {
  readonly targets: readonly DeepLinkTarget[];
  /** `?site=` exactly as written — a slug, or an id. */
  readonly site?: string;
  /** The path, when it matched no route. Shown back to the operator verbatim. */
  readonly unknownPath?: string;
  /**
   * The address this link arrived on, path + search, exactly as captured.
   *
   * Held because honouring a cross-business link means RELOADING, and the thing
   * that has to survive that reload is the link — not "whatever is in the
   * address bar when the reload fires". Those two diverged: the history bridge
   * replaces the bar with the restored layout's focused pane a beat after boot,
   * which is BEFORE the site list has landed and the switch can be decided. So
   * the switch used to reload onto the arrangement's address instead of the
   * link's, land under the other business, read that address as a link back to
   * the one just left, and switch again — a reload loop alternating between two
   * businesses, which the single-slot attempt guard could never see.
   */
  readonly href: string;
}

/** How the deep link should be honoured, once site and module gates have spoken. */
export type ResolvedDeepLink =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'open'; readonly targets: readonly DeepLinkTarget[] }
  /** The link belongs to another business this person CAN open — switch, then arrive. */
  | { readonly kind: 'switch-site'; readonly siteId: string }
  | {
      readonly kind: 'unresolved';
      readonly reason: UnresolvedReason;
      /** What the link said, for the pane to show back. */
      readonly detail: string;
    };

/* ── Capture ─────────────────────────────────────────────────────────────── */

let captured: DeepLink | null = null;
let hasCaptured = false;

/**
 * The intent this page load arrived with, captured once.
 *
 * Module scope rather than a ref, because it must outlive the host component:
 * strict mode remounts it, and the desktop⇄compact swap replaces it outright.
 * Reading the address again on the second pass would be wrong anyway — by then
 * the address bar may already be tracking the focused pane.
 *
 * `address` is the address THE SERVER MATCHED for this render (see
 * app/workbench-entry.tsx), and it is the authority. `window.location` is only
 * the fallback for a caller that has none. They agree on a cold load and differ
 * in exactly the case that used to break: signing in navigates client-side, so
 * the shell's first render happens while the bar still reads `/sign-in` — which
 * was captured as a link, matched no route, and greeted every successful
 * sign-in with "that link doesn't work". Worse, that pane then persisted into
 * the layout and re-wrote the bar to `/link-not-found?…` on every load
 * thereafter.
 */
export function readDeepLink(address?: string): DeepLink | null {
  if (hasCaptured) return captured;
  // NOT captured on the server. The shell is server-rendered for the first
  // paint, so an early call happens with no `window` — marking that as "captured
  // nothing" would poison the real read a moment later and every link would be
  // lost. The flag is only set once there is an address to read. (Module scope is
  // shared across requests on the server, so capturing there would leak one
  // visitor's link into the next one's boot regardless.)
  if (typeof window === 'undefined') return null;
  hasCaptured = true;

  // PURE. This runs from the shell's render body, because the address has to be
  // read before the history bridge starts replacing it with the focused pane's —
  // and a render must not have side effects. The one mutation this used to do
  // (stripping the legacy `?open=` out of the bar) is now `tidyLegacyParams()`,
  // called from an effect.
  const url = new URL(address ?? window.location.href, window.location.origin);
  const targets: DeepLinkTarget[] = [];
  let unknownPath: string | undefined;
  let site = url.searchParams.get(SITE_PARAM) ?? undefined;

  // The legacy form: `?open=<surface>?<k>=<v>`, repeatable. Still honoured
  // because links already sent carry it, though nothing emits it any more.
  const legacy = url.searchParams.getAll('open');
  for (const encoded of legacy) {
    const descriptor = decodeDescriptor(encoded);
    if (descriptor) targets.push({ surface: descriptor.surface, params: descriptor.params });
  }

  const path = normalizePath(url.pathname);
  if (path !== '/') {
    const matched = matchPath(path, url.searchParams);
    if (matched) {
      targets.push({ surface: matched.surface, params: matched.params });
      site ??= matched.site;
    } else if (targets.length === 0) {
      // Only a bare unknown path is an error. A recognised `?open=` alongside an
      // unknown path is still a working link.
      unknownPath = path;
    }
  }

  if (targets.length === 0 && unknownPath === undefined) {
    captured = null;
    return null;
  }
  // Without `open`: the legacy parameter is a one-shot intent, and this href is
  // replayed by a site switch. Carrying it across would re-fire the same open on
  // the far side of the reload — harmless (controller.open focuses a match) but
  // it would also put a spent parameter back in a bar tidyLegacyParams just
  // cleared.
  url.searchParams.delete('open');
  captured = {
    targets,
    ...(site === undefined ? {} : { site }),
    ...(unknownPath === undefined ? {} : { unknownPath }),
    href: `${url.pathname}${url.search}`,
  };
  return captured;
}

/**
 * Strip the legacy `?open=` out of the address bar, once, after mount.
 *
 * A one-shot intent must not sit in the bar advertising itself as durable state —
 * but rewriting history is a side effect, and `readDeepLink` is called from a
 * render. Splitting the two is what keeps that read pure. Safe to call more than
 * once: with no `open` parameter left, it does nothing.
 */
export function tidyLegacyParams(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('open')) return;
  url.searchParams.delete('open');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Test seam — the capture is process-wide, so it has to be resettable. */
export function resetDeepLinkCapture(): void {
  captured = null;
  hasCaptured = false;
}
