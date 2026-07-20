import { Section, SectionHeader, Spark, Text } from './primitives';

/**
 * The build arc — the /bootcamp standout device. A horizontal build track whose
 * four waypoints each wear their real module hue (site indigo · customers cyan ·
 * email sky · automation fuchsia), terminating in a "Publish" ignition — the
 * graduation moment, carried in the sparx primary brand color. On tablet/mobile
 * the track becomes a vertical timeline (dot rail on the left). The argument is
 * layout: you build a real business one module at a time, and launching is the
 * finish line.
 */

// The page's brand accent = sparx primary (not a module hue — the bootcamp is a
// platform program). The four build waypoints below keep their own module hues.
const PRIMARY = 'var(--color-primary)';

const WAYPOINTS: { color: string; tag: string; title: React.ReactNode; body: string }[] = [
  {
    color: 'var(--color-module-builder)',
    tag: 'week 1',
    title: 'Site',
    body: 'Stand up your site with the builder — pages, content, and catalog.',
  },
  {
    color: 'var(--color-module-crm)',
    tag: 'week 2',
    title: 'Customers',
    body: 'Set up the CRM — contacts, segments, the pipeline that tracks every lead.',
  },
  {
    color: 'var(--color-module-email)',
    tag: 'week 3',
    title: 'Email',
    body: 'Design your welcome flow and first broadcast on a warm sending domain.',
  },
  {
    color: 'var(--color-module-automations)',
    tag: 'week 4',
    title: 'Automation',
    body: 'Wire the flows that run the business while you sleep — the automation layer.',
  },
];

export function BootcampArc() {
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={PRIMARY}
        headline={<>Build it piece by piece. Graduate the day you launch</>}
        lede="The bootcamp is a build. Week by week, you stand up a real business on sparx — site, customers, email, automation — and the graduation moment is the one that matters: hitting publish and going live."
      />

      {/* RULE #2: the mono `week 1`…`graduation` step markers that sat directly
          above each waypoint heading were eyebrows — removed. The lede already
          carries the week-by-week framing. */}
      <div className="mt-15">
        <div className="mkt-arc-track">
          <span className="mkt-arc-line bg-base-300" />
          {WAYPOINTS.map((w) => (
            <div key={w.tag} className="mkt-arc-wp">
              <Dot color={w.color} />
              <Text
                as="h3"
                size={16}
                weight={500}
                tone="default"
                className="mt-2.5 tracking-[-0.01em]"
              >
                {w.title}
              </Text>
              <Text size={14} className="mt-[7px]">
                {w.body}
              </Text>
            </div>
          ))}
          {/* Publish terminus */}
          <div className="mkt-arc-wp">
            <span
              className="mkt-arc-dot bg-primary border-base-100 ring-primary/15 block size-7 rounded-full border-[3px] ring-6"
              aria-hidden
            />
            <Text
              as="h3"
              size={16}
              weight={500}
              tone="none"
              className="text-primary mt-2.5 tracking-[-0.01em]"
            >
              Publish
              <Spark color={PRIMARY} />
            </Text>
            <Text size={14} className="mt-[7px]">
              Hit publish. Your business is live — and everything you built is yours.
            </Text>
          </div>
        </div>

        <Text
          as="div"
          size={15}
          weight={500}
          tone="none"
          className="bg-primary text-primary bg-soft mt-11 inline-flex items-center gap-3 rounded-full px-5 py-3"
        >
          <span aria-hidden className="bg-primary size-2 rounded-full" />
          New to sparx? Start with a 14-day free trial
        </Text>
      </div>
    </Section>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="mkt-arc-dot border-base-100 ring-base-300 block size-6 rounded-full border-[3px] ring-1"
      aria-hidden
      style={{ backgroundColor: color }}
    />
  );
}
