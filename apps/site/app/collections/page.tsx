// Collection index — an EDITABLE shell around a PINNED `commerce.collections` core
// (docs/122). The live card grid of every published collection (featured first) lives in
// the host node the tenant can restyle and surround but not delete; the route renders the
// stored shell (or the code fallback). Needs only the resolved site (no URL state).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Collections' };

export default async function CollectionListingPage() {
  const site = await resolveSite();
  if (!site) notFound();

  const propertySlug = await resolveActivePropertySlug();
  // The tenant's published collections shell, else the code shell wrapping the pinned
  // core. No heading in the shell — the core renders its own header + subtitle.
  const published = await getPublishedSilicaPage(site.slug, 'collections');
  const shell = published?.root ?? functionalShell(HOST_KEYS.commerceCollections);
  const renderHost = storefrontHostRenderer({
    site,
    propertySlug: propertySlug ?? undefined,
  });

  return (
    <div className="st-container">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Collections' }]} />
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
