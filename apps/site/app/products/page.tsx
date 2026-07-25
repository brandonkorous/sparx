// Product listing page (PLP) — an EDITABLE shell around a PINNED listing core
// (docs/122). The faceted, sortable, paginated catalog lives in the `commerce.plp` host
// node the tenant can restyle and surround but not delete; the route renders the stored
// shell (or the code fallback) and passes the resolved URL search params to the core.
// All filter state stays in the URL so every variant is SSR-cacheable.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import type { SearchParams } from '@/components/products/product-listing';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Shop all products' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const site = await resolveSite();
  if (!site) notFound();

  const sp = (await searchParams) ?? {};
  const q = one(sp.q);
  const propertySlug = await resolveActivePropertySlug();
  // The tenant's published PLP shell, else the code shell wrapping the pinned core, so a
  // tenant who never edited the listing still gets a real page. No heading in the shell —
  // the listing's heading is query-dependent, so the core owns it.
  const published = await getPublishedSilicaPage(site.slug, 'products');
  const shell = published?.root ?? functionalShell(HOST_KEYS.commercePlp);
  const renderHost = storefrontHostRenderer({
    site,
    propertySlug: propertySlug ?? undefined,
    searchParams: sp,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: q ? `Search: ${q}` : 'All products' }]}
      />
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
