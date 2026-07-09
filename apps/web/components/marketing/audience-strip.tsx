import { Container } from './primitives';
import { MODULE_HEX } from './modules-catalog';

// The honest replacement for a fake "customers who use us" logo wall. sparx is
// pre-launch, so inventing brand logos + "operating live" would be fabricated
// proof. Instead this band answers "is this for me?" truthfully: a scrolling
// marquee of the KINDS of business sparx is built for — deliberately spanning
// content, commerce, and services so the content-and/or-commerce promise reads
// at a glance (not commerce-only). Nothing here claims a customer relationship.

// A broad, varied spread — content-first, commerce-first, and service businesses
// side by side. No single vertical is the default lens.
const AUDIENCES = [
  'Makers',
  'Publishers',
  'Boutiques',
  'Studios',
  'Roasters',
  'Clinics',
  'Distributors',
  'Nonprofits',
  'Agencies',
  'Restaurants',
  'Galleries',
  'Consultancies',
  'Wholesalers',
  'Creators',
] as const;

// Cycle the marker through the module palette so the strip carries brand color
// without implying a logo. Order is stable, so it's deterministic.
const DOT_HUES = Object.values(MODULE_HEX);

export function AudienceStrip() {
  return (
    <section
      style={{
        paddingTop: '40px',
        paddingBottom: '40px',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-base-100)',
        borderTop: '1px solid var(--color-base-300)',
        borderBottom: '1px solid var(--color-base-300)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            }}
          >
            Built for whatever you run
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            content, commerce, or both
          </span>
        </div>
        {/* Continuous marquee — the list is rendered twice so the -50% scroll
            loops seamlessly (see .mkt-marquee in marketing.css). */}
        <div className="mkt-marquee">
          <div className="mkt-marquee-track">
            {[...AUDIENCES, ...AUDIENCES].map((name, i) => (
              <div
                key={i}
                aria-hidden={i >= AUDIENCES.length}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  paddingRight: '56px',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 9999,
                    backgroundColor: DOT_HUES[i % DOT_HUES.length],
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '18px',
                    letterSpacing: '-0.02em',
                    color: 'var(--color-base-content)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
