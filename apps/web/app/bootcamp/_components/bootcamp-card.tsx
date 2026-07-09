// One bootcamp as a directory card (docs/114 §B.6). Presentational + no client
// state (usable from the SSR directory AND the client load-more island — imports
// only TYPES/helpers). The whole card links to the detail page. Shows the format
// pill, seats-remaining when capped, title, dates + location, and the host
// partner with their tier badge. Accent = the sparx primary brand color.

import { Badge } from '@wizeworks/silicaui-react';
import { TIER_META } from '@/lib/partners';
import {
  bootcampDates,
  bootcampLocation,
  bootcampPrice,
  FORMAT_LABEL,
  seatsLabel,
  type BootcampCard as Card,
} from '@/lib/bootcamp';

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

export function BootcampDirectoryCard({ bootcamp }: { bootcamp: Card }) {
  const seats = seatsLabel(bootcamp);
  const tier = TIER_META[bootcamp.host.tier];
  const price = bootcampPrice(bootcamp);

  return (
    <a
      href={`/bootcamp/${bootcamp.slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        padding: '24px',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '9999px',
            backgroundColor: 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))',
            color: 'var(--color-primary)',
          }}
        >
          {FORMAT_LABEL[bootcamp.format]}
        </span>
        {seats ? (
          <span
            style={{
              fontFamily: SANS,
              fontSize: '12px',
              color: seats.full
                ? 'var(--color-warning)'
                : 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            {seats.text}
          </span>
        ) : (
          <span
            style={{
              fontFamily: SANS,
              fontSize: '12px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            {price}
          </span>
        )}
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
        {bootcamp.title}
      </h3>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          fontFamily: SANS,
          fontSize: '13.5px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        <span>{bootcampDates(bootcamp)}</span>
        <span>{bootcampLocation(bootcamp)}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: 'auto',
          paddingTop: '14px',
          borderTop: '1px solid var(--color-base-300)',
          fontFamily: SANS,
          fontSize: '13px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        <Badge color={tier.color} variant="soft" size="sm">
          {tier.label}
        </Badge>
        {bootcamp.host.displayName}
      </div>
    </a>
  );
}
