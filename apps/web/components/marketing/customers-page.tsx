import { Button } from '@sparx/ui';
import { Section, SectionHeader, Display, Spark, moduleTint } from './primitives';

/**
 * The /customers page. Leads with *who* sparx is for — organized by user-type,
 * not by a single "we sell stores" assumption — then the flagship enterprise
 * story (Gillett Diesel) and an invitation. Intentionally not a megamenu: one
 * page, segmented by operator type; it can graduate to a menu once individual
 * segments earn their own landing pages.
 *
 * Honest framing: no invented quotes or metrics. Gillett is described by what
 * they actually run on the platform.
 */

const SEGMENTS: { name: string; color: string; blurb: string; runs: string }[] = [
  {
    name: 'Publishers & creators',
    color: 'var(--module-cms)',
    blurb:
      'Words, media, and SEO with no cart in sight. Publish on your own domain, send the newsletter, own the audience — selling stays optional.',
    runs: 'Builder · CMS · Email',
  },
  {
    name: 'Online retailers',
    color: 'var(--module-commerce)',
    blurb:
      'Products, fast checkout, and one customer record that ties every order to email and support. One system, one bill, nothing taped together in the middle.',
    runs: 'Builder · Commerce · CRM · Email',
  },
  {
    name: 'B2B & wholesale',
    color: 'var(--module-b2b)',
    blurb:
      'Account pricing, net terms, purchase orders, and RFQ — wholesale the way it actually works. Native to the platform, not a four-figure bolt-on.',
    runs: 'Builder · Commerce · B2B · CRM',
  },
  {
    name: 'Service & fleet',
    color: 'var(--module-crm)',
    blurb:
      'Fleet vehicles tracked by VIN and cost center, bookable service bays, and net-30 invoicing for the accounts you serve. Built for how industrial actually runs.',
    runs: 'Commerce · B2B · CRM',
  },
  {
    name: 'Agencies & multi-brand',
    color: 'var(--module-builder)',
    blurb:
      'Run many themed sites under one tenant. Hand each client a finished site, and manage the whole portfolio from one dashboard.',
    runs: 'Builder · CMS · multi-site',
  },
  {
    name: 'AI-first & headless',
    color: 'var(--module-ai)',
    blurb:
      'Drive everything from the API or a native MCP server. Build your own frontend, and let agents read and write live data with scoped, audited keys.',
    runs: 'AI · MCP · Builder (headless)',
  },
];

const GILLETT_RUNS = ['Commerce', 'B2B · Fleet', 'CRM', 'AI · MCP', 'Managed hosting'];

export function CustomersPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="page" padding="lg">
        <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Display as="h1" size={64}>
            Who runs on sparx
            <Spark />
          </Display>
          <p
            style={{
              margin: 0,
              maxWidth: '640px',
              fontFamily: 'var(--font-sans)',
              fontSize: '18px',
              lineHeight: '30px',
              color: 'var(--color-text-secondary)',
            }}
          >
            Publishers, retailers, distributors, agencies, AI-first teams. sparx isn&apos;t a store
            with extras bolted on. Each one turns on the modules they need, and pays for nothing
            they don&apos;t.
          </p>
        </div>
      </Section>

      {/* User-type segments */}
      <Section surface="surface" padding="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <SectionHeader
            headline="However you operate"
            accent="var(--sparx-primary)"
            lede="A CMS-only publisher, a CRM-only team, a B2B distributor — all first-class. Here's the shape it usually takes."
          />
          <div className="mkt-grid-3-2-1">
            {SEGMENTS.map((s) => (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '28px 26px',
                  backgroundColor: moduleTint(s.color),
                  border: '1px solid var(--color-border-default)',
                  borderRadius: '12px',
                  minHeight: '230px',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '17px',
                    letterSpacing: '-0.01em',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 9999,
                      backgroundColor: s.color,
                      flexShrink: 0,
                    }}
                  />
                  {s.name}
                </span>
                <p
                  style={{
                    margin: 0,
                    flex: 1,
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    lineHeight: '22px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {s.blurb}
                </p>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {s.runs}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Flagship: Gillett Diesel */}
      <Section surface="page" padding="xl">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
            padding: 'clamp(32px, 5vw, 56px)',
            backgroundColor: moduleTint('var(--module-b2b)'),
            border: '1px solid var(--color-border-default)',
            borderRadius: '16px',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              width: 'fit-content',
              padding: '5px 12px',
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '9999px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 9999,
                backgroundColor: 'var(--module-b2b)',
              }}
            />
            First enterprise client
          </span>

          <Display as="h2" size={40}>
            Gillett Diesel Service
            <Spark color="var(--module-b2b)" />
          </Display>

          <p
            style={{
              margin: 0,
              maxWidth: '720px',
              fontFamily: 'var(--font-sans)',
              fontSize: '17px',
              lineHeight: '28px',
              color: 'var(--color-text-secondary)',
            }}
          >
            A diesel service and parts operation running the full industrial playbook on sparx:
            wholesale accounts with net terms and PO checkout, a fleet module tracking vehicles by
            VIN and cost center, bookable service bays, and a native MCP server so the team can ask
            about parts and orders in plain language. It runs on a custom frontend with managed
            hosting on the Enterprise plan — the requirements that shaped sparx&apos;s first B2B and
            fleet features.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {GILLETT_RUNS.map((r) => (
              <span
                key={r}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-bg-page)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: '9999px',
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section surface="surface" padding="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px' }}>
          <SectionHeader
            headline="Your story goes here"
            accent="var(--sparx-primary)"
            lede="Running something that doesn't fit a template? That's the point. Tell us what you operate and we'll map it onto sparx."
          />
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a href="/contact">
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Talk to us →
              </Button>
            </a>
            <a href="/platform">
              <Button size="lg" variant="outline">
                See the platform
              </Button>
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}
