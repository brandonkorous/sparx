import { Button } from '@sparx/ui';
import { Section, SectionHeader, Display, Spark } from './primitives';

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
      'Words, media, and SEO with no shopping cart in sight. Publish on your own domain, send the newsletter, own the audience — selling is optional, never assumed.',
    runs: 'Builder · CMS · Email',
  },
  {
    name: 'Online retailers',
    color: 'var(--module-commerce)',
    blurb:
      'Products, one-tap checkout, and a single customer record that ties every order to email and support. One system, one bill, no Zapier in the middle.',
    runs: 'Builder · Commerce · CRM · Email',
  },
  {
    name: 'B2B & wholesale',
    color: 'var(--module-b2b)',
    blurb:
      'Account pricing, net terms, purchase orders, and RFQ — wholesale the way it actually works, native to the platform instead of a four-figure bolt-on.',
    runs: 'Builder · Commerce · B2B · CRM',
  },
  {
    name: 'Service & fleet',
    color: 'var(--module-crm)',
    blurb:
      'Fleet vehicles tracked by VIN and cost center, bookable service bays, and net-30 invoicing for the accounts you serve — built for how industrial really runs.',
    runs: 'Commerce · B2B · CRM',
  },
  {
    name: 'Agencies & multi-brand',
    color: 'var(--module-builder)',
    blurb:
      'Spin up many themed properties under one tenant, hand each client a polished site, and manage the whole portfolio from one dashboard.',
    runs: 'Builder · CMS · multi-property',
  },
  {
    name: 'AI-first & headless',
    color: 'var(--module-ai)',
    blurb:
      'Drive everything from the API or a native MCP server — build your own frontend, and let agents read and write live data with scoped, audited keys.',
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
            Who builds on sparx
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
            Publishers, retailers, wholesale distributors, agencies. sparx isn&apos;t a store with
            extras bolted on — each operator turns on the modules they need, and nothing they
            don&apos;t.
          </p>
        </div>
      </Section>

      {/* User-type segments */}
      <Section surface="surface" padding="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <SectionHeader
            headline="However you operate"
            accent="var(--sparx-primary)"
            lede="A CMS-only publisher, a CRM-only team, and a B2B distributor are all first-class. Here's the shape it tends to take."
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
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderTop: `3px solid ${s.color}`,
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
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderTop: '3px solid var(--module-b2b)',
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
            VIN and cost center, bookable service bays, and a native MCP server so their team can
            query parts and orders in plain language. It runs on a custom frontend with managed
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
            lede="Building something that doesn't fit a template? That's the point. Tell us what you're running and we'll help you map it onto sparx."
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
