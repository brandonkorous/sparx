import type { MetadataRoute } from 'next';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal-versions';
import { MODULE_ORDER, MODULES } from '@/lib/modules';

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
    ...staticPages(now),
  ];
}

// Substantial, indexable static routes that aren't module pages. `ComingSoon`
// stubs (/about, /careers, /press, …) are deliberately excluded — listing thin
// placeholders in the sitemap invites soft-404 penalties (docs/50 §6: coverage
// bounds must be explicit, not silent). Legal `lastModified` tracks the actual
// document revision from the single source of truth in @sparx/legal.
function staticPages(now: Date): MetadataRoute.Sitemap {
  const legal = (['privacy', 'terms', 'dpa', 'aup'] as const).map((doc) => ({
    url: `${BASE}/legal/${doc}`,
    lastModified: new Date(LEGAL_DOC_VERSIONS[doc].effectiveDate),
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  }));
  return [
    {
      url: `${BASE}/security`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    ...legal,
  ];
}
