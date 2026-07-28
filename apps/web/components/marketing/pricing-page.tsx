import * as React from 'react';
import { Badge } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Display, Section, SectionHeader, Spark, Text } from './primitives';
import { PricingSwitchboard } from './pricing-switchboard';

/**
 * The /pricing page. Centerpiece is the interactive <PricingSwitchboard>; around
 * it sit the pricing-specific beats — what's always included, a cost-savings
 * ledger (real 2026 competitor prices), every feature by module, how billing
 * works, an enterprise band, a billing FAQ, and a close.
 *
 * Model: per-module flat pricing + a 14-day free trial (docs/17). No bundles,
 * no metering. Builder is a normal $10 module, not a required base.
 *
 * Authoring: silica components + Tailwind utilities only (SILICA-VOCABULARY.md).
 * The only inline `style` left is a per-row module hue read out of MOD — a
 * genuinely dynamic value, not a static appearance.
 */

/** Join class fragments, dropping falsy ones. */
function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const MOD: Record<string, string> = {
  builder: 'var(--color-module-builder)',
  commerce: 'var(--color-module-commerce)',
  cms: 'var(--color-module-cms)',
  crm: 'var(--color-module-crm)',
  invoicing: 'var(--color-module-invoicing)',
  email: 'var(--color-module-email)',
  b2b: 'var(--color-module-b2b)',
  ai: 'var(--color-module-ai)',
  dropship: 'var(--color-module-dropship)',
  inventory: 'var(--color-module-inventory)',
  chat: 'var(--color-module-chat)',
  scheduling: 'var(--color-module-scheduling)',
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
      <div className="flex flex-col gap-12">
        <SectionHeader
          headline="Every plan ships with the platform"
          accent="var(--color-primary)"
          lede="You pay for modules. Everything underneath them — the hosting, the security, the API — is included on every plan, from one module to all twelve."
        />
        <div className="border-base-300 bg-base-300 grid grid-cols-1 gap-px overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4">
          {INCLUDED.map((it) => (
            <div key={it.title} className="bg-base-100 flex min-h-[150px] flex-col gap-2 p-6">
              {/* The icon chip carries the platform hue; the glyph inside strokes
                  with `currentColor`, so one class sets both. */}
              <span className="bg-primary bg-soft text-primary mb-1 inline-flex size-[30px] items-center justify-center rounded-lg">
                {it.icon}
              </span>
              <Text as="h3" size={15} tone="default" weight={500} className="tracking-[-0.01em]">
                {it.title}
              </Text>
              <Text size={13}>{it.body}</Text>
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
    value: '$41,000',
    suffix: '+/yr',
    label:
      'Kept by running all twelve capabilities as sparx instead of twelve separate subscriptions.',
  },
  {
    value: '12 → 1',
    label:
      'Twelve logins, renewal dates, and support queues collapse into a single monthly invoice.',
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
    name: 'AI',
    price: '$49',
    alt: 'Zapier Team + custom integration work',
    amt: '$103',
  },
  { key: 'dropship', name: 'Dropship', price: '$29', alt: 'Spocket — Pro', amt: '$60' },
  {
    key: 'scheduling',
    name: 'Scheduling',
    price: '$29',
    alt: 'Acuity — Powerhouse',
    amt: '$61',
  },
  { key: 'invoicing', name: 'Invoicing', price: '$19', alt: 'FreshBooks — Plus', amt: '$33' },
  {
    key: 'inventory',
    name: 'Inventory',
    price: '$29',
    alt: 'Zoho Inventory — Professional',
    amt: '$99',
  },
  { key: 'chat', name: 'Live Chat', price: '$19', alt: 'Intercom — live chat', amt: '$74' },
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
    sub: 'All twelve modules — Invoicing & Inventory included free',
    separate: '$3,832/mo',
    sparx: '$411/mo',
    save: 'You keep $3,421/mo — about $41,000 a year',
    featured: true,
  },
];

function CostSavings() {
  return (
    <Section surface="page" padding="xl">
      <div className="flex flex-col gap-10">
        <SectionHeader
          headline="What the same stack costs in pieces"
          accent="var(--color-primary)"
          lede="Each module replaces a tool you'd otherwise pay for on its own. Here's the real, published 2026 price of each — and what you keep by running them as one platform on one bill."
        />

        <div className="border-base-300 bg-base-300 grid grid-cols-1 gap-px overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.value} className="bg-base-100 flex flex-col gap-2.5 p-7">
              <Display as="h3" size={42} lineHeight={42}>
                {s.value}
                {s.suffix ? <span className="text-h3 text-ink-muted">{s.suffix}</span> : null}
              </Display>
              <Text size={14}>{s.label}</Text>
            </div>
          ))}
        </div>

        {/* Ledger */}
        <div className="bg-base-100 border-base-300 overflow-hidden rounded-xl border">
          <div className="mkt-ledger-head bg-base-200 border-base-300 border-b">
            {/* Table column headers — a functional label row, not an eyebrow. */}
            <LedgerLabel>sparx module</LedgerLabel>
            <span />
            <LedgerLabel>What you&apos;d buy instead</LedgerLabel>
            <LedgerLabel align="right">Their price</LedgerLabel>
          </div>
          {LEDGER.map((row, i) => (
            <div
              key={row.key}
              className={cx(
                'mkt-ledger-row',
                i === LEDGER.length - 1 ? null : 'border-base-300 border-b'
              )}
            >
              <span className="mkt-ledger-mod flex min-w-0 items-center gap-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: MOD[row.key] }}
                />
                <Text as="span" size={15} tone="default" weight={500}>
                  {row.name}
                </Text>
                <Badge color="primary" variant="soft" size="sm" className="font-mono">
                  {row.price}
                </Badge>
              </span>
              <span className="mkt-ledger-vs text-ink-subtle text-center font-mono" aria-hidden>
                →
              </span>
              <Text as="span" size={14} className="min-w-0">
                {row.alt}
              </Text>
              <Text as="span" size={14} mono className="mkt-ledger-amt text-right">
                {row.amt}
              </Text>
            </div>
          ))}
        </div>

        {/* Scenario cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {SCENARIOS.map((sc) => (
            <div
              key={sc.title}
              className={cx(
                'bg-base-100 flex flex-col gap-3.5 rounded-xl border p-6',
                sc.featured ? 'border-primary shadow-lg' : 'border-base-300'
              )}
            >
              <div>
                <Text as="h3" size={16} tone="default" weight={500} className="tracking-[-0.01em]">
                  {sc.title}
                </Text>
                <Text size={13} className="mt-1">
                  {sc.sub}
                </Text>
              </div>
              <ScenarioLine k="Bought separately" v={sc.separate} strike />
              <ScenarioLine k="On sparx" v={sc.sparx} sparx />
              <div className="bg-success bg-soft text-success mt-0.5 flex items-center gap-2.5 rounded-lg px-3 py-3">
                <CheckMark />
                <Text as="span" size={14} tone="none" weight={500}>
                  {sc.save}
                </Text>
              </div>
            </div>
          ))}
        </div>

        {/* Sourcing footnote — deliberately quiet: a legal-style note, not copy
            the visitor is asked to read. */}
        <Text size={12} tone="subtle" className="max-w-[880px]">
          Comparison uses publicly listed 2026 monthly prices for representative growth-tier plans
          of the tools each module replaces — Webflow Premium, Shopify Advanced and Plus, a headless
          CMS, HubSpot Sales Professional, Klaviyo, a dropshipping app, FreshBooks, an inventory
          app, Intercom, and Zapier for the glue between them. Those prices scale up with seats,
          contacts, and usage, so a real-world stack usually costs more. Invoicing and Inventory
          come free with Commerce or B2B, so they add $0 to the full-platform total. sparx is flat —
          the module price is the price.
        </Text>
      </div>
    </Section>
  );
}

function LedgerLabel({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <span
      className={cx(
        'text-micro text-ink-muted font-mono tracking-[0.06em] uppercase',
        align === 'right' && 'text-right'
      )}
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
    <div className="flex items-baseline justify-between">
      <Text as="span" size={14}>
        {k}
      </Text>
      <Text
        as="span"
        size={15}
        mono
        weight={sparx ? 500 : 400}
        tone={sparx ? 'none' : 'default'}
        className={cx(sparx && 'text-primary', strike && 'line-through')}
      >
        {v}
      </Text>
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
      'Catalog visibility & access control',
      'Approval workflows & buyer roles',
    ],
  },
  {
    key: 'ai',
    name: 'AI',
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
  {
    key: 'scheduling',
    name: 'Scheduling',
    price: '$29/mo',
    repl: 'Replaces a standalone appointments tool',
    feats: [
      'Appointments, classes, reservations, rentals',
      'No double-booking — enforced in the DB',
      'Deposits, no-show & cancellation policies',
      'Auto-promoting waitlists',
      'Email & SMS reminders',
      'Calendar feed + busy import',
    ],
  },
  {
    key: 'invoicing',
    name: 'Invoicing',
    price: '$19/mo',
    repl: 'Replaces a standalone invoicing tool',
    feats: [
      'Estimates, quotes & invoices — one document',
      'Card & ACH payment links',
      'Recurring & milestone billing',
      'Automatic overdue reminders',
      'Tied to the same customer record',
      'Free with Commerce or B2B',
    ],
  },
  {
    key: 'inventory',
    name: 'Inventory',
    price: '$29/mo',
    repl: 'Replaces a standalone inventory app',
    feats: [
      'Stock across multiple locations',
      'Reorder points & low-stock alerts',
      'Real-time sync to every channel',
      'Transfers, adjustments & counts',
      'Purchase orders to suppliers',
      'Free with Commerce or B2B',
    ],
  },
  {
    key: 'chat',
    name: 'Live Chat',
    price: '$19/mo',
    repl: 'Replaces a live-chat tool like Intercom',
    feats: [
      'Live chat widget on your site',
      'Routed to your shared inbox',
      'Tied to the customer record',
      'Canned replies & office hours',
      'Full history across conversations',
    ],
  },
];

function FeatureTable() {
  return (
    <Section surface="surface" padding="xl">
      <div className="flex flex-col gap-10">
        <SectionHeader
          headline="Every feature, by module"
          accent="var(--color-primary)"
          lede="The complete list — what each module includes and what it replaces. Open any module below; the platform underneath comes with every plan."
        />
        <div className="bg-base-100 border-base-300 overflow-hidden rounded-xl border">
          {FEATURES.map((m, i) => (
            <details
              key={m.key}
              className={cx(
                'mkt-ft-module',
                i === FEATURES.length - 1 ? null : 'border-base-300 border-b'
              )}
              open={i === 0}
            >
              <summary className="mkt-summary mkt-ft-summary">
                <Text
                  as="span"
                  size={16}
                  tone="default"
                  weight={500}
                  className="mkt-ft-name flex w-[188px] shrink-0 items-center gap-3 tracking-[-0.01em]"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: MOD[m.key] }}
                  />
                  {m.name}
                </Text>
                <Text as="span" size={13} mono className="mkt-ft-price w-[76px] shrink-0">
                  {m.price}
                </Text>
                <Text as="span" size={13} className="mkt-ft-repl min-w-0 flex-1">
                  {m.repl}
                </Text>
                <Text as="span" size={11} mono className="mkt-ft-count shrink-0 tracking-[0.02em]">
                  {m.feats.length} features
                </Text>
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
              <div className="mkt-ft-body pt-0.5 pr-6 pb-6 pl-12">
                <div className="mkt-ft-feats">
                  {m.feats.map((f) => (
                    <span key={f}>
                      <span
                        className="size-[5px] shrink-0 rounded-full"
                        style={{ backgroundColor: MOD[m.key] }}
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
      <div className="flex flex-col gap-12">
        <SectionHeader headline="Pricing without the asterisks" accent="var(--color-primary)" />
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title}>
              <Text
                as="h3"
                size={17}
                tone="default"
                weight={500}
                className="flex items-center gap-2.5 tracking-[-0.01em]"
              >
                <span className="bg-primary size-2 shrink-0 rounded-full" />
                {p.title}
              </Text>
              <Text size={14} className="mt-2 ml-[18px]">
                {p.body}
              </Text>
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
  'Security review + custom MSA',
  'Volume pricing',
  'Migration assistance',
];

function Enterprise() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <div className="min-w-[300px] flex-1">
          <SectionHeader
            headline="Bigger needs? Let&rsquo;s talk"
            accent="var(--color-primary)"
            lede="For teams with security reviews, procurement, and uptime commitments. Custom pricing that still bills the way the switchboard does — pay for the modules you run."
          />
          <div className="mt-7 grid max-w-[560px] grid-cols-2 gap-x-7 gap-y-3.5">
            {ENTERPRISE_FEATS.map((f) => (
              <Text
                key={f}
                as="span"
                size={14}
                tone="default"
                className="flex items-center gap-2.5"
              >
                <CheckMark className="text-primary" />
                {f}
              </Text>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3">
          <a href="/enterprise" className={buttonClasses({ size: 'lg', variant: 'solid' })}>
            Talk to sales
          </a>
          <a href="/platform" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
            See the platform →
          </a>
        </div>
      </div>
    </Section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────── */

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What counts as a module?',
    a: 'The twelve capabilities in the switchboard — Builder, Commerce, CMS, CRM, Invoicing, Email, B2B, Dropship, Inventory, Live Chat, Scheduling, and AI. Each is a flat monthly price you switch on or off independently — and Invoicing and Inventory come free the moment you turn on Commerce or B2B. The platform underneath (hosting, security, API) is included on every plan.',
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
      <div className="flex flex-col gap-10">
        <SectionHeader headline="Questions about the bill" accent="var(--color-primary)" />
        <div className="border-base-300 max-w-[820px] border-t">
          {FAQS.map((f) => (
            <details key={f.q} className="mkt-faq-item border-base-300 border-b">
              <summary className="mkt-summary text-base-content text-body-lg flex items-center justify-between gap-4 px-1 py-5 font-sans font-medium tracking-[-0.01em]">
                {f.q}
                <span className="mkt-faq-icon text-ink-muted">
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
              <Text size={15} className="max-w-[680px] px-1 pb-6">
                {f.a}
              </Text>
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
    <Section surface="page" padding="xl" className="border-base-300 border-t text-center">
      <div className="flex flex-col items-center">
        <div className="mx-auto max-w-[15ch]">
          <Display size={56} lineHeight={57}>
            Your plan&apos;s already built
            <Spark />
          </Display>
        </div>
        <Text size={18} className="mx-auto mt-5 mb-8 max-w-[540px]">
          Flip on the modules you need to see your exact price, then start a 14-day free trial of
          the whole platform — no credit card required.
        </Text>
        <div className="flex flex-wrap justify-center gap-3.5">
          <a
            href="#plan"
            className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
          >
            Build your plan ↑
          </a>
          <a href="/enterprise" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
            Talk to sales
          </a>
        </div>
        <Text size={12} mono className="mt-6">
          14-day free trial · No card to start · Cancel anytime
        </Text>
      </div>
    </Section>
  );
}

/* ── Shared helpers ──────────────────────────────────────────── */

/** Check glyph — strokes with `currentColor`, so the caller sets the hue with an
 *  ink utility (`text-success`, `text-primary`) rather than a hex prop. */
function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cx('shrink-0', className)}
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
      stroke="currentColor"
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
