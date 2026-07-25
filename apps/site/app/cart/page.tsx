// Cart page — an EDITABLE shell around a PINNED cart core (docs/122). The body is a
// silica page the tenant composes in /builder/studio; the live `<CartView>` sits in a
// `commerce.cart` host node the engine won't let them delete or move out. The route
// renders the stored shell (or the code fallback shell for a tenant who hasn't
// customized it) through the React walk that mounts the real core at its host node.
//
// The cart is client state (always fresh, never cached), so this stays force-dynamic.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cart',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const site = await resolveSite();
  if (!site) notFound();

  const propertySlug = await resolveActivePropertySlug();
  // The tenant's published cart shell, else the code shell (a titled section wrapping
  // the pinned core) so a tenant who never edited the cart still gets a real page.
  const published = await getPublishedSilicaPage(site.slug, 'cart');
  const shell =
    published?.root ?? functionalShell(HOST_KEYS.commerceCart, { heading: 'Your cart' });
  const renderHost = storefrontHostRenderer({
    site,
    propertySlug: propertySlug ?? undefined,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Cart' }]} />
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
