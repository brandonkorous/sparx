import type { MetadataRoute } from 'next';
import { APPS, PRODUCT } from '@piggles/config';
import { TOOLS } from '@/components/marketing/tools/registry';
import { TRADES } from '@/content/trades';
import { COMPARISONS } from '@/content/compare';

// The sitemap matters more here than on a typical marketing site.
//
// The satellite domains (pigglescms.com and friends) are real sites that have to
// rank on their own, and the pages they point at are these fifteen. A crawler
// that has to discover them by following links from one index page finds them
// slowly and treats them as less important than they are.
//
// App pages are DERIVED from the registry rather than listed, so an app added to
// `@piggles/config` cannot be silently missing from search — the failure mode of
// a hand-kept sitemap is a page that exists, works, and is invisible, which looks
// exactly like a page nobody wanted.

const BASE = `https://${PRODUCT.hosts.marketing}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const appPages: MetadataRoute.Sitemap = APPS.map((app) => ({
    url: `${BASE}/apps/${app.id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    // Higher than a typical interior page: these are the landing pages for the
    // technical search terms, and the whole acquisition idea rests on them.
    priority: 0.8,
  }));

  // The free tools, DERIVED from their registry for the same reason as the apps.
  // These are the pages most likely to be found by somebody who has never heard
  // of Piggles — "free invoice generator" is a search with volume behind it and
  // no brand attached — so a tool that is missing here is an acquisition page
  // nobody can find.
  const toolPages: MetadataRoute.Sitemap = TOOLS.map((tool) => ({
    url: `${BASE}/tools/${tool.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // One page per kind of business: the pages a prospect is sent to after a sales call.
  const tradePages: MetadataRoute.Sitemap = TRADES.map((t) => ({
    url: `${BASE}/for/${t.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const page = (path: string, priority: number) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority,
  });

  return [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/apps`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/tools`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/trust`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    page('/how-it-works', 0.9),
    page('/who-its-for', 0.9),
    page('/compare', 0.8),
    ...COMPARISONS.map((c) => page(`/compare/${c.slug}`, 0.8)),
    page('/switching', 0.8),
    page('/faq', 0.7),
    page('/what-connects', 0.7),
    page('/about', 0.6),
    { url: `${BASE}/whats-new`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    page('/status', 0.3),
    page('/terms', 0.3),
    page('/privacy', 0.3),
    page('/cookies', 0.3),
    page('/data-processing', 0.3),
    ...appPages,
    ...tradePages,
    ...toolPages,
  ];
}
