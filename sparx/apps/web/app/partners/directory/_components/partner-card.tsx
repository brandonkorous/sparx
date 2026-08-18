// One partner as a directory card (docs/114 §B.6). Presentational + no client
// state, so it serves both the SSR directory page and the client load-more
// island (it imports only TYPES from lib/partners).
//
// Three things changed from the version this replaces. The specialty tags are
// module-hued instead of four identical grey pills — see ./specialties.ts for
// why that is the whole point of the card. Every `soft` badge became `solid`,
// because a soft badge paints its label in the raw accent over a 15% tint of the
// same accent and measures 1.9–2.4:1 on these hues (filed as §2 in
// docs/silicaui/02-core-asks.md). And the body copy came off `text-sm`: the bio
// is the only prose on the card and it was set two steps under the 16px floor
// AND clamped to two lines, so it truncated mid-word on nearly every partner.

import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { partnerLocation, TIER_META, type PartnerCard as PartnerCardData } from '@/lib/partners';
import { specialty } from './specialties';

export function PartnerDirectoryCard({ partner }: { partner: PartnerCardData }) {
  const tier = TIER_META[partner.tier];
  const location = partnerLocation(partner);
  const tags = partner.specialties.slice(0, 5);

  return (
    <Card className="border-base-300 bg-base-100 h-full w-full border shadow-none">
      <CardBody className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Heading level={3} size={3} className="tracking-tight">
            {/* The name goes to the partner's profile ON sparx.works. That and
                the outbound "Visit their site" below are different destinations
                and both matter: one is the page a reader can compare, share and
                come back to; the other leaves the site entirely. */}
            <a href={`/partners/${partner.slug}`} className="no-underline">
              {partner.displayName}
            </a>
          </Heading>
          <Badge color={tier.color} variant="solid" size="md">
            {tier.label}
          </Badge>
        </div>

        {location ? <Text className="text-md">{location}</Text> : null}

        {partner.bio ? <Text className="text-lg">{partner.bio}</Text> : null}

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const s = specialty(t);
              return (
                <Badge key={t} color={s.color} variant="solid" size="sm">
                  {s.label}
                </Badge>
              );
            })}
          </div>
        ) : null}

        {partner.websiteUrl ? (
          // Genuinely outbound — the partner's own site, not their sparx
          // profile (that is the name above). The label says which, rather than
          // a "learn more" that could mean either.
          <a
            href={partner.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-md text-primary mt-auto pt-2 font-medium no-underline"
          >
            Visit their site &#8599;
          </a>
        ) : null}
      </CardBody>
    </Card>
  );
}
