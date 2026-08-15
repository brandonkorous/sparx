// The intent map — the binding answer to "which pose goes here".
//
// This file, not the catalog, is the API product code uses. A surface names the
// SITUATION it is in and gets the pose; it never names a pose directly and it
// certainly never names a file. That is the same single-point-of-change contract
// as the design tokens: re-cut the art, re-map an intent, and every screen
// follows with zero edits at the call sites.
//
// ── CHAINS, NOT ENTRIES ──────────────────────────────────────────────────────
//
// Each intent maps to an ORDERED chain of poses. Resolution takes the first one
// whose artwork exists, so a chain can name a pose that is still on the roadmap:
//
//     'no-results': ['searching', 'thinking']
//
// `searching` is not drawn yet, so today this resolves to `thinking`. The day the
// batch containing `searching` is ingested, every no-results state in the product
// upgrades itself — no edit here, no edit at any call site. That is what makes
// the roadmap in PLANNED_POSES useful rather than decorative.
//
// The type below enforces the part that matters: a chain may name any number of
// planned poses, but its LAST element must be a pose that actually ships. So an
// intent can never resolve to nothing, and `resolvePose` never returns undefined.
//
// ── WHAT IS DELIBERATELY MISSING ─────────────────────────────────────────────
//
// DESIGN.md: the mascot earns her keep in empty states, onboarding, success
// moments and 404s — and is never present during money, tax, payroll or deletion.
// Until now that has been prose nobody could enforce. Here it is structural:
// there is no intent for a deletion confirm, a failed payment, a past-due
// account, a tax filing, a payroll run, or a capacity block, so there is no way
// to put her in one without adding a line to this file and being asked why.
//
// The line to hold, when the next one is proposed: those are moments where a
// person is anxious about their own money or about losing something, and a
// cartoon pig at that moment reads as the software enjoying itself at the user's
// expense. An EMPTY Invoices list is not one of those moments — nobody is anxious
// about a list they have not filled in yet — which is why `invoices` and `money`
// appear below as empty states and nowhere else.

import type { AnyPoseId, MascotPose, MascotPoseId } from './catalog';
import { MASCOT_POSES, isAvailable } from './catalog';

/** An ordered fallback chain. Any number of not-yet-drawn poses, then one that
 *  ships — the tuple's fixed last element is what guarantees resolution. */
export type PoseChain = readonly [...AnyPoseId[], MascotPoseId];

/** Every situation the mascot is allowed to appear in. Closed on purpose — see
 *  the note above on what is missing and why. */
export type MascotIntent =
  // Arrival.
  | 'welcome'
  | 'sign-in'
  | 'onboarding'
  | 'onboarding-complete'
  // Outcome.
  | 'success'
  | 'milestone'
  // Guidance.
  | 'help'
  | 'tip'
  | 'callout'
  // Emptiness.
  | 'empty'
  | 'no-results'
  | 'quiet'
  // System.
  | 'not-found'
  | 'server-error'
  | 'maintenance'
  | 'loading'
  // Marketing.
  | 'hero';

export const MASCOT_INTENTS: Record<MascotIntent, PoseChain> = {
  welcome: ['wave'],
  // The usage matrix offers `laptop` or `desk` for sign-in. `laptop` is the
  // figure alone and composes against a form column; `desk` is a full scene and
  // wants the width of a split shell.
  'sign-in': ['laptop', 'desk'],
  onboarding: ['wave'],
  'onboarding-complete': ['celebrate'],

  success: ['thumbs-up', 'celebrate'],
  milestone: ['party-hat', 'celebrate'],

  help: ['support', 'thinking'],
  tip: ['thinking'],
  // Directional poses are the one case where the pose has to agree with the
  // layout: `point-left` only works with the thing being pointed at on its left.
  callout: ['point-left'],

  empty: ['neutral'],
  'no-results': ['searching', 'thinking'],
  // Nothing scheduled, nothing in the inbox, end of the day — an empty state that
  // is GOOD news rather than an unfinished setup, so she rests rather than waves.
  quiet: ['sleeping', 'neutral'],

  'not-found': ['404', 'thinking'],
  // A recoverable system fault — an import that failed, a page that would not
  // load. NOT a payment failure and NOT a security event; both are money or
  // trust, and both are plain and calm.
  'server-error': ['oops', 'concerned', 'thinking'],
  maintenance: ['maintenance', 'thinking'],
  loading: ['loading', 'neutral'],

  hero: ['desk'],
};

/** The app ids from `@piggles/config`, mirrored rather than imported.
 *
 *  The registry annotates `APPS` as `readonly PigglesAppDef[]`, which widens
 *  every `id` to `string` — so importing it would buy a runtime dependency and no
 *  type safety at all. Mirroring keeps this package a leaf and still catches a
 *  typo. An app added to the registry without a row here is not a hole: it falls
 *  through to `empty` in `mascotForApp`, which is the correct pose for it. */
export type MascotAppId =
  | 'home'
  | 'site'
  | 'content'
  | 'get_found'
  | 'sell'
  | 'stock'
  | 'customers'
  | 'messages'
  | 'bookings'
  | 'invoices'
  | 'money'
  | 'team'
  | 'automations'
  | 'partners'
  | 'connections';

/** The empty state of each app — the single most common place the mascot appears
 *  in the console, and the one most likely to drift into fifteen people each
 *  picking their favourite.
 *
 *  Every chain here except Bookings and Invoices currently falls through to a
 *  generic pose, because the batch that draws the domain props has not landed.
 *  That is the point of writing them out now: the chains are already correct, and
 *  ingesting the next batch is what makes fifteen empty states specific. */
export const MASCOT_BY_APP: Record<MascotAppId, PoseChain> = {
  home: ['sunrise', 'neutral'],
  site: ['site', 'laptop'],
  content: ['camera', 'laptop'],
  get_found: ['megaphone', 'thinking'],
  sell: ['product', 'neutral'],
  stock: ['stock', 'neutral'],
  customers: ['customer', 'neutral'],
  messages: ['message', 'neutral'],
  bookings: ['calendar'],
  invoices: ['invoice'],
  money: ['money', 'invoice'],
  team: ['high-five', 'neutral'],
  automations: ['automate', 'neutral'],
  partners: ['connection', 'neutral'],
  connections: ['connection', 'laptop'],
};

/** First pose in the chain whose artwork exists. Total by construction — the
 *  chain type requires a shipping pose at the end. */
export function resolveChain(chain: PoseChain): MascotPose {
  for (const id of chain) if (isAvailable(id)) return MASCOT_POSES[id];
  // Unreachable through the type. Kept because `catalog.ts` is generated: an
  // ingest that retired a pose without updating this file would otherwise fail
  // silently at runtime rather than at `pnpm typecheck`.
  throw new Error(`No available pose in chain: ${chain.join(' → ')}`);
}

export function resolveIntent(intent: MascotIntent): MascotPose {
  return resolveChain(MASCOT_INTENTS[intent]);
}

/** The empty-state pose for an app. Takes a bare string because the registry
 *  hands out bare strings; an unmapped app gets the generic empty pose. */
export function mascotForApp(appId: string): MascotPose {
  const chain = MASCOT_BY_APP[appId as MascotAppId];
  return resolveChain(chain ?? MASCOT_INTENTS.empty);
}
