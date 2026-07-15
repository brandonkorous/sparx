// Search — an EDITABLE shell around a PINNED search core (docs/122). The whole
// interactive search experience (query field, Typesense-faceted sidebar, sort, result
// grid + pagination) lives in the `commerce.search` host node the tenant can restyle and
// surround but not delete; the route renders the stored shell (or the code fallback) and
// passes the resolved URL search params down to the core (a host core can't read the URL).
//
// All filter state stays in the URL, so every result page is shareable + SSR-cacheable.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import type { SearchParams } from '@/components/search/search-experience';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const site = await resolveSite();
  if (!site) notFound();

  const sp = (await searchParams) ?? {};
  const propertySlug = await resolveActivePropertySlug();
  // The tenant's published search shell, else the code shell (a titled section wrapping
  // the pinned core), so a tenant who never edited search still gets a real page.
  const published = await getPublishedSilicaPage(site.slug, 'search');
  const shell = published?.root ?? functionalShell(HOST_KEYS.commerceSearch, { heading: 'Search' });
  const renderHost = storefrontHostRenderer({
    site,
    propertySlug: propertySlug ?? undefined,
    searchParams: sp,
  });

  return (
    <div className="st-container" style={{ paddingBlock: '2rem' }}>
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
