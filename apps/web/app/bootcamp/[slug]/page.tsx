// Individual bootcamp detail (docs/114 §B.5/§B.6, D6/D7). Server-rendered with an
// async generateMetadata from the fetched bootcamp, schema.org `Event` JSON-LD
// (attendance mode derived from format, organizer = host, offers when priced),
// and EITHER an internal RSVP form (registration_mode='internal' → the host
// partner's CRM) or an external Register CTA. notFound() when missing;
// revalidate 300 keeps it fresh after publish/update. OG image is auto-generated
// per slug in opengraph-image.tsx.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Container, Display, Spark } from '@/components/marketing/primitives';
import { TIER_META } from '@/lib/partners';
import {
  bootcampDates,
  bootcampIsoDate,
  bootcampLocation,
  bootcampPrice,
  FORMAT_LABEL,
  fetchBootcamp,
  seatsLabel,
  type BootcampDetail,
} from '@/lib/bootcamp';
import { RsvpForm } from './rsvp-form';

export const revalidate = 300;

const BASE_URL = 'https://sparx.works';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const b = await fetchBootcamp(slug);
  if (!b) return { title: 'Bootcamp — sparx' };
  const where = bootcampLocation(b);
  const desc = `${FORMAT_LABEL[b.format]} bootcamp hosted by ${b.host.displayName} · ${bootcampDates(b)} · ${where}. Build a real business on sparx and graduate when you publish.`;
  return {
    title: `${b.title} — sparx Bootcamp`,
    description: desc,
    alternates: { canonical: `/bootcamp/${b.slug}` },
    openGraph: { title: b.title, description: desc, url: `/bootcamp/${b.slug}`, type: 'website' },
  };
}

const ATTENDANCE: Record<BootcampDetail['format'], string> = {
  in_person: 'https://schema.org/OfflineEventAttendanceMode',
  virtual: 'https://schema.org/OnlineEventAttendanceMode',
  hybrid: 'https://schema.org/MixedEventAttendanceMode',
  async: 'https://schema.org/OnlineEventAttendanceMode',
};

function eventJsonLd(b: BootcampDetail) {
  const url = `${BASE_URL}/bootcamp/${b.slug}`;
  const seats = seatsLabel(b);
  const hasPlace = Boolean(b.locationCity) && (b.format === 'in_person' || b.format === 'hybrid');
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: b.title,
    startDate: bootcampIsoDate(b.startsAt),
    endDate: bootcampIsoDate(b.endsAt),
    eventAttendanceMode: ATTENDANCE[b.format],
    eventStatus: 'https://schema.org/EventScheduled',
    description: stripHtml(b.description).slice(0, 400) || undefined,
    organizer: { '@type': 'Organization', name: b.host.displayName },
    location: hasPlace
      ? {
          '@type': 'Place',
          name: bootcampLocation(b),
          address: {
            '@type': 'PostalAddress',
            addressLocality: b.locationCity ?? undefined,
            addressRegion: b.locationState ?? undefined,
            addressCountry: b.locationCountry ?? 'US',
          },
        }
      : { '@type': 'VirtualLocation', url },
    offers: {
      '@type': 'Offer',
      price: (b.priceCents / 100).toFixed(2),
      priceCurrency: b.currency || 'USD',
      availability: seats?.full ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: b.registrationMode === 'external' && b.registrationUrl ? b.registrationUrl : url,
    },
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function BootcampDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const b = await fetchBootcamp(slug);
  if (!b) notFound();

  const tier = TIER_META[b.host.tier];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(b)) }}
      />

      {/* Header band — orange-tinted, mirroring the bootcamp hero identity. */}
      <section className="bg-primary bg-soft px-page py-[clamp(40px,6vw,72px)]">
        <Container className="flex flex-col gap-5">
          <a href="/bootcamp" className="text-sm no-underline">
            ← All bootcamps
          </a>
          <div className="max-w-[760px]">
            <Display as="h1" size={64} lineHeight={64}>
              {b.title}
              <Spark />
            </Display>
          </div>
          {/* Format moved out of the pre-heading eyebrow slot and into the meta row
              (RULE #2: nothing sits above a heading purely to introduce it). */}
          <div className="text-md flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <span className="inline-flex items-center gap-2">
              <Badge color={tier.color} variant="soft" size="sm">
                {tier.label}
              </Badge>
              {b.host.displayName}
            </span>
            <Badge color="primary" size="sm" className="font-mono">
              {FORMAT_LABEL[b.format]}
            </Badge>
            <span>{bootcampDates(b)}</span>
            <span>{bootcampLocation(b)}</span>
          </div>
        </Container>
      </section>

      {/* Body — description + sticky registration card. */}
      <section className="bg-base-200 px-page py-section-lg">
        <Container>
          <div className="mkt-detail-grid">
            <div
              className="mkt-prose"
              dangerouslySetInnerHTML={{ __html: b.description || '<p>Details coming soon.</p>' }}
            />
            <aside className="mkt-detail-aside">
              <RegistrationCard b={b} />
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}

function RegistrationCard({ b }: { b: BootcampDetail }) {
  const seats = seatsLabel(b);
  const price = bootcampPrice(b);
  const rows: { k: string; v: string }[] = [
    { k: 'Format', v: FORMAT_LABEL[b.format] },
    { k: 'Dates', v: bootcampDates(b) },
    { k: 'Location', v: bootcampLocation(b) },
    { k: 'Price', v: price },
  ];
  if (seats) rows.push({ k: 'Seats', v: seats.full ? 'Full — waitlist open' : seats.text });

  const externalUrl = b.registrationMode === 'external' ? b.registrationUrl : null;

  return (
    <Card className="rounded-2xl shadow-lg">
      <CardBody className="gap-5 p-[clamp(24px,3vw,32px)]">
        <div className="flex flex-col gap-0.5">
          {rows.map((r, i) => (
            <div
              key={r.k}
              className={
                i === 0
                  ? 'flex items-center justify-between gap-4 py-3 text-sm'
                  : 'border-base-300 flex items-center justify-between gap-4 border-t py-3 text-sm'
              }
            >
              <span>{r.k}</span>
              <span className="text-right font-medium">{r.v}</span>
            </div>
          ))}
        </div>

        {externalUrl ? (
          <div className="flex flex-col gap-2.5">
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ color: 'primary', size: 'lg', block: true })}
            >
              Register ↗
            </a>
            <p className="m-0 text-sm">Registration is handled on the host&rsquo;s own page.</p>
          </div>
        ) : (
          <RsvpForm slug={b.slug} full={Boolean(seats?.full)} />
        )}
      </CardBody>
    </Card>
  );
}
