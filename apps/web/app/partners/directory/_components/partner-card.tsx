// One partner as a directory card (docs/114 §B.6). Presentational + no client
// state, so it's usable from the SSR directory page AND the client load-more
// island (it imports only TYPES from lib/partners). Shows the tier badge,
// location or Remote, a short bio, specialty tags, and a "Visit website" CTA when
// the partner lists a URL. Certified partners carry the platform-indigo badge.

import { Badge } from '@wizeworks/silicaui-react';
import { partnerLocation, TIER_META, type PartnerCard as Card } from '@/lib/partners';

const SANS = 'var(--font-sans)';

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

export function PartnerDirectoryCard({ partner }: { partner: Card }) {
  const tier = TIER_META[partner.tier];
  const location = partnerLocation(partner);
  const tags = partner.specialties.slice(0, 4);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        padding: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <Badge color={tier.color} variant="soft" size="md">
          {tier.label}
        </Badge>
        {location ? (
          <span
            style={{
              fontFamily: SANS,
              fontSize: '13px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            {location}
          </span>
        ) : null}
      </div>

      <h3
        style={{
          margin: 0,
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: '19px',
          letterSpacing: '-0.015em',
          lineHeight: '25px',
          color: 'var(--color-base-content)',
        }}
      >
        {partner.displayName}
      </h3>

      {partner.bio ? (
        <p
          style={{
            margin: 0,
            fontFamily: SANS,
            fontSize: '14px',
            lineHeight: '22px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {partner.bio}
        </p>
      ) : null}

      {tags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                fontFamily: SANS,
                fontSize: '12px',
                padding: '3px 9px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-base-200)',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {specialtyLabel(t)}
            </span>
          ))}
        </div>
      ) : null}

      {partner.websiteUrl ? (
        <a
          href={partner.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 'auto',
            paddingTop: '8px',
            fontFamily: SANS,
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--color-primary)',
            textDecoration: 'none',
          }}
        >
          Contact / learn more ↗
        </a>
      ) : null}
    </div>
  );
}
