import { deserializeSnapshot, type AttributionSnapshot } from '@wizeworks/attribution';
import type { SignUpAcquisition } from '@wizeworks/auth';

// First-touch attribution, carried across a registrable-domain boundary.
//
// meetpiggles.com cannot set a cookie that getpiggles.com can read, so the
// marketing site records what it knows on its own domain (with permission) and
// serialises it into the signup link at click time. This app captures it
// first-party on arrival. Nothing third-party is involved.
//
// Two things arrive, and they answer different questions:
//
//   `from` — a coarse placement label. Which page and which block was clicked.
//            Always present, needs no consent, and is what the link carried
//            before any of the rest of this existed.
//   `a`    — the full payload: campaign, medium, referrer, channel, click ids,
//            first touch and last touch. Present only when the visitor accepted.
//
// ── EVERYTHING HERE IS UNTRUSTED ────────────────────────────────────────────
//
// A query string is visible, editable and shareable. Someone can paste anything
// into it, and someone sharing a link they were sent passes their own context to
// a stranger. So this validates rather than parses: unknown placements are
// dropped, strings are bounded, and a payload that will not decode is treated as
// absent rather than as a reason to fail a signup. The worst case a bad value
// can produce is one wrong row in a marketing report — but attribution is
// written ONCE, at provisioning, with no later correction pass, so a wrong value
// is permanent for that tenant and the bar is set accordingly.

const MAX_LEN = 64;
/** Bounds the decoded payload. Real snapshots are well under a kilobyte; the
 *  limit exists so a hand-crafted link cannot make this app parse megabytes. */
const MAX_PAYLOAD = 4096;

/** Placements the marketing site actually emits. Anything else is dropped
 *  rather than stored: this value ends up denormalised onto the tenant row and
 *  read by acquisition reporting, so an attacker-chosen string in a report is a
 *  real (if small) problem, and a typo is a permanent bad row. */
const KNOWN_PREFIXES = ['home-', 'apps-', 'app-', 'pricing-', 'trust-', 'header'];

function placement(from: string | null | undefined): string | null {
  if (!from) return null;
  const value = from.trim().slice(0, MAX_LEN);
  if (!value) return null;
  return KNOWN_PREFIXES.some((prefix) => value.startsWith(prefix)) ? value : null;
}

/** Decode the base64url payload the marketing site attached. Null on anything
 *  malformed, oversized or not shaped like a pair of snapshots. */
function decodePayload(
  raw: string | null | undefined
): { first: AttributionSnapshot; last: AttributionSnapshot } | null {
  if (!raw || raw.length > MAX_PAYLOAD) return null;
  try {
    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    if (json.length > MAX_PAYLOAD) return null;
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== 'object') return null;
    const { first, last } = value as { first?: unknown; last?: unknown };
    const firstSnapshot = deserializeSnapshot(
      typeof first === 'string' ? first : JSON.stringify(first)
    );
    const lastSnapshot = deserializeSnapshot(
      typeof last === 'string' ? last : JSON.stringify(last)
    );
    if (!firstSnapshot) return null;
    return { first: firstSnapshot, last: lastSnapshot ?? firstSnapshot };
  } catch {
    return null;
  }
}

/** Trim a value to what the tenant columns hold, or null. */
function bounded(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

/**
 * What to record against the new tenant.
 *
 * The full payload wins where it exists, because it says which campaign brought
 * somebody in rather than merely which button they pressed. The placement is
 * kept as the source when there is no payload — that is the visitor who declined
 * the cookie, and a coarse answer is still better than none.
 *
 * `channel` is the classified channel (`paid-search`, `organic`, `referral`, …)
 * computed on the marketing site from the UTMs, click ids and referrer — never
 * invented here.
 */
export function acquisitionFrom(
  from: string | null | undefined,
  payload?: string | null
): SignUpAcquisition | null {
  const decoded = decodePayload(payload);
  const where = placement(from);

  if (decoded) {
    const { first, last } = decoded;
    return {
      channel: bounded(first.channel, 50),
      // The campaign's own source (`google`, `newsletter`) when there is one,
      // falling back to the placement so the field is never empty for a visit
      // that plainly came from somewhere.
      source: bounded(first.source, 255) ?? where,
      campaign: bounded(first.campaign, 255),
      firstTouch: first,
      lastTouch: last,
    };
  }

  if (!where) return null;

  return {
    // The marketing site is the channel; the placement is the source. Campaign
    // stays null — nothing measured one, and inventing a value here would make
    // an empty report look like a measured one.
    channel: 'marketing-site',
    source: where,
    campaign: null,
    firstTouch: null,
    lastTouch: null,
  };
}
