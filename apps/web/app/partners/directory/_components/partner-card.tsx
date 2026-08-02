// One partner as a directory card (docs/114 §B.6). Presentational + no client
// state, so it's usable from the SSR directory page AND the client load-more
// island (it imports only TYPES from lib/partners). Shows the tier badge,
// location or Remote, a short bio, specialty tags, and a "Visit website" CTA when
// the partner lists a URL. Certified partners carry the platform-Ember badge.

import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { partnerLocation, TIER_META, type PartnerCard as PartnerCardData } from '@/lib/partners';

const SPECIALTY_LABEL: Record<string, string> = {
  ecommerce: 'E-commerce',
  commerce: 'Commerce',
  b2b: 'B2B',
  crm: 'CRM',
  email: 'Email',
  cms: 'CMS',
  seo: 'SEO',
  design: 'Design',
  migration: 'Migration',
  ai: 'AI',
};

function specialtyLabel(value: string): string {
  return SPECIALTY_LABEL[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export function PartnerDirectoryCard({ partner }: { partner: PartnerCardData }) {
  const tier = TIER_META[partner.tier];
  const location = partnerLocation(partner);
  const tags = partner.specialties.slice(0, 4);

  return (
    <Card className="border-base-300 bg-base-100 h-full w-full border">
      <CardBody className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <Badge color={tier.color} variant="soft" size="md">
            {tier.label}
          </Badge>
          {location ? (
            <Text as="span" className="text-sm">
              {location}
            </Text>
          ) : null}
        </div>

        <Heading level={3} size={4}>
          {partner.displayName}
        </Heading>

        {partner.bio ? <Text className="line-clamp-2 text-sm">{partner.bio}</Text> : null}

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Badge key={t} color="neutral" variant="soft" size="sm">
                {specialtyLabel(t)}
              </Badge>
            ))}
          </div>
        ) : null}

        {partner.websiteUrl ? (
          <a
            href={partner.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary mt-auto pt-2 text-sm font-medium no-underline"
          >
            Contact / learn more ↗
          </a>
        ) : null}
      </CardBody>
    </Card>
  );
}
