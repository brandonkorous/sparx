// First-party site analytics — ingestion helpers (docs/97 §5, docs/08).
//
// Cookieless + PII-free by construction. A visitor is a salted daily-rotating
// hash of (UTC date + tenant + client IP + user-agent); the IP is never stored
// and the hash cannot be carried across days. Sessions fold a 30-minute window
// into that hash. Obvious bots + Do-Not-Track are dropped before a row is
// written. Source is classified from the referrer host (search / social /
// referral / direct).

import { createHash } from 'node:crypto';

// The per-deploy salt mixed into every visitor hash so a hash can't be brute-
// forced back to an IP across tenants. A stable dev fallback keeps local hashing
// deterministic; prod sets SITE_ANALYTICS_SALT.
const SALT = process.env.SITE_ANALYTICS_SALT ?? 'sparx-dev-analytics-salt';
const SESSION_WINDOW_MS = 30 * 60 * 1000;

export type AnalyticsSource = 'search' | 'social' | 'referral' | 'direct' | 'email';

/** `utm_medium` value sparx puts on every tracked email link (kept in sync with
 *  `@wizeworks/email/silica`'s `EMAIL_UTM_MEDIUM`). A hit carrying it is classified
 *  `email`, ahead of any referrer-based class. */
const EMAIL_UTM_MEDIUM = 'email';

// Referrer-host fragments → source class. Substring match keeps the list short
// (e.g. "google." catches google.com / google.co.uk / news.google.com).
const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'baidu.', 'yandex.'];
const SOCIAL_HOSTS = [
  'facebook.',
  'instagram.',
  't.co',
  'twitter.',
  'x.com',
  'linkedin.',
  'pinterest.',
  'reddit.',
  'youtube.',
  'tiktok.',
  'threads.',
  'mastodon',
];

/** Bare host of a referrer URL, or null when it's absent/unparseable. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

/** Classify a hit's source. An explicit `utm_medium=email` (a click from one of the
 *  tenant's own sent emails, docs/impl transactional-email Slice 10) WINS over the
 *  referrer — mail clients routinely strip the referrer, so without this the click
 *  would misclassify as `direct` and the email would get no credit. Otherwise falls
 *  back to the referrer-host classification (same host as the site = direct). */
export function classifySource(
  refHost: string | null,
  selfHost: string | null,
  utmMedium?: string | null
): AnalyticsSource {
  if (utmMedium?.trim().toLowerCase() === EMAIL_UTM_MEDIUM) return 'email';
  if (!refHost) return 'direct';
  // Same host as the site itself = direct (selfHost null → never matches refHost).
  if (refHost === selfHost?.toLowerCase().replace(/^www\./, '')) return 'direct';
  if (SEARCH_HOSTS.some((h) => refHost.includes(h))) return 'search';
  if (SOCIAL_HOSTS.some((h) => refHost.includes(h))) return 'social';
  return 'referral';
}

/** Sanitize a `utm_campaign` for storage: trimmed, capped to the column width, null
 *  when empty. Only meaningful on an `email`-source hit. */
export function normalizeCampaign(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed.slice(0, 64);
}

/** Strip query/hash, collapse to a bounded, leading-slash path. */
export function normalizePath(raw: string): string {
  let path = raw.trim();
  const cut = Math.min(
    ...[path.indexOf('?'), path.indexOf('#')].filter((i) => i >= 0).concat([path.length])
  );
  path = path.slice(0, cut);
  if (!path.startsWith('/')) path = `/${path}`;
  // Drop a trailing slash (except the root) so "/shop" and "/shop/" fold together.
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path.slice(0, 2048);
}

// Conservative bot UA fragments — enough to drop the loud crawlers/monitors
// without false-positiving real browsers. Not a security control; a hint.
const BOT_FRAGMENTS = [
  'bot',
  'crawl',
  'spider',
  'slurp',
  'curl',
  'wget',
  'python-requests',
  'headless',
  'phantomjs',
  'monitor',
  'pingdom',
  'lighthouse',
  'gtmetrix',
  'facebookexternalhit',
  'preview',
];

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // no UA → almost always automated
  const ua = userAgent.toLowerCase();
  return BOT_FRAGMENTS.some((f) => ua.includes(f));
}

/** Do-Not-Track honored: header value "1" suppresses capture. */
export function isDoNotTrack(dnt: string | string[] | undefined): boolean {
  const v = Array.isArray(dnt) ? dnt[0] : dnt;
  return v === '1';
}

function sha(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** UTC date key (YYYY-MM-DD) the visitor hash rotates on. */
function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export interface VisitorIdentity {
  visitorHash: string;
  sessionHash: string;
}

/** Derive the daily visitor hash + the 30-minute session hash. The IP + UA are
 *  consumed here and never persisted. */
export function deriveVisitor(
  tenantId: string,
  ip: string,
  userAgent: string,
  now: Date
): VisitorIdentity {
  const day = utcDateKey(now);
  const visitorHash = sha(`${SALT}:${day}:${tenantId}:${ip}:${userAgent}`);
  const window = Math.floor(now.getTime() / SESSION_WINDOW_MS);
  const sessionHash = sha(`${visitorHash}:${window}`);
  return { visitorHash, sessionHash };
}
