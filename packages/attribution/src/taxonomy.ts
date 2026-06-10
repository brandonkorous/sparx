/**
 * The UTM taxonomy — the controlled vocabulary that keeps a channel from
 * fragmenting into `producthunt` / `PH` / `product_hunt` across reports
 * (docs/80 §4). This module is the single source of truth; new sources are
 * added HERE, never invented ad hoc in a link.
 */
import type { Channel } from './types';

/* ── utm_source (§4.2) ─────────────────────────────────────────────────────
 * The specific property a touch came from. A `partner-{name}` source is also
 * valid (the long tail of launch directories) — see {@link isValidSource}. */
export const UTM_SOURCES = [
  'product-hunt',
  'hacker-news',
  'reddit',
  'indie-hackers',
  'mcp-registry',
  'x',
  'linkedin',
  'youtube',
  'google',
  'bing',
  'meta',
  'tiktok',
  'newsletter',
  'sparxcms',
  'sparxcrm',
  'sparxemail',
  'sparxb2b',
] as const;
export type UtmSource = (typeof UTM_SOURCES)[number];

/* ── utm_medium (§4.3) — the channel class; what the classifier trusts. ──── */
export const UTM_MEDIUMS = [
  'organic-social',
  'paid-social',
  'paid-search',
  'cpc',
  'display',
  'referral',
  'email',
  'affiliate',
  'community',
  'qr',
  'mcp',
] as const;
export type UtmMedium = (typeof UTM_MEDIUMS)[number];

/** All channels, as data (mirrors the {@link Channel} union). */
export const CHANNELS = [
  'direct',
  'organic_search',
  'paid_search',
  'organic_social',
  'paid_social',
  'display',
  'referral',
  'email',
  'affiliate',
  'community',
  'mcp_ai',
  'internal',
] as const;

/** Medium → channel map (§5.4 step 1). `cpc` is an alias for paid search. */
export const MEDIUM_TO_CHANNEL: Record<UtmMedium, Channel> = {
  'organic-social': 'organic_social',
  'paid-social': 'paid_social',
  'paid-search': 'paid_search',
  cpc: 'paid_search',
  display: 'display',
  referral: 'referral',
  email: 'email',
  affiliate: 'affiliate',
  community: 'community',
  qr: 'referral',
  mcp: 'mcp_ai',
};

/** Click id → channel (§5.4 step 2), when no explicit medium is present. */
export const CLICK_ID_TO_CHANNEL: Record<string, Channel> = {
  gclid: 'paid_search',
  gbraid: 'paid_search',
  wbraid: 'paid_search',
  fbclid: 'paid_social',
  ttclid: 'paid_social',
  li_fat_id: 'paid_social',
  msclkid: 'paid_search',
};

/* ── Referrer host buckets (§5.4 step 3) — matched as substrings of the host. ── */
export const SEARCH_ENGINE_HOSTS = [
  'google.',
  'bing.',
  'duckduckgo.',
  'yahoo.',
  'ecosia.',
  'brave.',
  'baidu.',
  'yandex.',
  'startpage.',
] as const;

export const SOCIAL_HOSTS = [
  'facebook.',
  'instagram.',
  't.co',
  'x.com',
  'twitter.',
  'linkedin.',
  'youtube.',
  'youtu.be',
  'tiktok.',
  'pinterest.',
  'threads.',
  'mastodon.',
] as const;

/** Community / forum referrers roll up to the `community` channel. */
export const FORUM_HOSTS = [
  'reddit.',
  'news.ycombinator.com',
  'lobste.rs',
  'indiehackers.com',
  'dev.to',
  'hashnode.',
] as const;

/**
 * User-agent / referrer markers for LLM & agent traffic — the `mcp_ai` channel
 * (§5.4). Substring-matched, case-insensitively.
 */
export const AGENT_MARKERS = [
  'claude',
  'anthropic',
  'chatgpt',
  'gptbot',
  'oai-searchbot',
  'openai',
  'perplexity',
  'copilot',
] as const;

/* ── Normalization & validation (§4.1) ──────────────────────────────────── */

/** Lowercase, hyphen-delimit, strip to `[a-z0-9-]`. The canonical token form. */
export function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isUtmMedium(value: string): value is UtmMedium {
  return (UTM_MEDIUMS as readonly string[]).includes(value);
}

export function isUtmSource(value: string): value is UtmSource {
  return (UTM_SOURCES as readonly string[]).includes(value);
}

/** A source is valid if it's in the registry OR matches the `partner-{name}` pattern. */
export function isValidSource(value: string): boolean {
  return isUtmSource(value) || /^partner-[a-z0-9-]+$/.test(value);
}

export function isValidMedium(value: string): boolean {
  return isUtmMedium(value);
}

/** Campaign convention: `{initiative}-{yyyy-mm}` optionally `-{variant}` (§4.1). */
export function isValidCampaign(value: string): boolean {
  return /^[a-z0-9-]+-\d{4}-\d{2}(-[a-z0-9-]+)?$/.test(value);
}
