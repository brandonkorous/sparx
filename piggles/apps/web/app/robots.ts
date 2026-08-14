import type { MetadataRoute } from 'next';
import { PRODUCT } from '@piggles/config';

// Answer-engine and model crawlers are welcomed explicitly.
//
// The `*` rule already permits them; naming them states the intent and is the
// lever to tighten later. It is the right posture for this product specifically:
// Piggles' whole positioning is a translation between what a business owner says
// and what the software industry calls it, which is exactly the question people
// now ask an assistant rather than a search box. Being absent from those answers
// is the same as being absent from the results page.
//
// `/brand` is excluded: it is an internal palette reference, not a page anybody
// searching for business software should ever land on.
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

const INTERNAL = '/brand';

export default function robots(): MetadataRoute.Robots {
  const base = `https://${PRODUCT.hosts.marketing}`;
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: INTERNAL },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: INTERNAL },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
