// Book — an EDITABLE shell around a PINNED `scheduling.services` core (docs/122). The
// live list of bookable services (each drilling into /book/[serviceId]) lives in the host
// node the tenant can restyle and surround but not delete; the route renders the stored
// shell (or the code fallback). The route 404s when the Scheduling module is off (module
// gating) — otherwise it always renders, and the core shows an empty state until a service
// is bookable. (The service DETAIL, /book/[serviceId], is a per-record template — it rides
// the same pinned-core path once services get a stored silica template.)

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOST_KEYS, functionalShell } from '@wizeworks/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { SiteHostRenderer } from '@/components/silica-host-cores';
import { getPublishedSilicaPage, resolveSchedulingEnabled } from '@/lib/silica';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

// KEEPS `force-dynamic` while the content routes dropped it (docs/127 §6). Appointment
// availability is the one storefront read where a stale answer is visible to the
// customer as a bookable slot that is already taken — they pick it, and the booking
// fails at submit. Worth an origin render per visit.
export const dynamic = 'force-dynamic';

/**
 * The booking page's OWN title and description, the same as every other page.
 *
 * This was `export const metadata = { title: 'Book an appointment' }` — a module
 * constant, so the title and description a tenant typed into the page's own Search
 * wording fields were read by nothing and every salon's booking page went to search
 * as the platform's sentence with the site tagline under it. The shell this route
 * renders IS a page they author; its wording is theirs too.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return { title: 'Book an appointment' };
  const published = await getPublishedSilicaPage(site.slug, 'book');
  const clean = (value: string | null | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  };
  // No ` · <site>` suffix here: the root layout's title template already appends it.
  const title = clean(published?.seoTitle) ?? 'Book an appointment';
  const description = clean(published?.seoDescription);
  return {
    title,
    ...(description ? { description } : {}),
    openGraph: {
      title: `${title} · ${site.name}`,
      ...(description ? { description } : {}),
    },
  };
}

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
  const renderHost = SiteHostRenderer({
    site,
    propertySlug: propertySlug ?? undefined,
    // THIS page is what the booking list is about, so its heading is the page's
    // title. Everywhere else the block is a section inside a page that already has
    // one, and emitting a second `<h1>` there gave a homepage two page titles
    // (issue 095). The words are the author's; only the LEVEL is worked out, and
    // it is worked out from the route rather than stored — so a page authored
    // before this still gets the right one.
    bookingHeadingIsPageTitle: true,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
    </div>
  );
}
