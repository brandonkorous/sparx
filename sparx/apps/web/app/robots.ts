import type { MetadataRoute } from 'next';

// AI / answer-engine crawlers we explicitly welcome (docs/50). sparx is built
// AI-native (MCP-first, "AI builds it, sparx keeps it"), so the marketing site
// opts INTO answer-engine and model crawlers rather than the common default of
// blocking them. The `*` rule already permits everyone; these named groups make
// the intent explicit and are the lever to tighten later if ever needed.
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

// Faceted browse is a filter UI for humans, not a set of pages. Every facet
// combination is a distinct URL, so a crawler that follows them explores an
// exponential space of near-identical results — which is exactly how api-rest was
// flooded into a heap-death crashloop on 2026-07-16. The catalog's real content is
// fully reachable without filters: the category pages and every listing detail are
// in the sitemap. So crawl `/market/…`, but never its query strings. The facet
// links carry rel="nofollow" and filtered views send `noindex` too — this is the
// outermost of those three fences.
const FACETED_BROWSE = '/market/*?*';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: FACETED_BROWSE },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: FACETED_BROWSE },
    ],
    sitemap: 'https://sparx.works/sitemap.xml',
    host: 'https://sparx.works',
  };
}
