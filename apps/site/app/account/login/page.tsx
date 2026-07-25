// Sign in — an EDITABLE shell around the PINNED `commerce.auth` core in `signin` mode
// (docs/122). The live sign-in form lives in the host node the tenant can restyle and
// surround (welcome copy, imagery) but not delete; the route renders the tenant's published
// template (or the code fallback). Public (pre-auth) — no session, no gating.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function LoginPage() {
  const site = await resolveSite();
  if (!site) notFound();
  const propertySlug = await resolveActivePropertySlug();
  const published = await getPublishedSilicaPage(site.slug, 'account/login');
  const shell =
    published?.root ?? functionalShell(HOST_KEYS.commerceAuth, { props: { mode: 'signin' } });
  const renderHost = storefrontHostRenderer({ site, propertySlug: propertySlug ?? undefined });

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
