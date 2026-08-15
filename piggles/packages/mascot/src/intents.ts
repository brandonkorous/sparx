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

// ── RE-MAPPED AGAINST THE 2026-08-15 ART, NOT RENAMED ───────────────────────
//
// The five batches were re-delivered with the real brand on them, and the
// rosters changed rather than the cuts: `wave`, `desk`, `laptop`, `neutral`,
// `thinking`, `point-left`, `invoice`, `calendar` and `celebrate` no longer
// exist as pose ids. Every chain below was re-decided by LOOKING at each of the
// fifty new poses and asking what the situation needs, which is why several of
// them do not land where a search-and-replace would have put them:
//
//   • `welcome` is `welcome-sign` — she waves AND holds a sign with an open door
//     on it. A bare wave is a greeting; a door is an invitation, and this intent
//     is the one on the way in.
//   • `callout` had to FLIP. The old `point-left` is gone and the new
//     `point-right` extends her arm to the VIEWER'S right, so the thing being
//     pointed at now has to sit on the right of the artwork. A directional pose
//     is the one place the art constrains the layout, and getting this backwards
//     draws attention to empty space.
//   • `not-found` and `no-results` share `no-results` (magnifier over an empty
//     tray) on purpose. She looked, and it is not there — which is true of both,
//     and truer than a shrug. `error` is kept for something that BROKE: the only
//     unhappy face in the set, and she is holding a wrench while wearing it.
//   • `tip` is `idea` (lightbulb) rather than a thinking pose. A tip is an offer,
//     not a hesitation.
//
// The chains are mostly single-element now. Under the old roster nine poses of
// forty-nine existed, so a chain was how a surface asked for art that had not
// been drawn; today all fifty exist and every intent resolves to the pose it
// actually wants. A chain still earns its keep where a second choice is
// genuinely better than nothing — see `sign-in` and `milestone`.
export const MASCOT_INTENTS: Record<MascotIntent, PoseChain> = {
  welcome: ['welcome-sign'],
  // `laptop-coffee`, not `laptop-focus`. Both are the same round table; the
  // difference is where she is looking. `laptop-focus` has her head down and
  // absorbed, which is a picture of somebody who has not noticed you came in.
  // `laptop-coffee` looks up, mug in hand, open smile — which is what a door
  // should do. `mascot-base` is the fallback because a plain wave still reads as
  // a greeting at any width.
  'sign-in': ['laptop-coffee', 'mascot-base'],
  // The setup screens are a short list of things to get through, and she is
  // holding exactly that: a pen and three ticked boxes.
  onboarding: ['checklist'],
  'onboarding-complete': ['cheerleader'],

  success: ['thumbs-up'],
  // A milestone is a business result, so it happens where the business happens:
  // arms up at the same desk as every other beat, with the chart on the laptop
  // lid. `cheerleader` is the louder, context-free version for anywhere the desk
  // would be too specific.
  milestone: ['desk-celebrate', 'cheerleader'],

  help: ['support'],
  tip: ['idea'],
  // See the note above: the arm extends to the VIEWER'S RIGHT, so this pose only
  // works with the thing being pointed at on its right.
  callout: ['point-right'],

  empty: ['empty'],
  'no-results': ['no-results'],
  // Nothing scheduled, nothing in the inbox, end of the day — an empty state that
  // is GOOD news rather than an unfinished setup, so she rests rather than waves.
  // `sidekick` is the one seated pose: cap on, hands down, waiting.
  quiet: ['sidekick'],

  'not-found': ['no-results'],
  // A recoverable system fault — an import that failed, a page that would not
  // load. NOT a payment failure and NOT a security event; both are money or
  // trust, and both are plain and calm.
  'server-error': ['error'],
  maintenance: ['maintenance'],
  loading: ['loading'],

  hero: ['laptop-coffee'],
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
 *  ── ALL FIFTEEN ARE SPECIFIC NOW ───────────────────────────────────────────
 *
 *  Twelve of these used to fall through to a generic pose, because the art that
 *  would have made them specific did not exist. It does. Every row below names a
 *  pose drawn for that job, and none of them falls through.
 *
 *  Where the roster offered a choice, the tie-break was WHOSE ACTION the empty
 *  state is about — the owner's or their customer's:
 *
 *    • `stock` is the shop shelf, not the packing bench. Stock is what you have
 *      left, which is a shelf; `shipping-station` is what you do to an order,
 *      which belongs to fulfilment rather than to counting.
 *    • `customers` is the front counter — somebody arriving and being greeted —
 *      rather than the headset, which is support answering a problem.
 *    • `get_found` is the magnifier, not the megaphone. Being found is somebody
 *      else searching and arriving; a megaphone is you shouting, which is what
 *      the marketing side of it looks like and not what the app is.
 *    • `site` is the monitor with a page layout on it, NOT the hard hat. A hard
 *      hat says "under construction" — a cliché, and the wrong claim: the site is
 *      not a building site and not a separate project, it is a page you look at.
 *      She is pointing at that page on the screen.
 *    • `invoices` takes the desk with the calculator on it and `money` takes the
 *      coin. Both are money and they are not the same money: one is a document
 *      you send, the other is the position you are in.
 *
 *  Ten of the fifteen sit at the same round table (batch 05) or are the figure
 *  alone (01/02), so the console keeps one visual system across the rail. The
 *  four that leave it — counter, shelf, meeting room, workbench — do so because
 *  the SETTING is the meaning, and a desk could not carry it. */
export const MASCOT_BY_APP: Record<MascotAppId, PoseChain> = {
  home: ['laptop-coffee'],
  site: ['desktop-computer'],
  content: ['tablet-desk'],
  get_found: ['analyst'],
  sell: ['orders-desk'],
  stock: ['retail-shop'],
  customers: ['front-counter'],
  messages: ['email-desk'],
  bookings: ['calendar-desk'],
  invoices: ['reports-desk'],
  money: ['money-minder'],
  team: ['meeting-table'],
  automations: ['maintenance'],
  partners: ['video-call'],
  connections: ['phone-desk'],
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
