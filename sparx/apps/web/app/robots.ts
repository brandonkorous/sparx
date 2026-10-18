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
// in the sitemap. So crawl `/market/…`, but never its query strings. Filtered
// views send `noindex` too. The partner directory's filters are the same shape
// and get the same rule.
//
// This is a REQUEST, and on 2026-10-18 a scraper ignored it (and nofollow, and
// noindex) and walked the market's facets at ~30 pages a second. The fences that
// hold are structural: the market's facets are form controls with no links to
// follow, and both browse pages refuse a selection past MAX_FACET_SELECTIONS
// (lib/browse-params) before any catalog read. This stays for the crawlers that
// do listen.
const FACETED_BROWSE = ['/market/*?*', '/partners/directory?*'];

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
