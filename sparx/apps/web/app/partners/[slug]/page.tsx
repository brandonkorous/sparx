// One partner's public profile (docs/114 §B.6). The route the partner program
// has always been specified to have and never got: the directory could list a
// partner and link OUT to their own website, but there was nowhere on sparx.works
// that a partner could be linked TO — no shareable URL, no page a referral could
// point at, nothing for search to index per partner.
//
// Keyed on `slug`, not the row uuid. The slug is minted from the display name at
// approval and never moves afterwards (see the Partner model), so a link handed
// out today still resolves after the partner renames itself.
//
// Everything on this page is real or absent. There is no invented headline, no
// placeholder portrait, no "5 years experience" — the model holds a display name,
// a bio, a tier, a kind, a location, specialties, a photo and a website, and the
// page renders exactly what is present. That is deliberate: the previous version
// of the /partners directory aside shipped three fabricated agencies to a public
// page, and this is the surface where that temptation is strongest.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — an element passed as silica's
// `render` prop arrives at the RSC boundary as a lazy client reference and
// silica's unconditional `cloneElement` throws during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '@/components/marketing/band';
import { fetchPartner, partnerLocation, TIER_META, type PartnerProfile } from '@/lib/partners';
import { specialty } from '../directory/_components/specialties';

export const revalidate = 300;

// The directory is live data — a partner approved five minutes ago must resolve
// here — so there is no generateStaticParams(). Every sibling route on the site
// takes the same 5-minute revalidate.
const BASE_URL = 'https://sparx.works';

/** What the partner calls the work they do, for the line under their name. */
const KIND_LABEL: Record<string, string> = {
  freelance: 'Independent consultant',
  agency: 'Agency',
  developer: 'Developer',
  other: 'sparx partner',
};

/**
 * What the tier means TO A BUYER — not what it took the partner to earn it.
 *
 * /partners explains tiers to prospective partners (commission rates, what to
 * apply for). A business reading this page is asking a different question — "how
 * much has sparx actually checked this person?" — and deserves the plain answer,
 * including for Informal, where the honest answer is "we haven't".
 *
 * Facts here match components/marketing/partners/tiers.tsx exactly.
 */
const TIER_NOTE: Record<string, string> = {
  certified:
    'They passed the sparx certification course, so they have been assessed on the platform they are selling you. They have a named contact here, and they can run bootcamps published on this site.',
  registered:
    'They applied to the program and we looked at their work before listing them. It is a review of their track record, not a certification exam.',
  informal:
    'They signed themselves up, which anyone may do. We have not reviewed their work — judge it the way you would any other contractor you were about to hire.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await fetchPartner(slug);
  if (!p) return { title: 'Partner — sparx' };

  const where = partnerLocation(p);
  const kind = KIND_LABEL[p.kind] ?? KIND_LABEL.other;
  const work = p.specialties.map((s) => specialty(s).label).join(', ');
  const bio = p.bio?.trim() ?? '';
  // The partner's own words when they wrote any; otherwise a description built
  // only from facts on the row. Never a template with an invented adjective in
  // it — this string is what shows under the result in search.
  const desc =
    bio.length > 0
      ? bio
      : [
          `${kind} in the sparx partner directory`,
          where ? ` · ${where}` : '',
          work ? `. Works on ${work}.` : '.',
          ' Contact them directly — there is no introduction fee.',
        ].join('');

  return {
    title: `${p.displayName} — sparx partner`,
    description: desc.slice(0, 300),
    alternates: { canonical: `/partners/${p.slug}` },
    openGraph: {
      title: p.displayName,
      description: desc.slice(0, 300),
      // ABSOLUTE, deliberately. A bare path here makes LinkedIn de-duplicate the
      // share against the site root, so every partner's card renders as the
      // homepage — already fixed twice on this site.
      url: `${BASE_URL}/partners/${p.slug}`,
      type: 'profile',
    },
  };
}

/** schema.org ProfessionalService — a partner is a business that provides a
 *  service, which is the type search engines render a service panel from.
 *  Mirrors the `Event` JSON-LD on /bootcamp/[slug]. Every field is omitted
 *  rather than guessed when the underlying column is null. */
function partnerJsonLd(p: PartnerProfile) {
  const url = `${BASE_URL}/partners/${p.slug}`;
  const hasPlace = Boolean(p.locationCity ?? p.locationState);
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: p.displayName,
    url,
    description: p.bio ?? undefined,
    image: p.photoUrl ?? undefined,
    sameAs: p.websiteUrl ? [p.websiteUrl] : undefined,
    knowsAbout: p.specialties.length > 0 ? p.specialties.map((s) => specialty(s).label) : undefined,
    address: hasPlace
      ? {
          '@type': 'PostalAddress',
          addressLocality: p.locationCity ?? undefined,
          addressRegion: p.locationState ?? undefined,
          addressCountry: p.locationCountry ?? undefined,
        }
      : undefined,
    areaServed: p.isRemote ? 'Remote' : undefined,
    provider: { '@type': 'Organization', name: 'sparx', url: BASE_URL },
  };
}

export default async function PartnerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await fetchPartner(slug);
  if (!p) notFound();

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(partnerJsonLd(p)) }}
      />
      <ProfileHero partner={p} />
      <WorkBand partner={p} />
      <ClosingBand />
    </main>
  );
}

function ProfileHero({ partner: p }: { partner: PartnerProfile }) {
  const tier = TIER_META[p.tier];
  const location = partnerLocation(p);
  const kind = KIND_LABEL[p.kind] ?? KIND_LABEL.other;

  // ONE interpolated string, not two JSX children with a separator between them.
  // `{kind} · {location}` as siblings is how `$186a month` and `Certified1`
  // shipped on these exact pages — JSX drops the whitespace when prettier wraps.
  const meta = location ? `${kind} · ${location}` : kind;

  return (
    <Band tone="dark" flush>
      <div className="flex flex-col gap-10">
        <a href="/partners/directory" className="text-md no-underline">
          ← All partners
        </a>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {p.photoUrl ? (
              // The partner's own logo or portrait, from an arbitrary host. A
              // plain <img> is the house pattern for remote images on this site
              // (next/image would need every partner's domain in remotePatterns,
              // and a partner's host is not knowable at build time).
              <img
                src={p.photoUrl}
                alt={`${p.displayName} logo`}
                className="border-base-300 h-24 w-24 flex-shrink-0 rounded-3xl border object-cover"
              />
            ) : null}
            <div className="flex flex-col gap-4">
              <Heading
                level={1}
                size="display"
                className="max-w-4xl text-5xl leading-[0.98] tracking-tight sm:text-6xl"
              >
                {p.displayName}
              </Heading>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                {/* Solid, not soft. A soft badge paints its label in the raw
                    accent over a 15% tint of the same accent — 1.7–2.4:1 on these
                    hues (docs/silicaui/02-core-asks.md §2). */}
                <Badge color={tier.color} variant="solid" size="lg">
                  {tier.label}
                </Badge>
                <Text className="text-lg">{meta}</Text>
              </div>
            </div>
          </div>

          {p.bio ? (
            <Text variant="lead" className="text-base-content max-w-3xl text-xl">
              {p.bio}
            </Text>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {p.websiteUrl ? (
              <a
                href={p.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${p.displayName}`}
                className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
              >
                Visit their site ↗
              </a>
            ) : null}
            <a
              href="/partners/directory"
              aria-label="Browse the partner directory"
              className={buttonClasses({ size: 'xl', variant: 'outline' })}
            >
              Compare other partners
            </a>
          </div>
        </div>
      </div>
    </Band>
  );
}

/**
 * The substance of the page: what this partner actually does, and how much sparx
 * has vouched for them.
 *
 * Specialties are the only structured thing the model holds about the work, and
 * on the directory card they are five colored chips. Here there is room to say
 * what each one MEANS — the reader is a business owner deciding whether this
 * person can do the thing they need, and "CMS" is not an answer to that.
 */
function WorkBand({ partner: p }: { partner: PartnerProfile }) {
  const tier = TIER_META[p.tier];
  const note = TIER_NOTE[p.tier] ?? TIER_NOTE.informal;
  const tags = p.specialties.map((s) => ({ key: s, ...specialty(s) }));

  return (
    <Band tone="surface">
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div className="flex flex-col gap-8">
          <Heading level={2} size="display" className="text-4xl tracking-tight sm:text-5xl">
            What they work on
          </Heading>

          {tags.length > 0 ? (
            <div className="flex flex-col gap-5">
              {tags.map((t) => (
                // Term beside definition, not stacked: the badge IS the name of
                // the thing, and putting it on its own line above the sentence
                // turns it into a label introducing prose (RULE #2).
                <div
                  key={t.key}
                  className="border-base-300 flex flex-col gap-2.5 border-t pt-5 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <div className="flex-shrink-0 sm:w-40">
                    <Badge color={t.color} variant="solid" size="lg">
                      {t.label}
                    </Badge>
                  </div>
                  {t.blurb ? <Text className="max-w-xl text-lg">{t.blurb}</Text> : null}
                </div>
              ))}
            </div>
          ) : (
            <Text variant="lead" className="max-w-xl">
              This partner has not listed the kinds of work they specialise in yet. Their own site
              is the best place to see what they take on.
            </Text>
          )}
        </div>

        <Card className="border-base-300 bg-base-200 w-full border shadow-none">
          <CardBody className="flex flex-col gap-5 p-8">
            {/* Badge BESIDE the heading, never stacked above it — a badge in
                that slot is an eyebrow wearing a component (RULE #2). */}
            <div className="flex flex-wrap items-center gap-3">
              <Heading level={3} size={4} className="tracking-tight">
                What that means for you
              </Heading>
              <Badge color={tier.color} variant="solid" size="lg">
                {tier.label}
              </Badge>
            </div>
            <Text className="text-lg">{note}</Text>

            <div className="border-base-300 flex flex-col gap-1.5 border-t pt-5">
              <Heading level={4} size={6} className="tracking-tight">
                Working with them
              </Heading>
              <Text className="text-md">
                They set their own rates and invoice you directly. sparx takes nothing from what you
                pay them, and makes no introduction — contact them yourself.
              </Text>
            </div>
          </CardBody>
        </Card>
      </div>
    </Band>
  );
}

/** The close. A profile that ends after the last fact leaves the reader with
 *  nowhere to go but Back. */
function ClosingBand() {
  return (
    <Band tone="dark">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-6">
          <Heading
            level={2}
            size="display"
            className="text-5xl leading-[0.95] tracking-tight sm:text-6xl"
          >
            Not quite the right fit
            <span className="text-primary">?</span>
          </Heading>
          <Text variant="lead" className="text-base-content max-w-xl">
            The directory filters by the work you need doing and by where someone is, so you can
            line up two or three and talk to all of them.
          </Text>
        </div>
        <div className="flex flex-col items-start gap-3.5">
          <a
            href="/partners/directory"
            aria-label="Browse the partner directory"
            className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
          >
            Browse the directory →
          </a>
          <a
            href="/partners"
            aria-label="Become a partner"
            className={buttonClasses({ size: 'xl', variant: 'outline' })}
          >
            Become a partner
          </a>
        </div>
      </div>
    </Band>
  );
}
