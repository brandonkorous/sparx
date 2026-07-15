// Category index — an EDITABLE shell around a PINNED `commerce.categories` core
// (docs/122). The live card grid of root browse categories (each drilling into
// /category/[handle]) lives in the host node the tenant can restyle and surround but not
// delete; the route renders the stored shell (or the code fallback). Site-only, no URL
// state. (The category DETAIL, /category/[handle], is a per-record template — it rides
// the same pinned-core path once categories get a stored silica template, alongside the
// PDP-as-functional work.)

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoryIndexPage() {
  const site = await resolveSite();
  if (!site) notFound();

  const propertySlug = await resolveActivePropertySlug();
  // The tenant's published categories shell, else the code shell wrapping the pinned
  // core. No shell heading — the core renders its own header + subtitle.
  const published = await getPublishedSilicaPage(site.slug, 'category');
  const shell = published?.root ?? functionalShell(HOST_KEYS.commerceCategories);
  const renderHost = storefrontHostRenderer({
    site,
    propertySlug: propertySlug ?? undefined,
  });

  return (
    <div className="st-container">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Categories' }]} />
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
