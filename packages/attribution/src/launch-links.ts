/**
 * The canonical launch link set (docs/80 §4.4, Phase 0). Every channel from the
 * launch plan, pre-tagged against the controlled vocabulary. Edit HERE and
 * regenerate `docs/launch/utm-links.csv` via `pnpm --filter @sparx/attribution links`.
 *
 * `campaign` convention: `{initiative}-{yyyy-mm}`. The general launch is
 * `launch-2026-06`; the Founding-100 promo links carry `founding-100-2026-06`.
 *
 * ── ONE BRAND'S DATA, IN A SHARED PACKAGE ───────────────────────────────────
 *
 * This is sparx's own campaign list — its hostname, its launch month, its promo.
 * It is the only file in this package that states a brand value, which is why it
 * is NOT re-exported from the barrel: reachable at `@sparx/attribution/launch-links`
 * by the brand that owns it, and invisible to the one that does not. It belongs
 * in the sparx tree and moves there with the restructure (piggles/docs/migration,
 * phase A4); the subpath is the seam that makes that move a file rename.
 */
import type { LinkDef } from './links';

const SITE = 'https://sparx.works';
const LAUNCH = 'launch-2026-06';

export const LAUNCH_LINKS: readonly LinkDef[] = [
  // ── Spike events ────────────────────────────────────────────────────────
  {
    label: 'Product Hunt — listing link',
    destination: `${SITE}/`,
    source: 'product-hunt',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'ph-listing',
  },
  {
    label: 'Product Hunt — first comment (promo)',
    destination: `${SITE}/pricing`,
    source: 'product-hunt',
    medium: 'referral',
    campaign: 'founding-100-2026-06',
    content: 'ph-comment',
  },
  {
    label: 'Hacker News — Show HN',
    destination: `${SITE}/`,
    source: 'hacker-news',
    medium: 'community',
    campaign: LAUNCH,
    content: 'show-hn',
  },
  {
    label: 'MCP registry — server listing',
    destination: `${SITE}/ai`,
    source: 'mcp-registry',
    medium: 'mcp',
    campaign: LAUNCH,
    content: 'server-listing',
  },

  // ── Communities ─────────────────────────────────────────────────────────
  {
    label: 'Reddit — r/selfhosted',
    destination: `${SITE}/`,
    source: 'reddit',
    medium: 'community',
    campaign: LAUNCH,
    content: 'r-selfhosted',
  },
  {
    label: 'Reddit — r/ecommerce',
    destination: `${SITE}/`,
    source: 'reddit',
    medium: 'community',
    campaign: LAUNCH,
    content: 'r-ecommerce',
  },
  {
    label: 'Reddit — r/ClaudeAI',
    destination: `${SITE}/ai`,
    source: 'reddit',
    medium: 'community',
    campaign: LAUNCH,
    content: 'r-claudeai',
  },
  {
    label: 'Indie Hackers — post',
    destination: `${SITE}/`,
    source: 'indie-hackers',
    medium: 'community',
    campaign: LAUNCH,
    content: 'ih-post',
  },

  // ── Owned social ────────────────────────────────────────────────────────
  {
    label: 'X — launch thread',
    destination: `${SITE}/`,
    source: 'x',
    medium: 'organic-social',
    campaign: LAUNCH,
    content: 'launch-thread',
  },
  {
    label: 'LinkedIn — launch post',
    destination: `${SITE}/`,
    source: 'linkedin',
    medium: 'organic-social',
    campaign: LAUNCH,
    content: 'launch-post',
  },
  {
    label: 'YouTube — MCP demo',
    destination: `${SITE}/ai`,
    source: 'youtube',
    medium: 'organic-social',
    campaign: LAUNCH,
    content: 'demo-mcp',
  },
  {
    label: 'Newsletter — announcement',
    destination: `${SITE}/`,
    source: 'newsletter',
    medium: 'email',
    campaign: LAUNCH,
    content: 'announce',
  },

  // ── Launch directories (partner-{name}) ─────────────────────────────────
  {
    label: 'Peerlist — launchpad',
    destination: `${SITE}/`,
    source: 'partner-peerlist',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'listing',
  },
  {
    label: 'Uneed — launchpad',
    destination: `${SITE}/`,
    source: 'partner-uneed',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'listing',
  },
  {
    label: 'Fazier — launchpad',
    destination: `${SITE}/`,
    source: 'partner-fazier',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'listing',
  },
  {
    label: 'Tiny Launch — launchpad',
    destination: `${SITE}/`,
    source: 'partner-tinylaunch',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'listing',
  },
  {
    label: 'Microlaunch — launchpad',
    destination: `${SITE}/`,
    source: 'partner-microlaunch',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'listing',
  },
  {
    label: 'BetaList — listing',
    destination: `${SITE}/`,
    source: 'partner-betalist',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'listing',
  },

  // ── Paid (when you scale spend) ─────────────────────────────────────────
  {
    label: 'Google Ads — Shopify alternative',
    destination: `${SITE}/migrate`,
    source: 'google',
    medium: 'paid-search',
    campaign: LAUNCH,
    content: 'search-ad',
    term: 'shopify-alternative',
  },
  {
    label: 'Meta Ads — Founding 100',
    destination: `${SITE}/pricing`,
    source: 'meta',
    medium: 'paid-social',
    campaign: 'founding-100-2026-06',
    content: 'founding-100',
  },

  // ── Module marketing domains (cross-sell) ───────────────────────────────
  {
    label: 'sparxcms.com → CMS',
    destination: `${SITE}/cms`,
    source: 'sparxcms',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'cross-sell',
  },
  {
    label: 'sparxcrm.com → CRM',
    destination: `${SITE}/crm`,
    source: 'sparxcrm',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'cross-sell',
  },
  {
    label: 'sparxemail.com → Email',
    destination: `${SITE}/email`,
    source: 'sparxemail',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'cross-sell',
  },
  {
    label: 'sparxb2b.com → B2B',
    destination: `${SITE}/b2b`,
    source: 'sparxb2b',
    medium: 'referral',
    campaign: LAUNCH,
    content: 'cross-sell',
  },
];
