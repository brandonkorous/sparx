import * as React from 'react';
import { Section, SectionHeader, Spark } from './primitives';
import { PricingSwitchboard } from './pricing-switchboard';

/**
 * The /pricing page. Centerpiece is the interactive <PricingSwitchboard>; around
 * it sit the pricing-specific beats — what's always included, a cost-savings
 * ledger (real 2026 competitor prices), every feature by module, how billing
 * works, an enterprise band, a billing FAQ, and a close.
 *
 * Model: per-module flat pricing + a 14-day free trial (docs/17). No bundles,
 * no metering. Builder is a normal $10 module, not a required base.
 */

const MOD: Record<string, string> = {
  builder: 'var(--module-builder)',
  commerce: 'var(--module-commerce)',
  cms: 'var(--module-cms)',
  crm: 'var(--module-crm)',
  email: 'var(--module-email)',
  b2b: 'var(--module-b2b)',
  ai: 'var(--module-ai)',
  dropship: 'var(--module-dropship)',
};

export function PricingPage() {
  return (
    <>
      <Section id="plan" surface="page" padding="lg">
        <PricingSwitchboard />
      </Section>
      <AlwaysIncluded />
      <CostSavings />
      <FeatureTable />
      <BillingPrinciples />
      <Enterprise />
      <Faq />
      <FinalCta />
    </>
  );
}

/* ── Always included ─────────────────────────────────────────── */

const INCLUDED: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Glyph paths={['M3 9h18M3 15h18']} circle />,
    title: 'Hosting + global CDN',
    body: 'Edge-cached pages, fast TTFB worldwide. No separate hosting bill.',
  },
  {
    icon: <Glyph paths={['M8 10V7a4 4 0 0 1 8 0v3']} rect={[4, 10, 16, 11, 2]} />,
    title: 'SSL + custom domains',
    body: 'Bring your domain; certificates issue and renew automatically.',
  },
  {
    icon: (
      <Glyph
        rects={[
          [3, 3, 7, 7],
          [14, 3, 7, 7],
          [3, 14, 7, 7],
          [14, 14, 7, 7],
        ]}
      />
    ),
    title: 'The unified dashboard',
    body: 'One admin for every module you turn on — no extra logins.',
  },
  {
    icon: <Glyph paths={['M16 18 22 12 16 6', 'M8 6 2 12 8 18']} />,
    title: 'REST + GraphQL API',
    body: 'Every feature is an endpoint first. Build anything on the same API.',
  },
  {
    icon: <Glyph paths={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']} />,
    title: 'Multi-tenant security',
    body: 'Row-level isolation in the database — your data is fenced off by default.',
  },
  {
    icon: (
      <Glyph
        paths={[
          'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
          'M23 21v-2a4 4 0 0 0-3-3.87',
          'M16 3.13a4 4 0 0 1 0 7.75',
        ]}
        circles={[[9, 7, 4]]}
      />
    ),
    title: 'Unlimited team members',
    body: 'Invite the whole team. No per-seat pricing, ever.',
  },
  {
    icon: (
      <Glyph
        paths={[
          'M21 2v6h-6',
          'M3 12a9 9 0 0 1 15-6.7L21 8',
          'M3 22v-6h6',
          'M21 12a9 9 0 0 1-15 6.7L3 16',
        ]}
      />
    ),
    title: 'Automatic updates',
    body: 'New features and fixes ship to your tenant — no upgrades to run.',
  },
  {
    icon: (
      <Glyph paths={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3']} />
    ),
    title: 'Export anytime',
    body: 'Your data is yours. Full export, no lock-in, leave whenever you want.',
  },
];

function AlwaysIncluded() {
  return (
    <Section surface="surface" padding="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader
          headline="Every plan ships with the platform"
          accent="var(--sparx-primary)"
          lede="You pay for modules. Everything underneath them — the hosting, the security, the API — is included on every plan, from one module to all eight."
        />
        <div
          className="mkt-grid-4-2-1"
          style={{
            gap: '1px',
            backgroundColor: 'var(--color-border-default)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          {INCLUDED.map((it) => (
            <div
              key={it.title}
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                padding: '26px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: '150px',
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: '#EEF2FF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4,
                }}
              >
                {it.icon}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '15px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {it.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  lineHeight: '19px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── Cost savings ────────────────────────────────────────────── */

const STATS: { value: string; suffix?: string; label: string }[] = [
  {
    value: '$38,000',
    suffix: '+/yr',
    label:
      'Kept by running all eight capabilities as sparx instead of eight separate subscriptions.',
  },
  {
    value: '8 → 1',
    label:
      'Eight logins, renewal dates, and support queues collapse into a single monthly invoice.',
  },
  {
    value: '0%',
    label:
      'Extra on every sale — versus the 0.6–2% surcharge hosted stores add to use your own processor.',
  },
];

const LEDGER: { key: string; name: string; price: string; alt: string; amt: string }[] = [
  { key: 'builder', name: 'Builder', price: '$10', alt: 'Webflow — Premium site plan', amt: '$39' },
  { key: 'commerce', name: 'Commerce', price: '$49', alt: 'Shopify — Advanced', amt: '$399' },
  { key: 'cms', name: 'CMS', price: '$49', alt: 'Storyblok — Growth (headless CMS)', amt: '$99' },
  { key: 'crm', name: 'CRM', price: '$49', alt: 'HubSpot — Sales Pro, 3 seats', amt: '$300' },
  {
    key: 'email',
    name: 'Email',
    price: '$29',
    alt: 'Klaviyo + a transactional email service',
    amt: '$165',
  },
  {
    key: 'b2b',
    name: 'B2B · Fleet',
    price: '$99',
    alt: 'Shopify Plus — native B2B',
    amt: '$2,400',
  },
  {
    key: 'ai',
    name: 'AI · MCP',
    price: '$49',
    alt: 'Zapier Team + custom integration work',
    amt: '$103',
  },
  { key: 'dropship', name: 'Dropship', price: '$29', alt: 'Spocket — Pro', amt: '$60' },
];

const SCENARIOS: {
  title: string;
  sub: string;
  separate: string;
  sparx: string;
  save: string;
  featured?: boolean;
}[] = [
  {
    title: 'A growing site',
    sub: 'Builder · Commerce · CMS · CRM · Email',
    separate: '$1,002/mo',
    sparx: '$186/mo',
    save: 'You keep $816/mo — about $9,800 a year',
  },
  {
    title: 'The full platform',
    sub: 'All eight modules',
    separate: '$3,565/mo',
    sparx: '$363/mo',
    save: 'You keep $3,202/mo — about $38,000 a year',
    featured: true,
  },
];

function CostSavings() {
  return (
    <Section surface="page" padding="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <SectionHeader
          headline="What the same stack costs in pieces"
          accent="var(--sparx-primary)"
          lede="Each module replaces a tool you'd otherwise pay for on its own. Here's the real, published 2026 price of each — and what you keep by running them as one platform on one bill."
        />

        <div
          className="mkt-grid-3-2-1"
          style={{
            gap: '1px',
            backgroundColor: 'var(--color-border-default)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          {STATS.map((s) => (
            <div
              key={s.value}
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                padding: '28px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '42px',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {s.value}
                {s.suffix ? (
                  <span style={{ fontSize: '22px', color: 'var(--color-text-tertiary)' }}>
                    {s.suffix}
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  lineHeight: '21px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Ledger */}
        <div
          style={{
            border: '1px solid var(--color-border-default)',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: 'var(--color-bg-surface)',
          }}
        >
          <div
            className="mkt-ledger-head"
            style={{
              backgroundColor: 'var(--color-bg-page)',
              borderBottom: '1px solid var(--color-border-default)',
            }}
          >
            <LedgerLabel>sparx module</LedgerLabel>
            <span />
            <LedgerLabel>What you&apos;d buy instead</LedgerLabel>
            <LedgerLabel align="right">Their price</LedgerLabel>
          </div>
          {LEDGER.map((row, i) => (
            <div
              key={row.key}
              className="mkt-ledger-row"
              style={{
                borderBottom: i === LEDGER.length - 1 ? undefined : '1px solid #F1F1F3',
              }}
            >
              <span
                className="mkt-ledger-mod"
                style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 9999,
                    backgroundColor: MOD[row.key],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '15px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {row.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: '#4338CA',
                    backgroundColor: '#EEF2FF',
                    padding: '2px 9px',
                    borderRadius: 9999,
                  }}
                >
                  {row.price}
                </span>
              </span>
              <span
                className="mkt-ledger-vs"
                aria-hidden
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                →
              </span>
              <span
                className="mkt-ledger-alt"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  minWidth: 0,
                }}
              >
                {row.alt}
              </span>
              <span
                className="mkt-ledger-amt"
                style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {row.amt}
              </span>
            </div>
          ))}
        </div>

        {/* Scenario cards */}
        <div className="mkt-grid-2-1">
          {SCENARIOS.map((sc) => (
            <div
              key={sc.title}
              style={{
                border: sc.featured
                  ? '1px solid var(--sparx-primary)'
                  : '1px solid var(--color-border-default)',
                borderRadius: '14px',
                padding: '24px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                backgroundColor: 'var(--color-bg-surface)',
                boxShadow: sc.featured ? '0 12px 32px rgba(99, 102, 241, 0.1)' : undefined,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {sc.title}
                <span
                  style={{
                    display: 'block',
                    fontWeight: 400,
                    fontSize: '13px',
                    color: 'var(--color-text-tertiary)',
                    marginTop: '4px',
                  }}
                >
                  {sc.sub}
                </span>
              </span>
              <ScenarioLine k="Bought separately" v={sc.separate} strike />
              <ScenarioLine k="On sparx" v={sc.sparx} sparx />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  marginTop: '2px',
                  padding: '11px 13px',
                  backgroundColor: 'var(--color-success-tint)',
                  borderRadius: '9px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '13.5px',
                  color: '#065F46',
                }}
              >
                <CheckMark />
                {sc.save}
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            margin: 0,
            maxWidth: '880px',
            fontFamily: 'var(--font-sans)',
            fontSize: '12.5px',
            lineHeight: '20px',
            color: 'var(--color-text-tertiary)',
          }}
        >
          Comparison uses publicly listed 2026 monthly prices for representative growth-tier plans
          of the tools each module replaces — Webflow Premium, Shopify Advanced and Plus, a headless
          CMS, HubSpot Sales Professional, Klaviyo, a dropshipping app, and Zapier for the glue
          between them. Those prices scale up with seats, contacts, and usage, so a real-world stack
          usually costs more. sparx is flat — the module price is the price.
        </p>
      </div>
    </Section>
  );
}

function LedgerLabel({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
        textAlign: align,
      }}
    >
      {children}
    </span>
  );
}

function ScenarioLine({
  k,
  v,
  strike,
  sparx,
}: {
  k: string;
  v: string;
  strike?: boolean;
  sparx?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          color: 'var(--color-text-secondary)',
        }}
      >
        {k}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '15px',
          fontWeight: sparx ? 500 : 400,
          color: strike
            ? 'var(--color-text-tertiary)'
            : sparx
              ? '#4338CA'
              : 'var(--color-text-primary)',
          textDecoration: strike ? 'line-through' : undefined,
        }}
      >
        {v}
      </span>
    </div>
  );
}

/* ── Feature table (accordion) ───────────────────────────────── */

const FEATURES: { key: string; name: string; price: string; repl: string; feats: string[] }[] = [
  {
    key: 'builder',
    name: 'Builder',
    price: '$10/mo',
    repl: 'Replaces a website builder like Webflow',
    feats: [
      'Theme-first editor, block editing',
      'Custom domain + automatic SSL',
      'Global edge CDN, stale-while-revalidate',
      'Draft → preview → publish',
      'Reusable components & sections',
      'Headless SDK — Next, Remix, Astro',
    ],
  },
  {
    key: 'commerce',
    name: 'Commerce',
    price: '+ $49/mo',
    repl: 'Replaces Shopify + checkout, tax & shipping apps',
    feats: [
      'Products, variants & bundles',
      'Real-time inventory',
      'One-tap checkout (Apple Pay)',
      'Stripe, PayPal, Klarna, Affirm',
      'Tax — Avalara / TaxJar',
      'Shipping — Shippo / EasyPost',
      'Discounts & gift cards',
      'Orders, refunds, fulfillment',
    ],
  },
  {
    key: 'cms',
    name: 'CMS',
    price: '+ $49/mo',
    repl: 'Replaces a headless CMS like Storyblok',
    feats: [
      'Block editor, autosave + revisions',
      'Structured content types + typed API',
      'Media library (auto WebP/AVIF)',
      'Per-page SEO + JSON-LD',
      'Scheduling & drafts',
      'Roles & publishing workflow',
    ],
  },
  {
    key: 'crm',
    name: 'CRM',
    price: '+ $49/mo',
    repl: 'Replaces HubSpot + an automation seat',
    feats: [
      'One customer record, no deduping',
      'Dynamic segments from any signal',
      'Pipeline tied to order status',
      'Activity timeline across modules',
      'Automations, notes & tasks',
      'Tags & lists',
    ],
  },
  {
    key: 'email',
    name: 'Email',
    price: '+ $29/mo',
    repl: 'Replaces Klaviyo + a transactional service',
    feats: [
      'Transactional wired into every module',
      'Campaigns + A/B testing',
      'Your domain — SPF/DKIM/DMARC',
      'React Email templates',
      'Audiences synced from CRM',
      'Flat price, no per-email fees',
    ],
  },
  {
    key: 'b2b',
    name: 'B2B · Fleet',
    price: '+ $99/mo',
    repl: 'Replaces Shopify Plus for native B2B',
    feats: [
      'Account-tier + contract pricing',
      'Net 15 / 30 / 60 / 90 + PO checkout',
      'Quotes & RFQ',
      'Fleet — vehicles, VIN, cost centers',
      'Bookable service bays',
      'Approval workflows & buyer roles',
    ],
  },
  {
    key: 'ai',
    name: 'AI · MCP',
    price: '+ $49/mo',
    repl: 'Replaces Zapier + custom glue code',
    feats: [
      'First-class MCP server, per-tenant',
      'Read & write everything the API can',
      'Per-agent keys, per-tool scopes',
      'Full audit log, revoke in a click',
      'Claude, ChatGPT, Copilot, Cursor',
    ],
  },
  {
    key: 'dropship',
    name: 'Dropship',
    price: '+ $29/mo',
    repl: 'Replaces a standalone dropshipping app',
    feats: [
      'Supplier connectors — CSV/FTP/API',
      'Per-supplier margin rules',
      'Automated multi-supplier routing',
      'Real-time stock sync',
    ],
  },
];

function FeatureTable() {
  return (
    <Section surface="surface" padding="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <SectionHeader
          headline="Every feature, by module"
          accent="var(--sparx-primary)"
          lede="The complete list — what each module includes and what it replaces. Open any module below; the platform underneath comes with every plan."
        />
        <div
          style={{
            border: '1px solid var(--color-border-default)',
            borderRadius: '14px',
            overflow: 'hidden',
            backgroundColor: 'var(--color-bg-surface)',
          }}
        >
          {FEATURES.map((m, i) => (
            <details
              key={m.key}
              className="mkt-ft-module"
              open={i === 0}
              style={{
                borderBottom: i === FEATURES.length - 1 ? undefined : '1px solid #F1F1F3',
              }}
            >
              <summary className="mkt-summary mkt-ft-summary">
                <span
                  className="mkt-ft-name"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    flexShrink: 0,
                    width: '188px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '16px',
                    letterSpacing: '-0.01em',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 9999,
                      backgroundColor: MOD[m.key],
                      flexShrink: 0,
                    }}
                  />
                  {m.name}
                </span>
                <span
                  className="mkt-ft-price"
                  style={{
                    flexShrink: 0,
                    width: '76px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {m.price}
                </span>
                <span
                  className="mkt-ft-repl"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    lineHeight: '18px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {m.repl}
                </span>
                <span
                  className="mkt-ft-count"
                  style={{
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.02em',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {m.feats.length} features
                </span>
                <span className="mkt-ft-chev">
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="mkt-ft-body" style={{ padding: '2px 26px 24px 47px' }}>
                <div className="mkt-ft-feats">
                  {m.feats.map((f) => (
                    <span key={f}>
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 9999,
                          backgroundColor: MOD[m.key],
                          flexShrink: 0,
                        }}
                      />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── Billing principles ──────────────────────────────────────── */

const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: 'Flat per module',
    body: 'A fixed monthly price for each module you switch on. No per-seat tax, no per-record metering, no usage cliffs.',
  },
  {
    title: 'Off means off',
    body: 'Turn a module off and it stops billing the same day. It goes quiet, your data stays, and it picks back up if you return.',
  },
  {
    title: 'One invoice',
    body: 'Every active module on a single monthly bill — not five subscriptions, five renewal dates, and five support queues.',
  },
];

function BillingPrinciples() {
  return (
    <Section surface="page" padding="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader headline="Pricing without the asterisks" accent="var(--sparx-primary)" />
        <div className="mkt-grid-3-2-1" style={{ gap: '40px 48px' }}>
          {PRINCIPLES.map((p) => (
            <div key={p.title}>
              <h3
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '17px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    backgroundColor: 'var(--sparx-primary)',
                    flexShrink: 0,
                  }}
                />
                {p.title}
              </h3>
              <p
                style={{
                  margin: '9px 0 0 18px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  lineHeight: '22px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── Enterprise ──────────────────────────────────────────────── */

const ENTERPRISE_FEATS = [
  'SSO / SAML + SCIM',
  'Custom SLA with credits',
  'Dedicated support + onboarding',
  'SOC 2 review + custom MSA',
  'Volume pricing',
  'Migration assistance',
];

function Enterprise() {
  return (
    <Section surface="dark" padding="xl">
      <div
        style={{
          display: 'flex',
          gap: '48px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '300px' }}>
          <SectionHeader
            invert
            headlineSize={44}
            headline="Bigger needs? Let&rsquo;s talk"
            accent="#818CF8"
            lede="For teams with security reviews, procurement, and uptime commitments. Custom pricing that still bills the way the switchboard does — pay for the modules you run."
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px 28px',
              marginTop: '26px',
              maxWidth: '560px',
            }}
          >
            {ENTERPRISE_FEATS.map((f) => (
              <span
                key={f}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.82)',
                }}
              >
                <CheckMark color="#818CF8" />
                {f}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flexShrink: 0,
            alignItems: 'flex-start',
          }}
        >
          <CtaLink href="/enterprise" tone="onDark">
            Talk to sales
          </CtaLink>
          <CtaLink href="/platform" tone="outlineDark">
            See the platform →
          </CtaLink>
        </div>
      </div>
    </Section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────── */

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What counts as a module?',
    a: 'The eight capabilities in the switchboard — Builder, Commerce, CMS, CRM, Email, B2B, AI, and Dropship. Each is a flat monthly price you switch on or off independently. The platform underneath (hosting, security, API) is included on every plan.',
  },
  {
    q: 'Do I have to start with Builder?',
    a: 'No. Builder hosts and serves a website, so any hosted sparx site turns it on — but it is optional, not a base. A content-only publisher, a CRM-only team, or anyone driving their own frontend off the API can start from the module they actually use.',
  },
  {
    q: 'Can I switch a module off later?',
    a: 'Anytime, from the dashboard. Billing stops the same day and the module goes quiet — no workers, no charges. Your data stays exactly where it was and comes right back if you turn it on again.',
  },
  {
    q: 'Are there per-seat or usage fees?',
    a: 'No. Team members are unlimited, and the module price is the price — no per-record or per-contact metering. Email is flat too: send ten thousand or a million a month, same bill.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — 14 days free, with full access to every module and no credit card to start. Build your whole site during the trial and pick the modules you want to keep before it ends. Need more time? Your data is preserved for 30 days after the trial.',
  },
  {
    q: 'Can I migrate from my current tools?',
    a: 'Yes. Import products, content, and customers with our migration tooling, and Enterprise plans include hands-on migration help.',
  },
];

function Faq() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return (
    <Section surface="surface" padding="xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <SectionHeader headline="Questions about the bill" accent="var(--sparx-primary)" />
        <div style={{ maxWidth: '820px', borderTop: '1px solid var(--color-border-default)' }}>
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="mkt-faq-item"
              style={{ borderBottom: '1px solid var(--color-border-default)' }}
            >
              <summary
                className="mkt-summary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '20px 4px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '17px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {f.q}
                <span className="mkt-faq-icon" style={{ color: 'var(--color-text-tertiary)' }}>
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </summary>
              <p
                style={{
                  margin: 0,
                  padding: '0 4px 22px',
                  maxWidth: '680px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '15px',
                  lineHeight: '24px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── Final CTA ───────────────────────────────────────────────── */

function FinalCta() {
  return (
    <Section
      surface="page"
      padding="xl"
      style={{
        borderTop: '1px solid var(--color-border-default)',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
        <SectionHeaderCentered />
        <p
          style={{
            margin: '20px auto 32px',
            maxWidth: '540px',
            fontFamily: 'var(--font-sans)',
            fontSize: '18px',
            lineHeight: '28px',
            color: 'var(--color-text-secondary)',
          }}
        >
          Flip on the modules you need to see your exact price, then start a 14-day free trial of
          the whole platform — no credit card required.
        </p>
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <CtaLink href="#plan" tone="primary">
            Build your plan ↑
          </CtaLink>
          <CtaLink href="/enterprise" tone="ghost">
            Talk to sales
          </CtaLink>
        </div>
        <div
          style={{
            marginTop: '22px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
          }}
        >
          14-day free trial · No card to start · Cancel anytime
        </div>
      </div>
    </Section>
  );
}

function SectionHeaderCentered() {
  return (
    <h2
      style={{
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: 'clamp(34px, 5vw, 56px)',
        lineHeight: 1.02,
        letterSpacing: '-0.03em',
        maxWidth: '15ch',
        color: 'var(--color-text-primary)',
      }}
    >
      Your plan&apos;s already built
      <Spark />
    </h2>
  );
}

/* ── Shared helpers ──────────────────────────────────────────── */

function CtaLink({
  href,
  tone,
  children,
}: {
  href: string;
  tone: 'primary' | 'ghost' | 'onDark' | 'outlineDark';
  children: React.ReactNode;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: '16px',
    padding: '14px 24px',
    borderRadius: '10px',
    textDecoration: 'none',
    border: '1px solid transparent',
    cursor: 'pointer',
  };
  const tones: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: 'var(--sparx-primary)', color: '#fff' },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text-primary)',
      borderColor: 'var(--color-border-default)',
    },
    onDark: { backgroundColor: '#fff', color: '#0A0A0A' },
    outlineDark: { backgroundColor: 'transparent', color: '#fff', borderColor: '#2F2F2F' },
  };
  return (
    <a href={href} style={{ ...base, ...tones[tone] }}>
      {children}
    </a>
  );
}

function CheckMark({ color = '#059669' }: { color?: string }) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Glyph({
  paths = [],
  rect,
  rects = [],
  circle,
  circles = [],
}: {
  paths?: string[];
  rect?: [number, number, number, number, number];
  rects?: [number, number, number, number][];
  circle?: boolean;
  circles?: [number, number, number][];
}) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4338CA"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {rect ? <rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} rx={rect[4]} /> : null}
      {rects.map((r) => (
        <rect key={r.join(',')} x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={1} />
      ))}
      {circle ? <circle cx={12} cy={12} r={9} /> : null}
      {circles.map((c) => (
        <circle key={c.join(',')} cx={c[0]} cy={c[1]} r={c[2]} />
      ))}
    </svg>
  );
}
