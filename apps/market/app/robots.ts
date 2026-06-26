import type { MetadataRoute } from 'next';

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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Cart / checkout are transactional, per-session pages — keep them out of
      // the index (no SEO value, and they should never be a search result).
      { userAgent: '*', allow: '/', disallow: ['/cart', '/checkout'] },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: ['/cart', '/checkout'] },
    ],
    sitemap: 'https://sparx.market/sitemap.xml',
    host: 'https://sparx.market',
  };
}
