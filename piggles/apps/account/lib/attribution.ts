import type { SignUpAcquisition } from '@sparx/auth';

// First-touch attribution, carried across a registrable-domain boundary.
//
// meetpiggles.com cannot set a cookie that getpiggles.com can read, so the
// marketing site serialises what it knows into the signup link at click time
// (`accountUrl('signup', 'home-hero')` in @piggles/config) and this app captures
// it first-party on arrival. Nothing third-party is involved, so there is
// nothing for a browser to block and nothing to ask consent for.
//
// WHAT IS AND IS NOT HERE. `from` is a coarse placement label — which page and
// which block the person clicked. It is deliberately not a full campaign
// payload: a query string is visible, editable and shareable, so it carries a
// hint rather than anything that must be trusted or kept private. Campaign and
// referrer detail belong in the richer client-side payload, which is not built
// yet — this is the half that works today and the reason the link shape already
// has a slot for it.
//
// Attribution is written ONCE, at provisioning. There is no later correction
// pass, so a wrong value here is permanent for that tenant.

const MAX_LEN = 64;

/** Placements the marketing site actually emits. Anything else is dropped
 *  rather than stored: this value ends up denormalised onto the tenant row and
 *  read by acquisition reporting, so an attacker-chosen string in a report is a
 *  real (if small) problem, and a typo is a permanent bad row. */
const KNOWN_PREFIXES = ['home-', 'apps-', 'app-', 'pricing-', 'trust-', 'header'];

export function acquisitionFrom(from: string | null | undefined): SignUpAcquisition | null {
  if (!from) return null;
  const value = from.trim().slice(0, MAX_LEN);
  if (!value) return null;
  if (!KNOWN_PREFIXES.some((p) => value.startsWith(p))) return null;

  return {
    // The marketing site is the channel; the placement is the source. Campaign
    // stays null — there are no campaigns yet, and inventing a value here would
    // make an empty report look like a measured one.
    channel: 'marketing-site',
    source: value,
    campaign: null,
    firstTouch: null,
    lastTouch: null,
  };
}
