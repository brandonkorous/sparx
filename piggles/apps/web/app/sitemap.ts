import type { MetadataRoute } from 'next';
import { APPS, PRODUCT } from '@piggles/config';

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

  return [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/apps`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/trust`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...appPages,
  ];
}
