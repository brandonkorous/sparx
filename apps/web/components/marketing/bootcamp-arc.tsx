import { Section, SectionHeader, Spark } from './primitives';

/**
 * The build arc — the /bootcamp standout device. A horizontal build track whose
 * four waypoints each wear their real module hue (site indigo · customers cyan ·
 * email sky · automation fuchsia), terminating in a "Publish" ignition — the
 * graduation moment, carried in the sparx primary brand color. On tablet/mobile
 * the track becomes a vertical timeline (dot rail on the left). The argument is
 * layout: you build a real business one module at a time, and launching is the
 * finish line.
 */

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';
// The page's brand accent = sparx primary (not a module hue — the bootcamp is a
// platform program). The four build waypoints below keep their own module hues.
const PRIMARY = 'var(--color-primary)';
const PRIMARY_TINT = 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))';
const PRIMARY_TEXT = 'var(--color-primary)';

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

      <div style={{ marginTop: '60px' }}>
        <div className="mkt-arc-track">
          <span className="mkt-arc-line" style={{ backgroundColor: 'var(--color-base-300)' }} />
          {WAYPOINTS.map((w) => (
            <div key={w.tag} className="mkt-arc-wp">
              <Dot color={w.color} />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                  display: 'block',
                }}
              >
                {w.tag}
              </span>
              <h3
                style={{
                  margin: '10px 0 0',
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                }}
              >
                {w.title}
              </h3>
              <p
                style={{
                  margin: '7px 0 0',
                  fontFamily: SANS,
                  fontSize: '13.5px',
                  lineHeight: '20px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                }}
              >
                {w.body}
              </p>
            </div>
          ))}
          {/* Publish terminus */}
          <div className="mkt-arc-wp">
            <span
              className="mkt-arc-dot"
              aria-hidden
              style={{
                display: 'block',
                width: 28,
                height: 28,
                borderRadius: 9999,
                backgroundColor: PRIMARY,
                border: '3px solid var(--color-base-100)',
                boxShadow: `0 0 0 6px ${PRIMARY_TINT}`,
              }}
            />
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                display: 'block',
              }}
            >
              graduation
            </span>
            <h3
              style={{
                margin: '10px 0 0',
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '16px',
                letterSpacing: '-0.01em',
                color: PRIMARY_TEXT,
              }}
            >
              Publish
              <Spark color={PRIMARY} />
            </h3>
            <p
              style={{
                margin: '7px 0 0',
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '20px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              Hit publish. Your business is live — and everything you built is yours.
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            backgroundColor: PRIMARY_TINT,
            borderRadius: '9999px',
            fontFamily: SANS,
            fontSize: '15px',
            fontWeight: 500,
            color: PRIMARY_TEXT,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: PRIMARY }} />
          New to sparx? Start with a 14-day free trial
        </div>
      </div>
    </Section>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="mkt-arc-dot"
      aria-hidden
      style={{
        display: 'block',
        width: 24,
        height: 24,
        borderRadius: 9999,
        backgroundColor: color,
        border: '3px solid var(--color-base-100)',
        boxShadow: '0 0 0 1px var(--color-base-300)',
      }}
    />
  );
}
