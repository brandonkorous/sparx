// One bootcamp as a directory card (docs/114 §B.6). Presentational + no client
// state (usable from the SSR directory AND the client load-more island — imports
// only TYPES/helpers). The whole card links to the detail page. Shows the format
// pill, seats-remaining when capped, title, dates + location, and the host
// partner with their tier badge. Accent = the sparx primary brand color.

import { Badge } from '@sparx/ui';
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
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
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
            backgroundColor: 'var(--sparx-primary-tint)',
            color: 'var(--sparx-primary-hover)',
          }}
        >
          {FORMAT_LABEL[bootcamp.format]}
        </span>
        {seats ? (
          <span
            style={{
              fontFamily: SANS,
              fontSize: '12px',
              color: seats.full ? 'var(--color-warning-text)' : 'var(--color-text-tertiary)',
            }}
          >
            {seats.text}
          </span>
        ) : (
          <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
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
          color: 'var(--color-text-primary)',
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
          color: 'var(--color-text-secondary)',
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
          borderTop: '1px solid var(--color-border-default)',
          fontFamily: SANS,
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
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
