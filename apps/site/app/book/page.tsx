// Book — an EDITABLE shell around a PINNED `scheduling.services` core (docs/122). The
// live list of bookable services (each drilling into /book/[serviceId]) lives in the host
// node the tenant can restyle and surround but not delete; the route renders the stored
// shell (or the code fallback). The route 404s when the Scheduling module is off (module
// gating) — otherwise it always renders, and the core shows an empty state until a service
// is bookable. (The service DETAIL, /book/[serviceId], is a per-record template — it rides
// the same pinned-core path once services get a stored silica template.)

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@sparx/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage, resolveSchedulingEnabled } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Book an appointment' };

export default async function BookIndexPage() {
  const site = await resolveSite();
  if (!site) notFound();
  // Module gating: a tenant without the Scheduling module has no booking surface.
  if (!(await resolveSchedulingEnabled(site.slug))) notFound();

  const propertySlug = await resolveActivePropertySlug();
  // The tenant's published booking shell, else the code shell wrapping the pinned core.
  // No shell heading — the services list core renders its own header + subtitle.
  const published = await getPublishedSilicaPage(site.slug, 'book');
  const shell = published?.root ?? functionalShell(HOST_KEYS.schedulingServices);
  const renderHost = storefrontHostRenderer({
    site,
    propertySlug: propertySlug ?? undefined,
  });

  return (
    <div className="st-container">
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
