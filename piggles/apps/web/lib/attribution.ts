'use client';

// Where a visitor came from, remembered here and handed over at the door.
//
// ── THE TWO HALVES, AND WHY BOTH ARE NEEDED ─────────────────────────────────
//
// 1. A COOKIE ON THIS DOMAIN. Somebody clicks an ad on Tuesday, reads the
//    pricing page, leaves, and signs up on Thursday from a bookmark. Only a
//    stored first touch survives that, and it is the common shape of a real
//    purchase rather than an edge case.
//
// 2. THE LINK. That cookie cannot cross to getpiggles.com — three registrable
//    domains, no shared cookie, the same fact that forces the auth handoff. So
//    at the moment somebody clicks "start free", what we know rides along in the
//    URL and the account app captures it first-party on arrival.
//
// Neither half works alone: without the cookie, attribution dies on a reload;
// without the link, it never reaches the app that creates the account.
//
// ── NOTHING HERE RUNS UNASKED ───────────────────────────────────────────────
//
// Everything below is registered through `gateTracker` and stays dormant until
// the visitor accepts. Ad click ids need a second, separate grant — a `gclid`
// identifies one specific ad click, which is a different question from "which
// campaign", and a single yes should not answer both.

import {
  attrCookies,
  attrCookieString,
  captureTouch,
  deserializeSnapshot,
  resolveFirstTouch,
  resolveLastTouch,
  serializeSnapshot,
  type AttributionSnapshot,
} from '@wizeworks/attribution';
import { getConsent } from './consent';

/** Piggles' own names. Fixed forever — a rename silently discards the recorded
 *  first touch of everyone who already carries one. */
export const PIGGLES_ATTR = attrCookies('piggles');

/** The query parameter the payload rides to getpiggles.com in. Short because it
 *  sits in a URL people see and occasionally paste. */
export const ATTR_PARAM = 'a';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function cookieDomain(): string | undefined {
  const host = window.location.hostname;
  return host === 'meetpiggles.com' || host.endsWith('.meetpiggles.com')
    ? '.meetpiggles.com'
    : undefined;
}

function write(name: string, value: string): void {
  document.cookie = attrCookieString(name, value, {
    domain: cookieDomain(),
    secure: window.location.protocol === 'https:',
  });
}

/**
 * Record this landing. Called once per page view, only with permission.
 *
 * First touch is set ONCE and never revised — the channel that first brought
 * somebody in is the one credited, however many times they come back. Last touch
 * follows last-non-direct: a bare return visit with no campaign and no referrer
 * leaves the previously attributed source alone rather than overwriting it with
 * "direct", which would quietly credit every campaign to nobody.
 */
export function recordTouch(): void {
  const consent = getConsent();
  const touch = captureTouch({
    url: window.location.href,
    referrer: document.referrer || null,
    userAgent: navigator.userAgent,
    capturedAt: new Date().toISOString(),
    // Click ids only with the second grant. Without it the touch still carries
    // the campaign — which ad group, not which click.
    allowMarketing: consent?.marketing === true,
  });

  const first = resolveFirstTouch(deserializeSnapshot(readCookie(PIGGLES_ATTR.first)), touch);
  const last = resolveLastTouch(deserializeSnapshot(readCookie(PIGGLES_ATTR.last)), touch);
  write(PIGGLES_ATTR.first, serializeSnapshot(first));
  write(PIGGLES_ATTR.last, serializeSnapshot(last));
}

/** What is currently known, or null when nothing has been recorded. */
export function currentAttribution(): {
  first: AttributionSnapshot;
  last: AttributionSnapshot;
} | null {
  const first = deserializeSnapshot(readCookie(PIGGLES_ATTR.first));
  const last = deserializeSnapshot(readCookie(PIGGLES_ATTR.last));
  if (!first) return null;
  return { first, last: last ?? first };
}

/**
 * The payload for the link across to getpiggles.com.
 *
 * Base64url so it survives a URL intact and does not invite hand-editing.
 * It is NOT signed and must never be trusted: the account app re-validates
 * everything and treats the whole thing as a hint, because anything in a query
 * string is editable by whoever holds the link.
 */
export function encodeForHandoff(): string | null {
  const current = currentAttribution();
  if (!current) return null;
  try {
    const json = JSON.stringify({ first: current.first, last: current.last });
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    // A payload that will not encode is dropped rather than half-sent. The
    // coarse `from=` hint still travels, so the link keeps working.
    return null;
  }
}
