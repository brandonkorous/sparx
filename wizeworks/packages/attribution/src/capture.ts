/**
 * Browser/edge-agnostic capture logic (docs/80 §5). Pure functions that operate
 * on plain strings (a URL, a referrer, existing cookie values) so the same code
 * runs in a Next middleware (edge), a client component (browser), and tests.
 * The host app owns cookie I/O and consent; this module owns the math:
 * build a touch, apply set-once first-touch + last-non-direct last-touch.
 */
import type { AttributionSnapshot, ClickIds } from './types';
import { classify } from './classify';
import { normalizeToken } from './taxonomy';

export interface AttrCookieNames {
  /** Set-once first-touch snapshot. */
  first: string;
  /** Last-non-direct last-touch snapshot. */
  last: string;
  /** Anonymous visitor id (minted at the edge). */
  visitor: string;
  /** Partner referral code (docs/114 §B.3). Set-once, 30-day window: the FIRST
   *  partner to send a visitor gets the credit. */
  ref: string;
}

/**
 * First-party cookie names for one brand (docs/80 §5.3).
 *
 * ── WHY THIS IS A FACTORY AND NOT A CONSTANT ────────────────────────────────
 *
 * It was `{ first: 'sparx_attr_first', … }`, a hardcoded constant in a package
 * that is supposed to be brand-blind. Nothing broke while sparx was the only
 * product; the moment a second brand used it, a visitor to meetpiggles.com would
 * have got a cookie called `sparx_attr_first` — visible in devtools, listed on a
 * cookie policy, naming a company they have never heard of.
 *
 * Cookie names are also permanent in a way most strings are not: one already set
 * in somebody's browser stays until it expires, so a rename is a silent loss of
 * everyone's existing attribution. Each brand therefore names its own and keeps
 * that name forever. sparx passes `'sparx'`, which reproduces exactly what its
 * visitors already carry.
 */
export function attrCookies(prefix: string): AttrCookieNames {
  return {
    first: `${prefix}_attr_first`,
    last: `${prefix}_attr_last`,
    visitor: `${prefix}_attr_vid`,
    ref: `${prefix}_ref`,
  };
}

/** Days the referral cookie lives (the docs/114 §B.3 attribution window). */
export const REF_WINDOW_DAYS = 30;

/** Extract + sanitize a `?ref=` partner code from a landing URL. Codes are the
 *  minted 10-char A–Z2–9 form; we uppercase, strip anything else, and require a
 *  minimum length so a stray `?ref=` never writes a junk cookie. Null on none. */
export function readRefCode(url: string): string | null {
  try {
    const raw = new URL(url).searchParams.get('ref');
    if (!raw) return null;
    const code = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 32);
    return code.length >= 4 ? code : null;
  } catch {
    return null;
  }
}

const CLICK_ID_KEYS: readonly (keyof ClickIds)[] = [
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'ttclid',
  'li_fat_id',
  'msclkid',
];

export interface CaptureContext {
  /** The full landing URL, including query string. */
  url: string;
  /** document.referrer (a full URL) or null. */
  referrer?: string | null;
  userAgent?: string | null;
  /** ISO timestamp — supplied by the caller (edge/server clock), never read here. */
  capturedAt: string;
  /** Whether `marketing` consent is granted; gates ad click-id capture (docs/80 §5.5). */
  allowMarketing?: boolean;
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Referrer reduced to `host/path`, lowercased, trailing slash trimmed — PII-light. */
function referrerKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Build a touch snapshot from raw request inputs. Pure. */
export function captureTouch(ctx: CaptureContext): AttributionSnapshot {
  let params = new URLSearchParams();
  let landingPath: string | null = null;
  try {
    const u = new URL(ctx.url);
    params = u.searchParams;
    landingPath = u.pathname;
  } catch {
    /* leave defaults */
  }

  const read = (key: string): string | null => {
    const value = params.get(key);
    return value ? normalizeToken(value) : null;
  };

  const source = read('utm_source');
  const medium = read('utm_medium');
  const campaign = read('utm_campaign');
  const term = read('utm_term');
  const content = read('utm_content');

  const clickIds: ClickIds = {};
  if (ctx.allowMarketing) {
    for (const key of CLICK_ID_KEYS) {
      const value = params.get(key);
      if (value) clickIds[key] = value;
    }
  }

  const channel = classify({
    source,
    medium,
    clickIds,
    referrerHost: hostOf(ctx.referrer),
    userAgent: ctx.userAgent ?? null,
  });

  return {
    source,
    medium,
    campaign,
    term,
    content,
    channel,
    referrer: referrerKey(ctx.referrer),
    landingPath,
    clickIds,
    capturedAt: ctx.capturedAt,
  };
}

/**
 * A snapshot "carries channel context" when it's more than a bare direct hit —
 * i.e. it has a UTM source or a referrer. Used to enforce last-non-direct.
 */
export function hasChannelContext(snapshot: AttributionSnapshot): boolean {
  return snapshot.channel !== 'direct' || snapshot.source !== null || snapshot.referrer !== null;
}

/** First-touch is set once: keep the existing first-touch if one is already stored. */
export function resolveFirstTouch(
  existing: AttributionSnapshot | null,
  incoming: AttributionSnapshot
): AttributionSnapshot {
  return existing ?? incoming;
}

/**
 * Last-touch is last-non-direct: only overwrite when the incoming touch carries
 * channel context. A bare repeat visit (direct, no referrer) preserves the prior
 * attributed source (docs/80 §5.3, §9).
 */
export function resolveLastTouch(
  existing: AttributionSnapshot | null,
  incoming: AttributionSnapshot
): AttributionSnapshot {
  if (!existing) return incoming;
  return hasChannelContext(incoming) ? incoming : existing;
}

export function serializeSnapshot(snapshot: AttributionSnapshot): string {
  return JSON.stringify(snapshot);
}

/** Tolerant parse of a cookie value back into a snapshot; null on anything malformed. */
export function deserializeSnapshot(raw: string | null | undefined): AttributionSnapshot | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && 'channel' in value) {
      return value as AttributionSnapshot;
    }
    return null;
  } catch {
    return null;
  }
}

/** A fresh anonymous visitor id. Uses the platform `crypto.randomUUID` (edge + browser + Node 19+). */
export function newVisitorId(): string {
  return crypto.randomUUID();
}

export interface AttrCookieOptions {
  /** e.g. `.sparx.works` in prod; omit on localhost for a host-only cookie. */
  domain?: string;
  /** Default 400 days (Chrome's cap). */
  maxAgeDays?: number;
  /** Default true; set false on http localhost. */
  secure?: boolean;
}

/** Build a `Set-Cookie` value for an attribution cookie (SameSite=Lax, long-lived). */
export function attrCookieString(
  name: string,
  value: string,
  options: AttrCookieOptions = {}
): string {
  const { domain, maxAgeDays = 400, secure = true } = options;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.round(maxAgeDays * 86_400)}`,
    'SameSite=Lax',
  ];
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
