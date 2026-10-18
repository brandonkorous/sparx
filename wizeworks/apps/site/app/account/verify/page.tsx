// Confirm your email: an EDITABLE shell around the PINNED `commerce.auth` core in
// `verify` mode (docs/122), like sign-in and reset. The form reads the single-use token
// from the URL (sparx persona issue 329). Public (token-gated).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@wizeworks/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { SiteHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage() {
  const site = await resolveSite();
  if (!site) notFound();
  const propertySlug = await resolveActivePropertySlug();
  const published = await getPublishedSilicaPage(site.slug, 'account/verify');
  const shell =
    published?.root ?? functionalShell(HOST_KEYS.commerceAuth, { props: { mode: 'verify' } });
  const renderHost = SiteHostRenderer({ site, propertySlug: propertySlug ?? undefined });

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
