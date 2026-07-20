import { Button } from '@wizeworks/silicaui-react';
import { CAPABILITY_AREAS, capabilityCounts } from '@/lib/capabilities';
import { Display, Dot, Section, SectionHeader } from './primitives';
import { Reveal } from './reveal';

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
  'scheduling',
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
      <Reveal>
        <SectionHeader
          accent="var(--color-primary)"
          headline={
            <>
              The tiles are the labels.{' '}
              <span className="text-ink-subtle">Look what&apos;s under them</span>
            </>
          }
          lede={
            <>
              Each module is a deep product, not a checkbox. Together they ship{' '}
              <b className="text-base-content font-medium">{counts.live} capabilities</b> you can
              use today — with {counts.building} more in build. Here&apos;s a taste.
            </>
          }
        />

        <div className="mt-[52px] flex flex-col items-start gap-12 lg:flex-row">
          {/* stat + CTA */}
          <div className="w-80 shrink-0">
            <Display size={72} lineHeight={68}>
              {counts.live}
              <span className="text-primary">+</span>
            </Display>
            <p className="text-ink-muted text-body mt-3.5 mb-0">
              shipped capabilities across {counts.modules} modules and the shared platform — one
              data layer, one dashboard, one bill.
            </p>
            <div className="mt-[26px]">
              <a href="/features">
                <Button color="neutral" size="lg">
                  See everything →
                </Button>
              </a>
            </div>
            <span className="text-ink-subtle text-mini mt-3.5 block font-mono">
              {counts.live} live · {counts.building} in build · {counts.planned} planned
            </span>
          </div>

          {/* sample chip cloud */}
          <div className="flex flex-1 flex-wrap gap-[9px]">
            {SAMPLE.map((cap) => (
              <span
                key={cap.name}
                className="border-base-300 bg-base-100 text-base-content text-caption inline-flex items-center gap-2 rounded-full border px-3.5 py-2"
              >
                <Dot color={cap.accent} size={7} />
                {cap.name}
              </span>
            ))}
            <a
              href="/features"
              className="border-base-300 text-primary text-caption inline-flex items-center gap-1.5 rounded-full border border-dashed bg-transparent px-3.5 py-2 font-medium no-underline"
            >
              + {remaining} more →
            </a>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
