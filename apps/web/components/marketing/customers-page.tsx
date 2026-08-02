import { Button } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Display, Spark, Text, Dot } from './primitives';

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

// `color` is the token VALUE (the inline dot needs a value, not a class); `bg`
// is the literal silica class the card wash is built from — Tailwind's scanner
// can only see class names spelled out in full, never `bg-module-${key}`.
const SEGMENTS: { name: string; color: string; bg: string; blurb: string; runs: string }[] = [
  {
    name: 'Publishers & creators',
    color: 'var(--color-module-cms)',
    bg: 'bg-module-cms',
    blurb:
      'Words, media, and SEO with no cart in sight. Publish on your own domain, send the newsletter, own the audience — selling stays optional.',
    runs: 'Builder · CMS · Email',
  },
  {
    name: 'Online retailers',
    color: 'var(--color-module-commerce)',
    bg: 'bg-module-commerce',
    blurb:
      'Products, fast checkout, and one customer record that ties every order to email and support. One system, one bill, nothing taped together in the middle.',
    runs: 'Builder · Commerce · CRM · Email',
  },
  {
    name: 'B2B & wholesale',
    color: 'var(--color-module-b2b)',
    bg: 'bg-module-b2b',
    blurb:
      'Account pricing, net terms, purchase orders, and RFQ — wholesale the way it actually works. Native to the platform, not a four-figure bolt-on.',
    runs: 'Builder · Commerce · B2B · CRM',
  },
  {
    name: 'Service & fleet',
    color: 'var(--color-module-crm)',
    bg: 'bg-module-crm',
    blurb:
      'Fleet vehicles tracked by VIN and cost center, bookable service bays, and net-30 invoicing for the accounts you serve. Built for how industrial actually runs.',
    runs: 'Commerce · B2B · CRM',
  },
  {
    name: 'Agencies & multi-brand',
    color: 'var(--color-module-builder)',
    bg: 'bg-module-builder',
    blurb:
      'Run many themed sites under one tenant. Hand each client a finished site, and manage the whole portfolio from one dashboard.',
    runs: 'Builder · CMS · multi-site',
  },
  {
    name: 'AI-first & headless',
    color: 'var(--color-module-ai)',
    bg: 'bg-module-ai',
    blurb:
      'Drive everything from the API or a native MCP server. Build your own frontend, and let agents read and write live data with scoped, audited keys.',
    runs: 'AI · MCP · Builder (headless)',
  },
];

const GILLETT_RUNS = ['Commerce', 'B2B · Fleet', 'CRM', 'AI', 'Managed hosting'];

export function CustomersPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="page" padding="lg">
        <div className="flex max-w-[820px] flex-col gap-6">
          <Display as="h1" size={64}>
            Who runs on sparx
            <Spark />
          </Display>
          <Text size={18} className="max-w-[640px]">
            Publishers, retailers, distributors, agencies, AI-first teams. sparx isn&apos;t a store
            with extras bolted on. Each one turns on the modules they need, and pays for nothing
            they don&apos;t.
          </Text>
        </div>
      </Section>

      {/* User-type segments */}
      <Section surface="surface" padding="xl">
        <div className="flex flex-col gap-12">
          <SectionHeader
            headline="However you operate"
            accent="var(--color-primary)"
            lede="A CMS-only publisher, a CRM-only team, a B2B distributor — all first-class. Here's the shape it usually takes."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SEGMENTS.map((s) => (
              <div
                key={s.name}
                className={`${s.bg} border-base-300 bg-soft flex min-h-[230px] flex-col gap-3 rounded-xl border px-[26px] py-7`}
              >
                <Text
                  as="span"
                  size={17}
                  weight={500}
                  className="flex items-center gap-2.5 tracking-[-0.01em]"
                >
                  <Dot color={s.color} size={9} />
                  {s.name}
                </Text>
                <Text size={14} className="flex-1">
                  {s.blurb}
                </Text>
                <Text as="span" mono size={12}>
                  {s.runs}
                </Text>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Flagship: Gillett Diesel */}
      <Section surface="page" padding="xl">
        {/* RULE #2: the uppercase mono "First enterprise client" pill that used to
            sit directly above this headline was an eyebrow badge — removed. */}
        <div className="bg-module-b2b border-base-300 bg-soft flex flex-col gap-7 rounded-2xl border p-[clamp(32px,5vw,56px)]">
          <Display as="h2" size={40}>
            Gillett Diesel Service
            <Spark color="var(--color-module-b2b)" />
          </Display>

          <Text size={17} className="max-w-[720px]">
            A diesel service and parts operation running the full industrial playbook on sparx:
            wholesale accounts with net terms and PO checkout, a fleet module tracking vehicles by
            VIN and cost center, bookable service bays, and a native MCP server so the team can ask
            about parts and orders in plain language. It runs on a custom frontend with managed
            hosting on the Enterprise plan — the requirements that shaped sparx&apos;s first B2B and
            fleet features.
          </Text>

          <div className="flex flex-wrap gap-2">
            {GILLETT_RUNS.map((r) => (
              <Text
                key={r}
                as="span"
                size={13}
                className="bg-base-200 border-base-300 rounded-full border px-3 py-1.5"
              >
                {r}
              </Text>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section surface="surface" padding="xl">
        <div className="flex max-w-[720px] flex-col gap-6">
          <SectionHeader
            headline="Your story goes here"
            accent="var(--color-primary)"
            lede="Running something that doesn't fit a template? That's the point. Tell us what you operate and we'll map it onto sparx."
          />
          <div className="flex flex-wrap gap-3">
            <a href="/contact">
              <Button color="neutral" size="lg">
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
