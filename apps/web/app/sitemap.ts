import type { MetadataRoute } from 'next';
import { LEGAL_DOC_VERSIONS, SUBPROCESSORS_VERSION } from '@/lib/legal-versions';
import { MODULE_ORDER, MODULES } from '@/lib/modules';
import { DOC_PAGES } from '@/lib/docs';
import { TOOL_SLUGS } from '@/components/marketing/tools/registry';
import { VERTICAL_SLUGS } from '@/components/marketing/verticals/registry';
import { fetchPublishedBootcampSlugs } from '@/lib/bootcamp';
import { fetchPartnerSlugs } from '@/lib/partners';
import { fetchListingSlugs } from '@/lib/marketplace';
import { LIVE_CATEGORIES } from '@/lib/marketplace-registry';
import { ROLES, OPEN_APPLICATION } from './careers/roles';

const BASE = 'https://sparx.works';

// Module pages come from the hand-coded MODULE_ORDER / MODULES (lib/modules.ts) —
// the same source the pages render from, so the sitemap can never drift from
// what actually ships. (Module pages were briefly CMS-backed; that `module`
// content type was reclassified into builder components — docs/51 §7.)
// Async so it can await the published-bootcamp slugs from the public API — those
// are dynamic listings, guarded to [] so a down endpoint never breaks coverage.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [bootcampSlugs, partnerSlugs] = await Promise.all([
    fetchPublishedBootcampSlugs(),
    fetchPartnerSlugs(),
  ]);
  const bootcampPages: MetadataRoute.Sitemap = bootcampSlugs.map((slug) => ({
    url: `${BASE}/bootcamp/${slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));
  // Listable partner profiles. Same guard as the bootcamps above — the fetch
  // degrades to [] rather than throwing, so a down public API narrows this
  // sitemap instead of taking all coverage with it.
  const partnerPages: MetadataRoute.Sitemap = partnerSlugs.map((slug) => ({
    url: `${BASE}/partners/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...(await marketplacePages(now)),
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
    // The industry landing pages. High priority deliberately: these are the
    // pages paid and social traffic lands on, and each is a distinct commercial
    // query ("salon booking software", "auto repair shop software") rather than
    // a facet of one. The bare /for parent is NOT listed — it 308s to
    // /customers, which is the real hub and is listed with the static pages.
    ...VERTICAL_SLUGS.map((slug) => ({
      url: `${BASE}/for/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
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
    ...bootcampPages,
    ...partnerPages,
    ...staticPages(now),
  ];
}

// The platform extension catalog at /market — blueprints, themes, integrations,
// and components a tenant can install. (Distinct from sparx.market, the separate
// app where shoppers browse products sold BY tenants; that site carries its own
// sitemap on its own domain.) Categories come from LIVE_CATEGORIES so a
// `coming-soon` category is never listed, and each live category's listing slugs
// are enumerated from the same public catalog API the pages render from.
//
// Only the UNFILTERED category URL is listed: /market/[category] sets
// robots.index:false once facets are applied (page.tsx generateMetadata), and
// robots.ts disallows `/market/*?*` outright, so emitting a faceted permutation
// here would contradict both signals.
//
// Every fetch degrades to empty rather than throwing — a down catalog API must
// narrow this sitemap, never fail the whole route and take all coverage with it.
async function marketplacePages(now: Date): Promise<MetadataRoute.Sitemap> {
  const perCategory = await Promise.all(
    LIVE_CATEGORIES.map(async (category) => {
      const { slugs, truncated } = await fetchListingSlugs(category.id);
      if (truncated) {
        // An explicit coverage bound, never a silent truncation (docs/50 §6).
        console.warn(
          `[sitemap] /market/${category.id}: listing enumeration hit its cap; ` +
            `coverage is bounded at ${slugs.length} listings.`
        );
      }
      return [
        {
          url: `${BASE}/market/${category.id}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.7,
        },
        ...slugs.map((slug) => ({
          url: `${BASE}/market/${category.id}/${slug}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        })),
      ];
    })
  );

  return [
    {
      url: `${BASE}/market`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    ...perCategory.flat(),
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
  // The subprocessor list is versioned separately from the accepted documents
  // (it is disclosed, not accepted — see SUBPROCESSORS_VERSION), so it carries
  // its own entry rather than riding the tuple above.
  legal.push({
    url: `${BASE}/legal/subprocessors`,
    lastModified: new Date(SUBPROCESSORS_VERSION.effectiveDate),
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  });
  return [
    {
      url: `${BASE}/platform`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    },
    // The second document for the `ai` module (the first, /ai, rides MODULE_ORDER
    // above). /agentic is a standalone deep page — the MCP / agentic story — not
    // a ModulePageSlug, so it needs its own entry.
    {
      url: `${BASE}/agentic`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${BASE}/features`,
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
      url: `${BASE}/partners`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${BASE}/partners/directory`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    },
    {
      url: `${BASE}/bootcamp`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
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
    // Public brand/press reference — real page with logo downloads, and llms.txt
    // links it, so it must be crawlable coverage rather than an orphan.
    {
      url: `${BASE}/brand`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    },
    ...legal,
  ];
}
