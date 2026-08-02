// Create account — an EDITABLE shell around the PINNED `commerce.auth` core in `register`
// mode (docs/122). The live create-account form lives in the host node the tenant can
// restyle and surround but not delete; the route renders the tenant's published template
// (or the code fallback). Public (pre-auth) — no session, no gating.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { SiteHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const site = await resolveSite();
  if (!site) notFound();
  const propertySlug = await resolveActivePropertySlug();
  const published = await getPublishedSilicaPage(site.slug, 'account/register');
  const shell =
    published?.root ?? functionalShell(HOST_KEYS.commerceAuth, { props: { mode: 'register' } });
  const renderHost = SiteHostRenderer({ site, propertySlug: propertySlug ?? undefined });

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
