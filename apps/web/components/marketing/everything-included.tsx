import { Button } from '@sparx/ui';
import { CAPABILITY_AREAS, capabilityCounts } from '@/lib/capabilities';
import { Display, Dot, Section, SectionHeader } from './primitives';

/**
 * Home-page breadth band. The modules grid above sells the tiles; this answers
 * the obvious next question — "what's actually inside them?" — with the real
 * capability count and a multi-color sample cloud, then sends people to
 * /features for the full index.
 *
 * Original to the home page (not lifted from another section). The number and
 * the sample chips both derive from lib/capabilities.ts, so this can never claim
 * more than the catalog actually lists.
 */

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// A vivid cross-module sample — first couple of shipped capabilities from a
// spread of areas, colored by the area's accent. Derived, not hand-listed, so
// it tracks the catalog.
const SAMPLE_AREA_IDS = [
  'builder',
  'commerce',
  'b2b',
  'crm',
  'email',
  'cms',
  'ai',
  'dropship',
  'search',
  'automation',
] as const;

const SAMPLE = SAMPLE_AREA_IDS.flatMap((id) => {
  const area = CAPABILITY_AREAS.find((a) => a.id === id);
  if (!area) return [];
  return area.capabilities
    .filter((c) => c.status === 'live')
    .slice(0, 2)
    .map((c) => ({ name: c.name, accent: area.accent }));
});

export function EverythingIncluded() {
  const counts = capabilityCounts();
  const remaining = counts.live - SAMPLE.length;

  return (
    <Section padding="lg">
      <SectionHeader
        accent="var(--sparx-primary)"
        headline={
          <>
            The tiles are the labels.{' '}
            <span style={{ color: 'var(--color-text-tertiary)' }}>Look what&apos;s under them</span>
          </>
        }
        lede={
          <>
            Each module is a deep product, not a checkbox. Together they ship{' '}
            <b style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {counts.live} capabilities
            </b>{' '}
            you can use today — with {counts.building} more in build. Here&apos;s a taste.
          </>
        }
      />

      <div
        className="mkt-stack-on-tablet"
        style={{ marginTop: '52px', gap: '48px', alignItems: 'flex-start' }}
      >
        {/* stat + CTA */}
        <div style={{ width: '320px', flexShrink: 0 }}>
          <Display size={72} lineHeight={68}>
            {counts.live}
            <span style={{ color: 'var(--sparx-primary)' }}>+</span>
          </Display>
          <p
            style={{
              margin: '14px 0 0',
              fontFamily: SANS,
              fontSize: '16px',
              lineHeight: '25px',
              color: 'var(--color-text-secondary)',
            }}
          >
            shipped capabilities across {counts.modules} modules and the shared platform — one data
            layer, one dashboard, one bill.
          </p>
          <div style={{ marginTop: '26px' }}>
            <a href="/features">
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                See everything →
              </Button>
            </a>
          </div>
          <span
            style={{
              display: 'block',
              marginTop: '14px',
              fontFamily: MONO,
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {counts.live} live · {counts.building} in build · {counts.planned} planned
          </span>
        </div>

        {/* sample chip cloud */}
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
          {SAMPLE.map((cap) => (
            <span
              key={cap.name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '9999px',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-surface)',
                fontFamily: SANS,
                fontSize: '13.5px',
                color: 'var(--color-text-primary)',
              }}
            >
              <Dot color={cap.accent} size={7} />
              {cap.name}
            </span>
          ))}
          <a
            href="/features"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9999px',
              border: '1px dashed var(--color-border-default)',
              backgroundColor: 'transparent',
              fontFamily: SANS,
              fontSize: '13.5px',
              fontWeight: 500,
              color: 'var(--sparx-primary)',
              textDecoration: 'none',
            }}
          >
            + {remaining} more →
          </a>
        </div>
      </div>
    </Section>
  );
}
