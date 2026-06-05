import type { ReactNode } from 'react';
import { Button } from '@sparx/ui';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  type MarketingModule,
  Section,
  SectionHeader,
  Spark,
} from './primitives';

/**
 * The /platform marketing page — the "what is Sparx as a system" page reached
 * from the header's first nav item. Deliberately DISTINCT from the home page:
 * the home page sells the marketing beats (cost comparison, the MCP chat demo,
 * the permanence promise); this page explains how the system actually works.
 * No section is lifted from the home page's sections.
 *
 * Ported from mockups/platform.html. Built on the marketing primitives + the
 * eight module colors via getModuleColor(), so accents stay consistent with
 * the rest of the brand. Section backgrounds alternate page → surface for
 * rhythm, with one near-black band (the API surface) before the close.
 */
export function PlatformPage() {
  return (
    <>
      <PlatformHero />
      <OneSystem />
      <OneRecord />
      <FourCommitments />
      <GrowsWithYou />
      <ModulesStrip />
      <ApiSurface />
      <Foundations />
      <PricingTeaser />
      <PlatformCta />
    </>
  );
}

// Module colors, resolved once. getModuleColor returns { color, tint, text }
// where `color` is a CSS var (var(--module-*)) so it tracks the token system.
const MODS = {
  builder: getModuleColor('builder'),
  commerce: getModuleColor('commerce'),
  cms: getModuleColor('cms'),
  crm: getModuleColor('crm'),
  email: getModuleColor('email'),
  b2b: getModuleColor('b2b'),
  ai: getModuleColor('ai'),
  dropship: getModuleColor('dropship'),
} as const;

const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

// ── HERO ─────────────────────────────────────────────────────────────────
function PlatformHero() {
  const metrics = [
    { v: '8', s: 'modules, one platform' },
    { v: '1', s: 'shared data layer' },
    { v: '$10', suffix: '/mo', s: 'starting price' },
    { v: 'MCP', spark: true, s: 'native AI access' },
    { v: '100%', s: 'API-first, your data' },
  ] as const;

  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-bg-page)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <div style={{ maxWidth: '1100px' }}>
          <Display as="h1" size={104} lineHeight={96}>
            One platform for{' '}
            <span style={{ color: 'var(--color-text-tertiary)' }}>
              content and commerce
              <Spark />
            </span>
          </Display>
        </div>

        <div
          className="mkt-stack-on-tablet mkt-align-end-on-desktop"
          style={{ justifyContent: 'space-between', gap: '40px', maxWidth: '1280px' }}
        >
          <p
            style={{
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: 'clamp(16px, 1.6vw, 20px)',
              lineHeight: 1.55,
              color: 'var(--color-text-secondary)',
              maxWidth: '600px',
              margin: 0,
            }}
          >
            Sparx is a modular operating system for the web. Builder, Commerce, CMS, CRM, Email,
            B2B, Dropship, and AI — running on one shared data layer, behind one dashboard, on one
            bill. A publisher, a storefront, a wholesale distributor, and a CRM-only team are all
            equally first-class. Selling is one capability, never the assumption.
          </p>

          <div
            className="mkt-align-end-on-desktop"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              alignItems: 'flex-start',
            }}
          >
            <div className="mkt-cluster" style={{ gap: '12px' }}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Start free →
              </Button>
              <Button size="lg" variant="outline">
                Talk to sales
              </Button>
            </div>
            <span
              style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-tertiary)' }}
            >
              No credit card · Live in five minutes
            </span>
          </div>
        </div>

        <div
          className="mkt-cluster"
          style={{
            justifyContent: 'space-between',
            paddingTop: '32px',
            marginTop: '8px',
            borderTop: '1px solid var(--color-border-default)',
            gap: '32px 56px',
          }}
        >
          {metrics.map((m) => (
            <div key={m.s} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '26px',
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {m.v}
                {'suffix' in m && m.suffix ? (
                  <span
                    style={{
                      color: 'var(--color-text-tertiary)',
                      fontWeight: 400,
                      fontSize: '16px',
                    }}
                  >
                    {m.suffix}
                  </span>
                ) : null}
                {'spark' in m && m.spark ? <Spark /> : null}
              </span>
              <span
                style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}
              >
                {m.s}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ── ONE SYSTEM · data-layer diagram ────────────────────────────────────────
function OneSystem() {
  const chips: { label: string; module: MarketingModule }[] = [
    { label: 'Builder', module: 'builder' },
    { label: 'Commerce', module: 'commerce' },
    { label: 'CMS', module: 'cms' },
    { label: 'CRM', module: 'crm' },
    { label: 'Email', module: 'email' },
    { label: 'B2B', module: 'b2b' },
    { label: 'AI / MCP', module: 'ai' },
    { label: 'Dropship', module: 'dropship' },
  ];

  return (
    <Section surface="surface" padding="lg">
      <div style={{ maxWidth: '720px' }}>
        <SectionHeader
          accent="var(--sparx-primary)"
          headline={<>Not integrations. One system</>}
          lede={
            <>
              Every other &ldquo;all-in-one&rdquo; is a bundle of separate products stitched
              together with syncs that drift and break. Sparx modules read and write the same
              records. Your CRM is built <em>on</em> your commerce data — not connected to a copy of
              it.
            </>
          }
        />
      </div>

      <div
        style={{
          marginTop: '56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* module chips */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          {chips.map((c) => (
            <span
              key={c.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 15px',
                backgroundColor: 'var(--color-bg-page)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '9999px',
                fontFamily: SANS,
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
              }}
            >
              <Dot color={MODS[c.module].color} size={8} />
              {c.label}
            </span>
          ))}
        </div>

        {/* converging connector */}
        <div style={{ width: '100%', maxWidth: '760px', height: '44px' }} aria-hidden>
          <svg
            viewBox="0 0 760 44"
            fill="none"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <path d="M60 0 V14 Q60 22 110 22 H370" stroke="#d4d4d8" strokeWidth={1.5} />
            <path d="M180 0 V14 Q180 22 230 22 H380" stroke="#d4d4d8" strokeWidth={1.5} />
            <path d="M300 0 V22 H380" stroke="#d4d4d8" strokeWidth={1.5} />
            <path d="M420 0 V22 H380" stroke="#d4d4d8" strokeWidth={1.5} />
            <path d="M540 0 V14 Q540 22 490 22 H380" stroke="#d4d4d8" strokeWidth={1.5} />
            <path d="M700 0 V14 Q700 22 650 22 H380" stroke="#d4d4d8" strokeWidth={1.5} />
            <path d="M380 22 V44" stroke="var(--sparx-primary)" strokeWidth={2} />
            <circle cx="380" cy="22" r="3.5" fill="var(--sparx-primary)" />
          </svg>
        </div>

        {/* data layer bar (dark) */}
        <div
          style={{
            width: '100%',
            maxWidth: '880px',
            borderRadius: '14px',
            padding: '22px 28px',
            backgroundColor: '#0A0A0A',
            borderTop: '3px solid var(--sparx-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: '420px' }}>
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: '18px', color: '#FFFFFF' }}>
              One data layer
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '20px',
                color: 'rgba(255,255,255,0.6)',
                marginTop: '4px',
              }}
            >
              Postgres with row-level security per tenant. Customers, orders, content, and contacts
              are the same records everywhere.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['tenant-isolated', 'RLS-enforced', 'event-driven'].map((t) => (
              <DarkTag key={t}>{t}</DarkTag>
            ))}
          </div>
        </div>

        {/* surface bar (light) */}
        <div
          style={{
            width: '100%',
            maxWidth: '880px',
            marginTop: '14px',
            borderRadius: '14px',
            padding: '22px 28px',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: '440px' }}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '18px',
                color: 'var(--color-text-primary)',
              }}
            >
              One surface — API-first &amp; MCP-native
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '20px',
                color: 'var(--color-text-secondary)',
                marginTop: '4px',
              }}
            >
              Every feature is an API endpoint first. The dashboard, your site, and your AI are all
              just clients of the same API.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['REST + GraphQL', 'MCP server', 'webhooks'].map((t) => (
              <span
                key={t}
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-bg-page)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <p
          style={{
            marginTop: '36px',
            textAlign: 'center',
            fontFamily: SANS,
            fontSize: '15px',
            lineHeight: '24px',
            color: 'var(--color-text-secondary)',
            maxWidth: '620px',
          }}
        >
          <b style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
            Turn a module off and it stops billing
          </b>{' '}
          — no migration, no exports, no goodbyes. The data stays where it was; it just goes quiet.
        </p>
      </div>
    </Section>
  );
}

function DarkTag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: '11px',
        padding: '4px 10px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.78)',
      }}
    >
      {children}
    </span>
  );
}

// ── ONE RECORD · proof of the data layer ───────────────────────────────────
function OneRecord() {
  const facets = [
    {
      module: 'commerce' as const,
      label: 'Commerce',
      val: (
        <>
          <b>14 orders</b> · $48,200 lifetime
        </>
      ),
      sub: 'Last order 6 days ago',
    },
    {
      module: 'crm' as const,
      label: 'CRM',
      val: (
        <>
          Segment <b>Fleet</b> · owner Dana K.
        </>
      ),
      sub: 'Activity logged across every module',
    },
    {
      module: 'email' as const,
      label: 'Email',
      val: (
        <>
          Subscribed · <b>41% open rate</b>
        </>
      ),
      sub: 'Order + marketing flows',
    },
    {
      module: 'b2b' as const,
      label: 'B2B',
      val: (
        <>
          Account <b>#4471</b> · Net 30
        </>
      ),
      sub: 'Contract pricing, PO checkout',
    },
  ];

  return (
    <Section padding="lg">
      <SectionHeader
        accent="var(--sparx-primary)"
        headline={<>A customer is one customer</>}
        lede={
          <>
            Because every module writes to the same tables, there are no duplicate records and
            nothing to keep in sync. The buyer who placed an order, opened your email, and called
            your sales line is a single profile — with each module&apos;s view of them attached.
          </>
        }
      />

      <div
        style={{
          marginTop: '56px',
          maxWidth: '760px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.06)',
        }}
      >
        {/* head */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '22px 26px',
            borderBottom: '1px solid #F1F1F3',
          }}
        >
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 9999,
              backgroundColor: 'var(--sparx-primary)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: '16px',
              flexShrink: 0,
            }}
          >
            RT
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '17px',
                letterSpacing: '-0.01em',
                color: 'var(--color-text-primary)',
              }}
            >
              Ranchero Trucking Co.
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: '12.5px',
                color: 'var(--color-text-tertiary)',
                marginTop: '2px',
              }}
            >
              orders@rancherotrucking.com
            </div>
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-default)',
              padding: '5px 11px',
              borderRadius: '9999px',
              whiteSpace: 'nowrap',
            }}
          >
            customer · one record
          </span>
        </div>

        {/* facets — 2 columns, collapses to 1 on mobile */}
        <div className="mkt-grid-2-1" style={{ gap: 0 }}>
          {facets.map((f, i) => (
            <div
              key={f.label}
              style={{
                padding: '18px 26px',
                borderBottom: '1px solid #F1F1F3',
                borderRight: i % 2 === 0 ? '1px solid #F1F1F3' : undefined,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}
              >
                <Dot color={MODS[f.module].color} size={8} />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: '11px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {f.label}
                </span>
              </div>
              <div
                style={{ fontFamily: SANS, fontSize: '15px', color: 'var(--color-text-primary)' }}
              >
                {f.val}
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: '13px',
                  color: 'var(--color-text-tertiary)',
                  marginTop: '3px',
                }}
              >
                {f.sub}
              </div>
            </div>
          ))}
        </div>

        {/* foot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 26px' }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 9999,
              backgroundColor: 'var(--color-success)',
              flexShrink: 0,
            }}
          />
          <span
            style={{ fontFamily: SANS, fontSize: '13.5px', color: 'var(--color-text-secondary)' }}
          >
            One profile, written by four modules — no integration, no copy, no drift.
          </span>
        </div>
      </div>
    </Section>
  );
}

// ── FOUR COMMITMENTS ───────────────────────────────────────────────────────
function FourCommitments() {
  const items = [
    {
      n: '01',
      accent: MODS.builder.color,
      title: 'Modular',
      body: 'Activate only what you need. A disabled module runs no workers, stores no rows, and costs nothing. Add the next one when you’re ready — no replatform.',
    },
    {
      n: '02',
      accent: MODS.crm.color,
      title: 'One data layer',
      body: 'Modules share records, not syncs. A customer is one customer across Commerce, CRM, and Email. Reporting is unified because the data was never split.',
    },
    {
      n: '03',
      accent: MODS.ai.color,
      title: 'API-first & MCP-native',
      body: 'Every feature ships as an API endpoint before it gets a screen. A first-class MCP server lets your AI read and write live business data — natively, not via export.',
    },
    {
      n: '04',
      accent: 'var(--color-success)',
      title: 'Permanent',
      body: 'You own the data and the site. Export anytime, edit anything no-code, drop to full code when you want. AI can build it — Sparx is what keeps it.',
    },
  ];

  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent="var(--sparx-primary)"
        headline={<>Four commitments that hold across every module</>}
      />
      <div className="mkt-grid-4-2-1" style={{ marginTop: '56px' }}>
        {items.map((it) => (
          <div
            key={it.n}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '30px 26px 34px',
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
              minHeight: '240px',
            }}
          >
            <span
              style={{ width: 28, height: 3, borderRadius: 9999, backgroundColor: it.accent }}
            />
            <span
              style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-tertiary)' }}
            >
              {it.n}
            </span>
            <h3
              style={{
                margin: '6px 0 0',
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '20px',
                letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)',
              }}
            >
              {it.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '14px',
                lineHeight: '22px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── GROWS WITH YOU · lifecycle ─────────────────────────────────────────────
function GrowsWithYou() {
  const stages = [
    {
      n: '1',
      accent: MODS.builder.color,
      when: 'Day one',
      title: 'A live site',
      body: 'Pick a theme, edit blocks, point your domain. Published in minutes.',
      tags: [{ label: 'Builder', module: 'builder' as const }],
    },
    {
      n: '2',
      accent: MODS.commerce.color,
      when: 'When you sell',
      title: 'The same site sells',
      body: 'Turn on Commerce. Your existing pages gain cart and checkout — no rebuild.',
      tags: [{ label: '+ Commerce', module: 'commerce' as const }],
    },
    {
      n: '3',
      accent: MODS.crm.color,
      when: 'As you grow',
      title: 'Customers, nurtured',
      body: 'Add CRM and Email. They already know every buyer from day one — no import.',
      tags: [
        { label: '+ CRM', module: 'crm' as const },
        { label: '+ Email', module: 'email' as const },
      ],
    },
    {
      n: '4',
      accent: MODS.b2b.color,
      when: 'For wholesale',
      title: 'Net terms & accounts',
      body: 'Switch on B2B. The same accounts gain pricing tiers, POs, and net terms.',
      tags: [{ label: '+ B2B', module: 'b2b' as const }],
    },
  ];

  return (
    <Section padding="lg">
      <SectionHeader
        accent="var(--sparx-primary)"
        headline={<>Start with one. Add the rest, no replatform</>}
        lede={
          <>
            Most platforms make you migrate to grow. Sparx doesn&apos;t. Switch on a module and it
            reads the catalog, customers, and content already there. Switch it off and it goes quiet
            — the data stays exactly where it was.
          </>
        }
      />
      <div className="mkt-grid-4-2-1" style={{ marginTop: '56px' }}>
        {stages.map((s) => (
          <div key={s.n} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 9999,
                  backgroundColor: s.accent,
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: MONO,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                {s.n}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {s.when}
              </span>
            </div>
            <h3
              style={{
                margin: '18px 0 0',
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '16px',
                letterSpacing: '-0.01em',
                color: 'var(--color-text-primary)',
              }}
            >
              {s.title}
            </h3>
            <p
              style={{
                margin: '7px 0 0',
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {s.body}
            </p>
            <div style={{ marginTop: '14px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {s.tags.map((t) => (
                <span
                  key={t.label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: SANS,
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <Dot color={MODS[t.module].color} size={6} />
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── MODULES STRIP ──────────────────────────────────────────────────────────
function ModulesStrip() {
  const mods: {
    module: MarketingModule;
    label: string;
    price: string;
    title: string;
    body: string;
  }[] = [
    {
      module: 'builder',
      label: 'Builder',
      price: '$49/mo',
      title: 'Site builder',
      body: 'Themes, pages, and live URLs — no code.',
    },
    {
      module: 'commerce',
      label: 'Commerce',
      price: '+$49/mo',
      title: 'Sell anything',
      body: 'Cart, checkout, orders, inventory, payments.',
    },
    {
      module: 'cms',
      label: 'CMS',
      price: '$49/mo',
      title: 'Publish content',
      body: 'Editor, blog, media, structured content, SEO.',
    },
    {
      module: 'crm',
      label: 'CRM',
      price: '+$49/mo',
      title: 'Know your customers',
      body: 'Contacts, pipeline, segments, automations.',
    },
    {
      module: 'email',
      label: 'Email',
      price: '+$29/mo',
      title: 'Reach inboxes',
      body: 'Transactional + marketing, self-hosted on your domain.',
    },
    {
      module: 'b2b',
      label: 'B2B',
      price: '+$99/mo',
      title: 'Wholesale & fleet',
      body: 'Accounts, net terms, RFQ, purchase orders.',
    },
    {
      module: 'ai',
      label: 'AI / MCP',
      price: '+$49/mo',
      title: 'AI that knows your data',
      body: 'A first-class MCP server for every record.',
    },
    {
      module: 'dropship',
      label: 'Dropship',
      price: '+$29/mo',
      title: 'Sell without stock',
      body: 'Supplier sync, margin math, order routing.',
    },
  ];

  return (
    <Section id="modules" surface="surface" padding="lg">
      <SectionHeader
        accent="var(--sparx-primary)"
        headline={
          <>
            Eight modules.{' '}
            <span style={{ color: 'var(--color-text-tertiary)' }}>Mix any combination</span>
          </>
        }
      />
      <div className="mkt-grid-4-2-1" style={{ marginTop: '52px' }}>
        {mods.map((m) => {
          const c = MODS[m.module];
          return (
            <a
              key={m.module}
              href={`/${m.module}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '22px',
                backgroundColor: 'var(--color-bg-page)',
                border: '1px solid var(--color-border-default)',
                borderTop: `3px solid ${c.color}`,
                borderRadius: '10px',
                minHeight: '142px',
                textDecoration: 'none',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    backgroundColor: c.tint,
                    fontFamily: SANS,
                    fontSize: '11px',
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: c.text,
                  }}
                >
                  <Dot color={c.color} size={7} />
                  {m.label}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {m.price}
                </span>
              </div>
              <h3
                style={{
                  margin: '14px 0 0',
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {m.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '13.5px',
                  lineHeight: '20px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {m.body}
              </p>
            </a>
          );
        })}
      </div>

      <div
        className="mkt-cluster"
        style={{ marginTop: '32px', justifyContent: 'space-between', gap: '16px' }}
      >
        <p
          style={{
            fontFamily: SANS,
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            maxWidth: '520px',
            margin: 0,
          }}
        >
          Content-only, commerce-only, or the whole platform — every combination shares the same
          dashboard, the same data, and the same bill.
        </p>
        <a href="/modules">
          <Button variant="outline">Explore all modules →</Button>
        </a>
      </div>
    </Section>
  );
}

// ── API SURFACE (dark) ─────────────────────────────────────────────────────
function ApiSurface() {
  const clients = [
    {
      ci: 'D',
      color: MODS.builder.color,
      name: 'Dashboard',
      desc: 'The admin UI is just a client',
    },
    {
      ci: 'S',
      color: MODS.commerce.color,
      name: 'Your site',
      desc: 'Storefront and pages read the same API',
    },
    {
      ci: 'AI',
      color: MODS.ai.color,
      name: 'MCP / AI',
      desc: 'Claude, ChatGPT, Copilot — natively',
    },
    { ci: '↯', color: MODS.cms.color, name: 'Webhooks', desc: 'Events push to your own systems' },
    {
      ci: '</>',
      color: MODS.b2b.color,
      name: 'Your code',
      desc: 'Build anything on the headless API + SDK',
    },
  ];

  return (
    <section
      style={{
        paddingTop: 'var(--section-py-lg)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container>
        <div style={{ maxWidth: '720px' }}>
          <Display size={56} lineHeight={60} color="#FFFFFF">
            Everything is an API. Even the AI
            <Spark color={MODS.ai.color} />
          </Display>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '18px',
              lineHeight: '30px',
              color: '#A1A1AA',
              maxWidth: '640px',
              margin: '24px 0 0',
            }}
          >
            Every feature ships as an endpoint before it ships a screen. The dashboard, your site,
            your integrations, and your AI assistant are all clients of the same API — nothing is
            trapped inside the UI.
          </p>
        </div>

        <div
          className="mkt-stack-on-tablet"
          style={{ alignItems: 'stretch', gap: '32px', marginTop: '56px' }}
        >
          {/* clients */}
          <div
            style={{
              width: '420px',
              maxWidth: '100%',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {clients.map((c) => (
              <div
                key={c.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 18px',
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #2A2A2A',
                  borderRadius: '10px',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '7px',
                    backgroundColor: c.color,
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontFamily: MONO,
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {c.ci}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontWeight: 500,
                      fontSize: '14px',
                      color: '#FFFFFF',
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: '12.5px',
                      color: '#A1A1AA',
                      marginTop: '1px',
                    }}
                  >
                    {c.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* code card */}
          <div
            style={{
              flex: 1,
              minWidth: '320px',
              alignSelf: 'flex-start',
              backgroundColor: '#0F0F0F',
              border: '1px solid #2A2A2A',
              borderTop: '3px solid var(--sparx-primary)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '14px 18px',
                borderBottom: '1px solid #2A2A2A',
                fontFamily: MONO,
                fontSize: '12.5px',
                color: '#A1A1AA',
              }}
            >
              <span style={{ fontWeight: 500, color: 'var(--color-success)' }}>GET</span>
              /v1/customers/cus_4471
            </div>
            <div
              style={{
                padding: '18px 20px',
                fontFamily: MONO,
                fontSize: '12.5px',
                lineHeight: '22px',
                color: '#D4D4D8',
                whiteSpace: 'pre',
                overflowX: 'auto',
              }}
            >
              <div style={{ color: '#52525B' }}>{'// the same record the four modules wrote'}</div>
              <div>{'{'}</div>
              <div>
                {'  '}
                <K>&quot;id&quot;</K>: <S>&quot;cus_4471&quot;</S>,
              </div>
              <div>
                {'  '}
                <K>&quot;name&quot;</K>: <S>&quot;Ranchero Trucking Co.&quot;</S>,
              </div>
              <div>
                {'  '}
                <K>&quot;commerce&quot;</K>: {'{ '}
                <K>&quot;orders&quot;</K>: <N>14</N>, <K>&quot;ltv&quot;</K>: <N>48200</N> {'}'},
              </div>
              <div>
                {'  '}
                <K>&quot;crm&quot;</K>: {'{ '}
                <K>&quot;segment&quot;</K>: <S>&quot;fleet&quot;</S>, <K>&quot;owner&quot;</K>:{' '}
                <S>&quot;dana&quot;</S> {'}'},
              </div>
              <div>
                {'  '}
                <K>&quot;email&quot;</K>: {'{ '}
                <K>&quot;subscribed&quot;</K>: <N>true</N>, <K>&quot;open_rate&quot;</K>:{' '}
                <N>0.41</N> {'}'},
              </div>
              <div>
                {'  '}
                <K>&quot;b2b&quot;</K>: {'{ '}
                <K>&quot;account&quot;</K>: <S>&quot;#4471&quot;</S>, <K>&quot;terms&quot;</K>:{' '}
                <S>&quot;net_30&quot;</S> {'}'}
              </div>
              <div>{'}'}</div>
            </div>
          </div>
        </div>

        <p
          style={{
            marginTop: '34px',
            fontFamily: SANS,
            fontSize: '16px',
            lineHeight: '26px',
            color: '#A1A1AA',
            maxWidth: '640px',
          }}
        >
          Connect Claude, ChatGPT, or Copilot through the first-class MCP server.{' '}
          <a href="/ai" style={{ color: '#818CF8', fontWeight: 500 }}>
            See it answer questions about your business →
          </a>
        </p>
      </Container>
    </section>
  );
}

// JSON token helpers for the API code card.
function K({ children }: { children: ReactNode }) {
  return <span style={{ color: '#818CF8' }}>{children}</span>;
}
function S({ children }: { children: ReactNode }) {
  return <span style={{ color: 'var(--color-success)' }}>{children}</span>;
}
function N({ children }: { children: ReactNode }) {
  return <span style={{ color: MODS.commerce.color }}>{children}</span>;
}

// ── FOUNDATIONS ────────────────────────────────────────────────────────────
function Foundations() {
  const items = [
    {
      title: 'Tenant isolation at the database',
      body: 'Every tenant-scoped table carries a tenant ID, with PostgreSQL row-level security as the backstop against application bugs — not application-tier filtering alone.',
    },
    {
      title: 'Self-hosted email',
      body: 'Transactional and marketing email send from your own domain and reputation on sparx.email — no third-party markup, no shared-IP deliverability roulette.',
    },
    {
      title: 'Event-driven by design',
      body: 'Business events publish to a queue and are consumed by workers. Side effects never block a request — and new automations subscribe without touching the core.',
    },
    {
      title: 'One dashboard, module-aware',
      body: 'Each module shifts the dashboard to its own color and surfaces only its tools. Disabled modules return a clear upgrade path, not a dead end.',
    },
    {
      title: 'Multi-property, multi-brand',
      body: 'Run many sites under one tenant — separate domains, themes, and catalogs — sharing the same customers, content, and bill where you want them to.',
    },
    {
      title: 'Own it, export it, leave anytime',
      body: 'Your data is yours. Full export, headless API access, and no lock-in. Turn a module off and it simply stops — your records stay intact.',
    },
  ];

  return (
    <Section padding="lg">
      <SectionHeader
        accent="var(--sparx-primary)"
        headline={<>Enterprise foundations, on by default</>}
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '32px 56px' }}>
        {items.map((it) => (
          <div key={it.title}>
            <h3
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '11px',
                margin: 0,
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '18px',
                letterSpacing: '-0.01em',
                color: 'var(--color-text-primary)',
              }}
            >
              <Dot color="var(--sparx-primary)" size={9} />
              {it.title}
            </h3>
            <p
              style={{
                margin: '9px 0 0 20px',
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: '24px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING TEASER ─────────────────────────────────────────────────────────
function PricingTeaser() {
  const tiers = [
    { name: 'Start', price: '$10', note: 'one module', highlight: false },
    { name: 'Grow', price: '$108', note: 'Builder + Commerce + CMS', highlight: true },
    { name: 'Everything', price: '$363', note: 'all eight modules', highlight: false },
  ];

  return (
    <Section id="pricing" surface="surface" padding="lg">
      <div
        className="mkt-stack-on-tablet"
        style={{ justifyContent: 'space-between', alignItems: 'center', gap: '40px' }}
      >
        <div style={{ flex: 1 }}>
          <Display size={44} lineHeight={46}>
            Pay only for what you use
            <Spark />
          </Display>
          <p
            style={{
              margin: '16px 0 0',
              maxWidth: '460px',
              fontFamily: SANS,
              fontSize: '16px',
              lineHeight: '25px',
              color: 'var(--color-text-secondary)',
            }}
          >
            Start with one module from $10/mo. Add the next when you need it. No bundles, no seat
            tax, no &ldquo;contact us for content.&rdquo; Turn anything off and it stops billing the
            same day.
          </p>
          <div style={{ marginTop: '28px' }}>
            <a href="/pricing">
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                See full pricing →
              </Button>
            </a>
          </div>
        </div>

        <div className="mkt-cluster" style={{ gap: '14px', flexShrink: 0 }}>
          {tiers.map((t) => (
            <div
              key={t.name}
              style={{
                backgroundColor: 'var(--color-bg-page)',
                border: `1px solid ${t.highlight ? 'var(--sparx-primary)' : 'var(--color-border-default)'}`,
                borderRadius: '12px',
                padding: '22px 26px',
                minWidth: '150px',
              }}
            >
              <div
                style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}
              >
                {t.name}
              </div>
              <div
                style={{
                  marginTop: '8px',
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '34px',
                  letterSpacing: '-0.03em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {t.price}
                <span
                  style={{ fontSize: '15px', color: 'var(--color-text-tertiary)', fontWeight: 400 }}
                >
                  /mo
                </span>
              </div>
              <div
                style={{
                  marginTop: '6px',
                  fontFamily: SANS,
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {t.note}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA ──────────────────────────────────────────────────────────────
function PlatformCta() {
  return (
    <section
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-bg-page)',
        borderTop: '1px solid var(--color-border-default)',
        textAlign: 'center',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}
      >
        <Display size={64} lineHeight={64}>
          Put your whole business on one platform
          <Spark />
        </Display>
        <p
          style={{
            margin: '22px 0 34px',
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: 'var(--color-text-secondary)',
            maxWidth: '560px',
          }}
        >
          Content, commerce, or both. Start with one module and a live site in five minutes — add
          the rest whenever you&apos;re ready.
        </p>
        <div className="mkt-cluster" style={{ gap: '14px', justifyContent: 'center' }}>
          <Button size="xl" style={{ backgroundColor: '#0A0A0A' }}>
            Start free
          </Button>
          <Button size="xl" variant="outline">
            Talk to sales
          </Button>
        </div>
        <span
          style={{
            marginTop: '22px',
            fontFamily: MONO,
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
          }}
        >
          No credit card · Cancel anytime · Your data, always exportable
        </span>
      </Container>
    </section>
  );
}
