import { deserializeSnapshot, type AttributionSnapshot } from '@wizeworks/attribution';
import type { SignUpAcquisition } from '@wizeworks/auth';

// First-touch attribution, carried across the domain boundary in the signup link:
// `from` (which button; always present, needs no consent) and `a` (the full
// payload, only when the visitor accepted). Both are untrusted query strings.

const MAX_LEN = 64;
/** Real snapshots are well under a kilobyte; this stops a crafted link making us parse megabytes. */
const MAX_PAYLOAD = 4096;

/** Placements the marketing site emits (`accountUrl('signup', …)` in piggles/apps/web).
 *  Anything else is dropped: it lands on the tenant row once and is never corrected. */
const KNOWN_PREFIXES = [
  'header',
  'footer',
  'home-',
  'apps-',
  'app-',
  'pricing-',
  'trust-',
  'about-',
  'compare',
  'who-',
  'how-',
  'faq',
  'switching',
  'whats-new',
  'what-connects',
  'for-',
  'tools-',
  'tool-',
  'frontrow-',
];

/** A page that exists for one campaign names it, so a signup from there carries
 *  the campaign even when the visitor declined cookies. */
const PLACEMENT_CAMPAIGNS: [prefix: string, campaign: string][] = [
  ['frontrow-', 'frontrow-2026-10'],
];

function placement(from: string | null | undefined): string | null {
  const value = from?.trim().slice(0, MAX_LEN) ?? '';
  if (!/^[a-z0-9-]+$/.test(value)) return null;
  return KNOWN_PREFIXES.some((prefix) => value.startsWith(prefix)) ? value : null;
}

function placementCampaign(where: string | null): string | null {
  if (!where) return null;
  return PLACEMENT_CAMPAIGNS.find(([prefix]) => where.startsWith(prefix))?.[1] ?? null;
}

function snapshotOf(value: unknown): AttributionSnapshot | null {
  return deserializeSnapshot(typeof value === 'string' ? value : JSON.stringify(value));
}

/** Decode the base64url payload. Null on anything malformed, oversized or not
 *  shaped like a pair of snapshots: a bad payload never fails a signup. */
function decodePayload(
  raw: string | null | undefined
): { first: AttributionSnapshot; last: AttributionSnapshot } | null {
  if (!raw || raw.length > MAX_PAYLOAD) return null;
  try {
    const json = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    if (json.length > MAX_PAYLOAD) return null;
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== 'object') return null;
    const { first, last } = value as { first?: unknown; last?: unknown };
    const firstSnapshot = snapshotOf(first);
    if (!firstSnapshot) return null;
    return { first: firstSnapshot, last: snapshotOf(last) ?? firstSnapshot };
  } catch {
    return null;
  }
}

/** Trim a value to what the tenant columns hold, or null. */
function bounded(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim().slice(0, max) ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * What to record against the new tenant. The payload wins where it exists (which
 * campaign, not just which button); the placement is the source for a visitor
 * who declined, and names the campaign when its page belongs to one.
 */
export function acquisitionFrom(
  from: string | null | undefined,
  payload?: string | null
): SignUpAcquisition | null {
  const decoded = decodePayload(payload);
  const where = placement(from);
  const pageCampaign = placementCampaign(where);

  if (decoded) {
    const { first, last } = decoded;
    return {
      channel: bounded(first.channel, 50),
      source: bounded(first.source, 255) ?? where,
      campaign: bounded(first.campaign, 255) ?? pageCampaign,
      firstTouch: first,
      lastTouch: last,
    };
  }

  if (!where) return null;
  // Campaign stays null unless the page names one: an invented value would make
  // an empty report look measured.
  return {
    channel: 'marketing-site',
    source: where,
    campaign: pageCampaign,
    firstTouch: null,
    lastTouch: null,
  };
}
