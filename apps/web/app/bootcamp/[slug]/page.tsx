// Individual bootcamp detail (docs/114 §B.5/§B.6, D6/D7). Server-rendered with an
// async generateMetadata from the fetched bootcamp, schema.org `Event` JSON-LD
// (attendance mode derived from format, organizer = host, offers when priced),
// and EITHER an internal RSVP form (registration_mode='internal' → the host
// partner's CRM) or an external Register CTA. notFound() when missing;
// revalidate 300 keeps it fresh after publish/update. OG image is auto-generated
// per slug in opengraph-image.tsx.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button } from '@sparx/ui';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { Display, Spark } from '@/components/marketing/primitives';
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

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';
const ORANGE = 'var(--module-commerce)';
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
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(b)) }}
      />

      {/* Header band — orange-tinted, mirroring the bootcamp hero identity. */}
      <section
        style={{
          backgroundColor: '#FFF7ED',
          paddingTop: 'clamp(40px, 6vw, 72px)',
          paddingBottom: 'clamp(40px, 6vw, 72px)',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--container-max)',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <a
            href="/bootcamp"
            style={{
              fontFamily: SANS,
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
            }}
          >
            ← All bootcamps
          </a>
          <span
            style={{
              alignSelf: 'flex-start',
              fontFamily: MONO,
              fontSize: '12px',
              padding: '5px 12px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-bg-surface)',
              color: '#C2410C',
            }}
          >
            {FORMAT_LABEL[b.format]}
          </span>
          <div style={{ maxWidth: '20ch' }}>
            <Display as="h1" size={64} lineHeight={64}>
              {b.title}
              <Spark color={ORANGE} />
            </Display>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px 20px',
              fontFamily: SANS,
              fontSize: '15px',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Badge color={tier.color} variant="soft" size="sm">
                {tier.label}
              </Badge>
              {b.host.displayName}
            </span>
            <span>{bootcampDates(b)}</span>
            <span>{bootcampLocation(b)}</span>
          </div>
        </div>
      </section>

      {/* Body — description + sticky registration card. */}
      <section
        style={{
          paddingTop: 'var(--section-py-lg)',
          paddingBottom: 'var(--section-py-lg)',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', width: '100%' }}>
          <div className="mkt-detail-grid">
            <div
              className="mkt-prose"
              dangerouslySetInnerHTML={{ __html: b.description || '<p>Details coming soon.</p>' }}
            />
            <aside className="mkt-detail-aside">
              <RegistrationCard b={b} />
            </aside>
          </div>
        </div>
      </section>

      <Footer />
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
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '18px',
        padding: 'clamp(24px, 3vw, 32px)',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {rows.map((r, i) => (
          <div
            key={r.k}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '12px 0',
              borderTop: i === 0 ? undefined : '1px solid var(--color-border-default)',
              fontFamily: SANS,
              fontSize: '14px',
            }}
          >
            <span style={{ color: 'var(--color-text-tertiary)' }}>{r.k}</span>
            <span
              style={{ color: 'var(--color-text-primary)', fontWeight: 500, textAlign: 'right' }}
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>

      {externalUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a href={externalUrl} target="_blank" rel="noopener noreferrer">
            <Button color="commerce" size="lg" style={{ width: '100%' }}>
              Register ↗
            </Button>
          </a>
          <p
            style={{
              margin: 0,
              fontFamily: SANS,
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
              lineHeight: '18px',
            }}
          >
            Registration is handled on the host&rsquo;s own page.
          </p>
        </div>
      ) : (
        <RsvpForm slug={b.slug} full={Boolean(seats?.full)} />
      )}
    </div>
  );
}
