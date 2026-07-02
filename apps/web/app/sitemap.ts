import type { MetadataRoute } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { MODULE_ORDER, MODULES } from '@/lib/modules';
import { DOC_PAGES } from '@/lib/docs';
import { TOOL_SLUGS } from '@/components/marketing/tools/registry';
import { ROLES, OPEN_APPLICATION } from './careers/roles';

const BASE = 'https://sparx.works';

// Module pages come from the hand-coded MODULE_ORDER / MODULES (lib/modules.ts) —
// the same source the pages render from, so the sitemap can never drift from
// what actually ships. (Module pages were briefly CMS-backed; that `module`
// content type was reclassified into builder components — docs/51 §7.)
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...MODULE_ORDER.map((key) => ({
      url: `${BASE}/${MODULES[key].slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    // Docs pages that actually have a route (lib/docs.ts, `soon` excluded), so
    // the sitemap never lists a 404. Developer docs are strong organic-link
    // earners — keeping them on the primary domain consolidates that equity.
    ...DOC_PAGES.map((page) => ({
      url: `${BASE}${page.href}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: page.href === '/docs' ? 0.7 : 0.6,
    })),
    // Free tools hub + each tool — high-intent, evergreen landing pages.
    {
      url: `${BASE}/tools`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    ...TOOL_SLUGS.map((slug) => ({
      url: `${BASE}/tools/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    // Careers index + each founding role (and the open application) — now real,
    // indexable pages rather than a ComingSoon stub, so they belong in coverage.
    {
      url: `${BASE}/careers`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    },
    ...[...ROLES, OPEN_APPLICATION].map((role) => ({
      url: `${BASE}/careers/${role.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    ...staticPages(now),
  ];
}

// Substantial, indexable static routes that aren't module pages. `ComingSoon`
// stubs (/about, /press, …) are deliberately excluded — listing thin
// placeholders in the sitemap invites soft-404 penalties (docs/50 §6: coverage
// bounds must be explicit, not silent). (/careers is now a real page and is
// listed above.) Legal `lastModified` tracks the actual document revision from
// the single source of truth in @sparx/legal.
function staticPages(now: Date): MetadataRoute.Sitemap {
  const legal = (['privacy', 'terms', 'dpa', 'aup'] as const).map((doc) => ({
    url: `${BASE}/legal/${doc}`,
    lastModified: new Date(LEGAL_DOC_VERSIONS[doc].effectiveDate),
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  }));
  return [
    {
      url: `${BASE}/platform`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    },
    {
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    },
    {
      url: `${BASE}/customers`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE}/security`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    ...legal,
  ];
}
