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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: AI_CRAWLERS, allow: '/' },
    ],
    sitemap: 'https://sparx.works/sitemap.xml',
    host: 'https://sparx.works',
  };
}
