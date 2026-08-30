'use client';

// Can this link be honoured, and what happens when it is.
//
// Separated from the capture because it needs things the capture must not: the
// surface registry, the module gates and the controller. Reading the address bar
// stays a pure string job.

import { getSurface } from '../surfaces/registry';
import type { WorkbenchController } from './controller';
import {
  UNRESOLVED_SURFACE,
  type DeepLink,
  type DeepLinkTarget,
  type ResolvedDeepLink,
} from './deep-link';
import { switchAlreadyAttempted } from './deep-link-switch';

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
