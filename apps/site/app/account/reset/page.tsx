// Set a new password — an EDITABLE shell around the PINNED `commerce.auth` core in `reset`
// mode (docs/122). The live set-new-password form (reads the single-use token from the URL)
// lives in the host node the tenant can restyle and surround but not delete; the route
// renders the tenant's published template (or the code fallback). Public (token-gated).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPage() {
  const site = await resolveSite();
  if (!site) notFound();
  const propertySlug = await resolveActivePropertySlug();
  const published = await getPublishedSilicaPage(site.slug, 'account/reset');
  const shell =
    published?.root ?? functionalShell(HOST_KEYS.commerceAuth, { props: { mode: 'reset' } });
  const renderHost = storefrontHostRenderer({ site, propertySlug: propertySlug ?? undefined });

  return (
    <div className="st-container">
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
