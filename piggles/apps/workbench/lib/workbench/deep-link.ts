'use client';

// Arriving somewhere — the whole journey from a URL to an open pane.
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
import { getSurface } from '../surfaces/registry';
import type { WorkbenchController } from './controller';

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

/* ── The switch guard ────────────────────────────────────────────────────── */

const SWITCH_ATTEMPT_KEY = 'piggles-console-link-switch';

/** Every site this tab has already reloaded trying to reach. */
function readSwitchAttempts(): string[] {
  try {
    const raw = sessionStorage.getItem(SWITCH_ATTEMPT_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    // A single id is what the previous shape wrote — read it so a tab already
    // open across the upgrade keeps its guard rather than losing it.
    if (typeof parsed === 'string') return [parsed];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    // Blocked storage, or a value that predates JSON (the bare site id). Either
    // way there is nothing we can trust, and the caller treats an empty list as
    // "not attempted" — which is safe only because noteSwitchAttempt refuses to
    // switch at all when it cannot write.
    return [];
  }
}

/**
 * Remembers that we already reloaded once trying to reach this site.
 *
 * Switching workspaces is a cookie write plus a reload, and api-rest re-resolves
 * that cookie under RLS and FAILS CLOSED to the tenant's primary site. So a link
 * naming a site the session cannot actually hold would switch, come back on the
 * primary, see the mismatch, and switch again — a reload loop with no way out
 * except closing the tab. One attempt per site is allowed; the second time the
 * same site is asked for, the link is reported unreachable instead.
 *
 * A SET, not the last id. Remembering only the most recent attempt reads every
 * A → B → A alternation as three first attempts and never fires, which is
 * exactly the loop that shipped: two businesses trading the tab back and forth
 * roughly once a second until api-rest rate-limited it. What makes a loop a loop
 * is revisiting a state, so the guard has to remember every state visited.
 *
 * sessionStorage rather than memory, because the reload is precisely what
 * destroys memory. Per-tab, so another tab's attempt never suppresses this one's.
 */
export function noteSwitchAttempt(siteId: string): boolean {
  try {
    const attempts = readSwitchAttempts();
    if (!attempts.includes(siteId)) attempts.push(siteId);
    sessionStorage.setItem(SWITCH_ATTEMPT_KEY, JSON.stringify(attempts));
    return true;
  } catch {
    // Storage blocked, so there is nowhere to record that we tried — and the
    // reload is about to destroy memory. WE MUST NOT SWITCH: an unrecorded
    // attempt is an attempt that repeats forever, because the next load has no
    // way to know it already happened. Reporting the link as unreachable is a
    // dead end for one link; switching without a guard is a dead end for the
    // whole tab. Fail safe, not eager.
    return false;
  }
}

export function switchAlreadyAttempted(siteId: string): boolean {
  return readSwitchAttempts().includes(siteId);
}

/**
 * Clears the guard once we have actually landed on the site the link named.
 *
 * ONLY once the SITE gate has passed. Clearing it when the guard has just FIRED —
 * when the answer was "that site is unreachable" — disarms the one thing standing
 * between a failed switch and an infinite reload loop: the next document load
 * would try the same switch again, fail the same way, clear the guard again.
 * That is not hypothetical; it shipped, and it alternated the address bar
 * between the link and the unresolved pane until the tab was closed.
 *
 * Passing the site gate is the whole test, though — NOT opening a pane. A link
 * that reaches the right business and is then refused by the module gate has
 * still proved the switch worked, so leaving the attempt on the record would
 * strand the tab: a second link to that same business, minutes later, would be
 * reported unreachable when nothing about it is.
 */
export function clearSwitchAttempt(): void {
  try {
    sessionStorage.removeItem(SWITCH_ATTEMPT_KEY);
  } catch {
    // See above.
  }
}

/* ── Resolution ──────────────────────────────────────────────────────────── */

/** A module's activation state, as the shell already knows it. */
export interface ModuleGate {
  /** `null` while the module list is still loading — treated as "allow". */
  readonly states: readonly { slug: string; enabled: boolean; reachable?: boolean }[] | null;
}

export interface SiteGate {
  /** The site the window is currently operating under. */
  readonly activeSiteId: string | null;
  /** Every site this person can open. `null` while loading. */
  readonly sites: readonly { id: string; slug: string }[] | null;
}

/**
 * Whether a surface may be opened, and if not, why.
 *
 * The nav hides modules an account doesn't have; a deep link bypasses the nav
 * entirely, so the same two gates have to be applied here or a link opens a pane
 * onto an endpoint that will refuse it. Unknown modules are allowed through —
 * a slug the activation list has never heard of has no flag to be disabled by,
 * which is the same rule `moduleIsVisible` uses.
 */
function gateSurface(surface: string, modules: ModuleGate): 'ok' | 'module-disabled' | 'no-access' {
  const definition = getSurface(surface);
  if (!definition) return 'ok'; // handled as unknown-path upstream
  // The workbench itself can never be switched off — settings and the team
  // screen are how a wrong restriction gets fixed.
  if (definition.module === 'platform') return 'ok';
  const states = modules.states;
  if (!states) return 'ok';
  const state = states.find((candidate) => candidate.slug === definition.module);
  if (!state) return 'ok';
  if (!state.enabled) return 'module-disabled';
  if (state.reachable === false) return 'no-access';
  return 'ok';
}

/**
 * Turn a captured link into a decision.
 *
 * Order matters and is not arbitrary: the SITE is settled first, because a
 * module gate answered against the wrong business is meaningless — an account
 * can have Selling on for one site's tenant and the link may belong to another
 * entirely. Only once we know we are in the right workspace do we ask whether
 * the surface can be opened.
 *
 * Returns `nothing` while the gates are still loading, so the caller simply
 * tries again on the next attach rather than deciding on incomplete facts.
 */
export function resolveDeepLink(
  link: DeepLink | null,
  site: SiteGate,
  modules: ModuleGate,
  alreadyAttempted: (siteId: string) => boolean = switchAlreadyAttempted
): ResolvedDeepLink {
  if (!link) return { kind: 'nothing' };

  if (link.site !== undefined && link.site !== '') {
    if (!site.sites) return { kind: 'nothing' }; // still loading — ask again
    // And the site we are ON has to be settled too. Comparing the link against a
    // site key that is still null (booting) or the `default` placeholder (the
    // sites query failed) can only ever report a mismatch, and a mismatch here
    // costs a reload — so an unsettled key must mean "ask again", never "switch".
    // The two facts arrive from independent queries; only one of them being
    // ready is not enough to make this decision.
    if (site.activeSiteId === null || site.activeSiteId === 'default') {
      return { kind: 'nothing' };
    }
    const named = site.sites.find(
      (candidate) => candidate.slug === link.site || candidate.id === link.site
    );
    if (!named) return { kind: 'unresolved', reason: 'site-unavailable', detail: link.site };
    if (named.id !== site.activeSiteId) {
      // Second time asking for the same site means the switch did not stick —
      // api-rest failed the cookie closed. Say so instead of reloading forever.
      if (alreadyAttempted(named.id)) {
        return { kind: 'unresolved', reason: 'site-unavailable', detail: link.site };
      }
      return { kind: 'switch-site', siteId: named.id };
    }
  }

  if (link.unknownPath !== undefined) {
    return { kind: 'unresolved', reason: 'unknown-path', detail: link.unknownPath };
  }

  const allowed: DeepLinkTarget[] = [];
  for (const target of link.targets) {
    if (!getSurface(target.surface)) {
      return { kind: 'unresolved', reason: 'unknown-path', detail: target.surface };
    }
    const verdict = gateSurface(target.surface, modules);
    if (verdict !== 'ok') {
      return { kind: 'unresolved', reason: verdict, detail: target.surface };
    }
    allowed.push(target);
  }

  return allowed.length > 0 ? { kind: 'open', targets: allowed } : { kind: 'nothing' };
}

/* ── Application ─────────────────────────────────────────────────────────── */

/**
 * Open what the link asked for, on top of the restored layout.
 *
 * `open`, never `replace` — the pane JOINS the arrangement rather than wiping
 * it, which is the difference between a link that adds a thing to your workbench
 * and one that takes your workbench away. `controller.open` focuses an
 * already-open match instead of duplicating, which is also what makes calling
 * this more than once harmless.
 */
export function applyDeepLink(controller: WorkbenchController, resolved: ResolvedDeepLink): void {
  if (resolved.kind === 'open') {
    for (const target of resolved.targets) {
      controller.open(target.surface, target.params, { focus: true });
    }
    return;
  }
  if (resolved.kind === 'unresolved') {
    controller.open(UNRESOLVED_SURFACE, { reason: resolved.reason, detail: resolved.detail });
  }
}
