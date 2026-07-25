// Bookable-service DETAIL — an EDITABLE shell around a PINNED `scheduling.service-detail`
// core (docs/122). The live time-picker (availability, slot selection, booking) lives in
// the host node the tenant can restyle and surround but not delete; the route renders the
// tenant's published `scheduling.service` template (or the code fallback). This is a
// per-record template: the record is the service, keyed by id. The route 404s for an
// unknown service (which also covers the module being off — no service resolves then).

import { notFound } from 'next/navigation';
import { getPublishedSilicaCollection } from '@/lib/silica';
import { serviceDetailPage } from '@sparx/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getBookableService } from '@/lib/scheduling';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ serviceId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { serviceId } = await params;
  const service = await getBookableService(serviceId);
  return { title: service ? `Book ${service.name}` : 'Book an appointment' };
}

export default async function BookServicePage({ params }: Props) {
  const { serviceId } = await params;
  const site = await resolveSite();
  if (!site) notFound();
  // Existence + module gate: an unknown/off-module service has no booking surface.
  const service = await getBookableService(serviceId);
  if (!service) notFound();

  const propertySlug = await resolveActivePropertySlug();
  // The tenant's published service template (per-record override → type default → code
  // fallback). The core renders the service header + live widget from the id below.
  const published = await getPublishedSilicaCollection(site.slug, 'scheduling.service', serviceId);
  const shell = published?.root ?? serviceDetailPage();
  const renderHost = storefrontHostRenderer({
    site,
    propertySlug: propertySlug ?? undefined,
    recordId: serviceId,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
