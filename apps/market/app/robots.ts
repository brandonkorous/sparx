import type { MetadataRoute } from 'next';

import { SITE_ORIGIN, absoluteUrl } from '@/lib/site';

// AI / answer-engine crawlers we explicitly welcome (mirrors apps/web, docs/50).
// sparx.market is a public shopping destination — it wants maximum discovery
// surface, so it opts INTO answer-engine + model crawlers. The `*` rule already
// permits everyone; these named groups make the intent explicit and are the
// lever to tighten later if ever needed.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Amazonbot',
  'Meta-ExternalAgent',
];

// Per-session / per-shopper surfaces with no SEO value that should never be a
// search result. `/orders/*` is per-shopper order status and `/favorites` is a
// per-shopper list — both were previously crawlable. (`/search` is deliberately
// NOT here: it is a canonical redirect into /products, so it should stay
// crawlable and pass its link equity through the 301.)
//
// These pages also carry `robots: index:false` in their own metadata — a
// disallow stops crawling but does NOT prevent indexing of a URL discovered via
// an external link, so the meta tag is the braces to this belt.
const PRIVATE_PATHS = ['/cart', '/checkout', '/orders', '/orders/*', '/favorites'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: PRIVATE_PATHS },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_ORIGIN,
  };
}
