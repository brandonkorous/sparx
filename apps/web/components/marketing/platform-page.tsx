import type { ReactNode } from 'react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
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
import { MODULE_ORDER } from '@/lib/modules';

// Modules with a dedicated marketing page (MODULE_ORDER). Tiles for modules
// without one (Invoicing, Inventory, Live Chat) point at /pricing instead of a
// 404. Sourced from lib/modules so it can't drift as pages ship.
const HAS_PAGE = new Set<string>(MODULE_ORDER);

/**
 * The /platform marketing page — the "what is sparx as a system" page reached
 * from the header's first nav item. Deliberately DISTINCT from the home page:
 * the home page sells the marketing beats (cost comparison, the MCP chat demo,
 * the permanence promise); this page explains how the system actually works.
 * No section is lifted from the home page's sections.
 *
 * Ported from mockups/platform.html. Built on the marketing primitives + silicaui
 * typography, per SILICA-VOCABULARY.md: every static value is a utility class and
 * the dark bands are `data-theme` islands (`<Section surface="dark">` / the inline
 * data-layer bar), so no literal hex is painted anywhere. The only inline `style`
 * left is a genuinely per-instance module hue.
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

// Module colors, resolved once. getModuleColor returns { color, bg, ink } where
// `color` is a CSS var (var(--color-module-*)) for the few places that need a
// VALUE, and `bg`/`ink` are the literal silica utility classes.
const MODS = {
  builder: getModuleColor('builder'),
  commerce: getModuleColor('commerce'),
  cms: getModuleColor('cms'),
  crm: getModuleColor('crm'),
  email: getModuleColor('email'),
  b2b: getModuleColor('b2b'),
  ai: getModuleColor('ai'),
  dropship: getModuleColor('dropship'),
  scheduling: getModuleColor('scheduling'),
} as const;

/**
 * Mono metadata chip. Theme-agnostic by construction — inside the dark data-layer
 * island the same base-200/base-300/ink-muted tokens flip with the island, so
 * there is one chip, not a light one and a hand-darkened twin.
 */
function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`bg-base-200 border-base-300 text-ink-muted text-mini rounded-full border px-2.5 py-1 font-mono${
        className ? ` ${className}` : ''
      }`}
    >
      {children}
    </span>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────
function PlatformHero() {
  const metrics = [
    { v: '12', s: 'modules, one platform' },
    { v: '1', s: 'shared data layer' },
    { v: '$10', suffix: '/mo', s: 'starting price' },
    { v: 'MCP', spark: true, s: 'native AI access' },
    { v: '100%', s: 'API-first, your data' },
  ] as const;

  return (
    <section className="bg-base-200 px-page pb-section-lg pt-[clamp(56px,9vw,96px)]">
      <Container className="flex flex-col gap-10">
        <div className="max-w-[1100px]">
          <Display as="h1" size={104} lineHeight={96}>
            One platform for{' '}
            <span className="text-ink-subtle">
              content and commerce
              <Spark />
            </span>
          </Display>
        </div>

        <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <Text variant="lead" className="text-ink-muted max-w-[600px]">
            sparx is a modular operating system for the web. Builder, Commerce, CMS, CRM, Invoicing,
            Email, B2B, Dropship, Inventory, Live Chat, Scheduling, and AI — plus SEO and
            Automations free with any of them — running on one shared data layer, behind one
            dashboard, on one bill. A publisher, a shop, a wholesale distributor, and a CRM-only
            team are all equally first-class. Selling is one capability, never the assumption.
          </Text>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <Button color="neutral" size="lg">
                Start free →
              </Button>
              <Button size="lg" variant="outline">
                Talk to sales
              </Button>
            </div>
            <Text className="text-mini text-ink-subtle font-mono">
              No credit card · Live in five minutes
            </Text>
          </div>
        </div>

        <div className="border-base-300 mt-2 flex flex-wrap items-center justify-between gap-x-14 gap-y-8 border-t pt-8">
          {metrics.map((m) => (
            <div key={m.s} className="flex flex-col gap-1">
              <span className="text-base-content text-h1 font-medium tracking-[-0.02em]">
                {m.v}
                {'suffix' in m && m.suffix ? (
                  <span className="text-ink-subtle text-body font-normal">{m.suffix}</span>
                ) : null}
                {'spark' in m && m.spark ? <Spark /> : null}
              </span>
              <Text className="text-caption text-ink-muted">{m.s}</Text>
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
    { label: 'AI', module: 'ai' },
    { label: 'Dropship', module: 'dropship' },
    { label: 'Scheduling', module: 'scheduling' },
  ];

  return (
    <Section surface="surface" padding="lg">
      <div className="max-w-[720px]">
        <SectionHeader
          accent="var(--color-primary)"
          headline={<>Not integrations. One system</>}
          lede={
            <>
              Every other &ldquo;all-in-one&rdquo; is a bundle of separate products stitched
              together with syncs that drift and break. sparx modules read and write the same
              records. Your CRM is built <em>on</em> your commerce data — not connected to a copy of
              it.
            </>
          }
        />
      </div>

      <div className="mt-14 flex flex-col items-center">
        {/* module chips */}
        <div className="flex flex-wrap justify-center gap-2.5">
          {chips.map((c) => (
            <span
              key={c.label}
              className="bg-base-200 border-base-300 text-base-content text-caption inline-flex items-center gap-2 rounded-full border px-4 py-2 font-medium"
            >
              <Dot color={getModuleColor(c.module).color} size={8} />
              {c.label}
            </span>
          ))}
        </div>

        {/* converging connector */}
        <div className="h-11 w-full max-w-[760px]" aria-hidden>
          <svg
            viewBox="0 0 760 44"
            fill="none"
            preserveAspectRatio="none"
            className="block h-full w-full"
          >
            <path
              d="M60 0 V14 Q60 22 110 22 H370"
              stroke="var(--color-base-300)"
              strokeWidth={1.5}
            />
            <path
              d="M180 0 V14 Q180 22 230 22 H380"
              stroke="var(--color-base-300)"
              strokeWidth={1.5}
            />
            <path d="M300 0 V22 H380" stroke="var(--color-base-300)" strokeWidth={1.5} />
            <path d="M420 0 V22 H380" stroke="var(--color-base-300)" strokeWidth={1.5} />
            <path
              d="M540 0 V14 Q540 22 490 22 H380"
              stroke="var(--color-base-300)"
              strokeWidth={1.5}
            />
            <path
              d="M700 0 V14 Q700 22 650 22 H380"
              stroke="var(--color-base-300)"
              strokeWidth={1.5}
            />
            <path d="M380 22 V44" stroke="var(--color-primary)" strokeWidth={2} />
            <circle cx="380" cy="22" r="3.5" fill="var(--color-primary)" />
          </svg>
        </div>

        {/* data layer bar — a dark theme island, so every token below it flips */}
        <div
          data-theme="dark"
          className="bg-base-100 border-t-primary flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 rounded-2xl border-t-[3px] px-7 py-6"
        >
          <div className="max-w-[420px]">
            <Heading level={3} size={5}>
              One data layer
            </Heading>
            <Text className="text-caption text-ink-muted mt-1">
              Postgres with row-level security per tenant. Customers, orders, content, and contacts
              are the same records everywhere.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            {['tenant-isolated', 'RLS-enforced', 'event-driven'].map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>

        {/* surface bar (light) */}
        <div className="bg-base-100 border-base-300 mt-3.5 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 rounded-2xl border px-7 py-6">
          <div className="max-w-[440px]">
            <Heading level={3} size={5}>
              One surface — API-first &amp; MCP-native
            </Heading>
            <Text className="text-caption text-ink-muted mt-1">
              Every feature is an API endpoint first. The dashboard, your site, and your AI are all
              just clients of the same API.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            {['REST + GraphQL', 'MCP server', 'webhooks'].map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>

        <Text className="text-body-sm text-ink-muted mt-9 max-w-[620px] text-center">
          <b className="text-base-content font-medium">Turn a module off and it stops billing</b> —
          no migration, no exports, no goodbyes. The data stays where it was; it just goes quiet.
        </Text>
      </div>
    </Section>
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
        accent="var(--color-primary)"
        headline={<>A customer is one customer</>}
        lede={
          <>
            Because every module writes to the same tables, there are no duplicate records and
            nothing to keep in sync. The buyer who placed an order, opened your email, and called
            your sales line is a single profile — with each module&apos;s view of them attached.
          </>
        }
      />

      <div className="bg-base-100 border-base-300 mt-14 max-w-[760px] overflow-hidden rounded-2xl border shadow-lg">
        {/* head */}
        <div className="border-base-300 flex items-center gap-4 border-b px-6 py-5">
          <span className="bg-primary text-primary-content text-body inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full font-medium">
            RT
          </span>
          <div className="flex-1">
            <Heading level={3} size={5}>
              Ranchero Trucking Co.
            </Heading>
            <Text className="text-mini text-ink-subtle mt-0.5 font-mono">
              orders@rancherotrucking.com
            </Text>
          </div>
          <Tag className="whitespace-nowrap">customer · one record</Tag>
        </div>

        {/* facets — 2 columns, collapses to 1 on mobile */}
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
          {facets.map((f, i) => (
            <div
              key={f.label}
              className={`border-base-300 border-b px-6 py-4 ${i % 2 === 0 ? 'border-r' : ''}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Dot color={MODS[f.module].color} size={8} />
                <Text as="span" className="text-caption text-ink-muted font-medium">
                  {f.label}
                </Text>
              </div>
              <Text className="text-body-sm text-base-content">{f.val}</Text>
              <Text className="text-caption text-ink-subtle mt-1">{f.sub}</Text>
            </div>
          ))}
        </div>

        {/* foot */}
        <div className="flex items-center gap-2.5 px-6 py-4">
          <Dot color="var(--color-success)" size={7} />
          <Text className="text-caption text-ink-muted">
            One profile, written by four modules — no integration, no copy, no drift.
          </Text>
        </div>
      </div>
    </Section>
  );
}

// ── FOUR COMMITMENTS ───────────────────────────────────────────────────────
function FourCommitments() {
  const items = [
    {
      accent: MODS.builder.color,
      title: 'Modular',
      body: 'Activate only what you need. A disabled module runs no workers, stores no rows, and costs nothing. Add the next one when you’re ready — no replatform.',
    },
    {
      accent: MODS.crm.color,
      title: 'One data layer',
      body: 'Modules share records, not syncs. A customer is one customer across Commerce, CRM, and Email. Reporting is unified because the data was never split.',
    },
    {
      accent: MODS.ai.color,
      title: 'API-first & MCP-native',
      body: 'Every feature ships as an API endpoint before it gets a screen. A first-class MCP server lets your AI read and write live business data — natively, not via export.',
    },
    {
      accent: 'var(--color-success)',
      title: 'Permanent',
      body: 'You own the data and the site. Export anytime, edit anything no-code, drop to full code when you want. AI can build it — sparx is what keeps it.',
    },
  ];

  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent="var(--color-primary)"
        headline={<>Four commitments that hold across every module</>}
      />
      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.title}
            className="bg-base-200 border-base-300 flex min-h-[240px] flex-col gap-3 rounded-xl border px-6 pt-7 pb-8"
          >
            {/* The commitment's identity hue — a per-item runtime value. */}
            <span className="h-[3px] w-7 rounded-full" style={{ backgroundColor: it.accent }} />
            <Heading level={3} size={4}>
              {it.title}
            </Heading>
            <Text className="text-small text-ink-muted">{it.body}</Text>
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
      when: 'Day one',
      title: 'A live site',
      body: 'Pick a theme, edit blocks, point your domain. Published in minutes.',
      tags: [{ label: 'Builder', module: 'builder' as const }],
    },
    {
      when: 'When you sell',
      title: 'The same site sells',
      body: 'Turn on Commerce. Your existing pages gain cart and checkout — no rebuild.',
      tags: [{ label: '+ Commerce', module: 'commerce' as const }],
    },
    {
      when: 'As you grow',
      title: 'Customers, nurtured',
      body: 'Add CRM and Email. They already know every buyer from day one — no import.',
      tags: [
        { label: '+ CRM', module: 'crm' as const },
        { label: '+ Email', module: 'email' as const },
      ],
    },
    {
      when: 'For wholesale',
      title: 'Net terms & accounts',
      body: 'Switch on B2B. The same accounts gain pricing tiers, POs, and net terms.',
      tags: [{ label: '+ B2B', module: 'b2b' as const }],
    },
  ];

  return (
    <Section padding="lg">
      <SectionHeader
        accent="var(--color-primary)"
        headline={<>Start with one. Add the rest, no replatform</>}
        lede={
          <>
            Most platforms make you migrate to grow. sparx doesn&apos;t. Switch on a module and it
            reads the catalog, customers, and content already there. Switch it off and it goes quiet
            — the data stays exactly where it was.
          </>
        }
      />
      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((s) => (
          <div key={s.title} className="flex flex-col">
            <Heading level={3} size={5}>
              {s.title}
            </Heading>
            <Text className="text-small text-ink-muted mt-2">
              {s.when} — {s.body}
            </Text>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {s.tags.map((t) => (
                <span
                  key={t.label}
                  className="bg-base-100 border-base-300 text-base-content text-mini inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium"
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
      price: '$10/mo',
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
      label: 'AI',
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
    {
      module: 'scheduling',
      label: 'Scheduling',
      price: '$29/mo',
      title: 'Every booking, one engine',
      body: 'Appointments, classes, deposits, reminders.',
    },
    {
      module: 'invoicing',
      label: 'Invoicing',
      price: '$19/mo',
      title: 'Get paid',
      body: 'Quotes, invoices, payment links — free with Commerce or B2B.',
    },
    {
      module: 'inventory',
      label: 'Inventory',
      price: '$29/mo',
      title: 'Track stock',
      body: 'Locations, reorder points, live sync — free with Commerce or B2B.',
    },
    {
      module: 'chat',
      label: 'Live Chat',
      price: '$19/mo',
      title: 'Talk to visitors',
      body: 'Live chat tied to the same customer record.',
    },
  ];

  return (
    <Section id="modules" surface="surface" padding="lg">
      <SectionHeader
        accent="var(--color-primary)"
        headline={
          <>
            Twelve modules. <span className="text-ink-subtle">Mix any combination</span>
          </>
        }
      />
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {mods.map((m) => {
          const c = getModuleColor(m.module);
          return (
            <a
              key={m.module}
              href={HAS_PAGE.has(m.module) ? `/${m.module}` : '/pricing'}
              // Module menu: each tile wears its module hue as a color legend,
              // via silica's own `soft` wash — not a hand-rolled percentage.
              className={`${c.bg} bg-soft border-base-300 flex min-h-[142px] flex-col gap-2 rounded-lg border p-5 no-underline`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <Dot color={c.color} size={7} />
                  <Heading level={3} size={6}>
                    {m.label}
                  </Heading>
                </span>
                <Text as="span" className="text-mini text-ink-subtle font-mono">
                  {m.price}
                </Text>
              </div>
              <Text className="text-small text-base-content">{m.title}</Text>
              <Text className="text-caption text-ink-muted">{m.body}</Text>
            </a>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Text className="text-small text-ink-muted max-w-[520px]">
          Content-only, commerce-only, or the whole platform — every combination shares the same
          dashboard, the same data, and the same bill.
        </Text>
        <a href="/modules" className={buttonClasses({ variant: 'outline' })}>
          Explore all modules →
        </a>
      </div>
    </Section>
  );
}

// ── API SURFACE (dark) ─────────────────────────────────────────────────────
function ApiSurface() {
  const clients = [
    { ci: 'D', bg: MODS.builder.bg, name: 'Dashboard', desc: 'The admin UI is just a client' },
    { ci: 'S', bg: MODS.commerce.bg, name: 'Your site', desc: 'Site and pages read the same API' },
    { ci: 'AI', bg: MODS.ai.bg, name: 'MCP / AI', desc: 'Claude, ChatGPT, Copilot — natively' },
    { ci: '↯', bg: MODS.cms.bg, name: 'Webhooks', desc: 'Events push to your own systems' },
    {
      ci: '</>',
      bg: MODS.b2b.bg,
      name: 'Your code',
      desc: 'Build anything on the headless API + SDK',
    },
  ];

  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[720px]">
        <Display size={56} lineHeight={60}>
          Everything is an API. Even the AI
          <Spark color={MODS.ai.color} />
        </Display>
        <Text variant="lead" className="text-ink-muted mt-6 max-w-[640px]">
          Every feature ships as an endpoint before it ships a screen. The dashboard, your site,
          your integrations, and your AI assistant are all clients of the same API — nothing is
          trapped inside the UI.
        </Text>
      </div>

      <div className="mt-14 flex flex-col items-stretch gap-8 lg:flex-row">
        {/* clients */}
        <div className="flex w-[420px] max-w-full shrink-0 flex-col gap-3">
          {clients.map((c) => (
            <div
              key={c.name}
              className="bg-base-200 border-base-300 flex items-center gap-3.5 rounded-lg border px-4 py-3.5"
            >
              <span
                className={`${c.bg} soft text-mini inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md font-mono font-medium`}
              >
                {c.ci}
              </span>
              <div>
                <Text className="text-small text-base-content font-medium">{c.name}</Text>
                <Text className="text-mini text-ink-muted">{c.desc}</Text>
              </div>
            </div>
          ))}
        </div>

        {/* code card */}
        <div className="bg-base-200 border-base-300 border-t-primary min-w-[320px] flex-1 self-start overflow-hidden rounded-xl border border-t-[3px]">
          <div className="border-base-300 text-mini text-ink-muted flex items-center gap-2 border-b px-4 py-3.5 font-mono">
            <span className="text-success font-medium">GET</span>
            /v1/customers/cus_4471
          </div>
          <div className="text-mini text-base-content overflow-x-auto px-5 py-4 font-mono leading-[22px] whitespace-pre">
            <div className="text-ink-subtle">{'// the same record the four modules wrote'}</div>
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
              <K>&quot;subscribed&quot;</K>: <N>true</N>, <K>&quot;open_rate&quot;</K>: <N>0.41</N>{' '}
              {'}'},
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

      <Text variant="lead" className="text-ink-muted mt-9 max-w-[640px]">
        Connect Claude, ChatGPT, or Copilot through the first-class MCP server.{' '}
        <a href="/agentic" className="text-primary font-medium">
          See it answer questions about your business →
        </a>
      </Text>
    </Section>
  );
}

// JSON token helpers for the API code card — semantic + module tokens, no hexes.
function K({ children }: { children: ReactNode }) {
  return <span className="text-info">{children}</span>;
}
function S({ children }: { children: ReactNode }) {
  return <span className="text-success">{children}</span>;
}
function N({ children }: { children: ReactNode }) {
  return <span className={MODS.commerce.ink}>{children}</span>;
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
        accent="var(--color-primary)"
        headline={<>Enterprise foundations, on by default</>}
      />
      <div className="mt-13 grid grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.title}>
            <Heading level={3} size={5} className="flex items-center gap-3">
              <Dot color="var(--color-primary)" size={9} />
              {it.title}
            </Heading>
            <Text className="text-body-sm text-ink-muted mt-2 ml-5">{it.body}</Text>
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
    { name: 'Everything', price: '$411', note: 'all twelve modules', highlight: false },
  ];

  return (
    <Section id="pricing" surface="surface" padding="lg">
      <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
        <div className="flex-1">
          <Display size={44} lineHeight={46}>
            Pay only for what you use
            <Spark />
          </Display>
          <Text variant="lead" className="text-ink-muted mt-4 max-w-[460px]">
            Start with one module from $10/mo. Add the next when you need it. No bundles, no seat
            tax, no &ldquo;contact us for content.&rdquo; Turn anything off and it stops billing the
            same day.
          </Text>
          <div className="mt-7">
            <a href="/pricing" className={buttonClasses({ color: 'neutral', size: 'lg' })}>
              See full pricing →
            </a>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3.5">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`bg-base-200 min-w-[150px] rounded-xl border px-6 py-5 ${
                t.highlight ? 'border-primary' : 'border-base-300'
              }`}
            >
              <Text className="text-caption text-ink-muted">{t.name}</Text>
              <Heading level={3} size={1} className="mt-2">
                {t.price}
                <span className="text-ink-subtle text-body-sm font-normal">/mo</span>
              </Heading>
              <Text className="text-mini text-ink-subtle mt-1.5">{t.note}</Text>
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
    <Section padding="xl" className="border-base-300 border-t text-center">
      <div className="flex flex-col items-center">
        <Display size={64} lineHeight={64}>
          Put your whole business on one platform
          <Spark />
        </Display>
        <Text variant="lead" className="text-ink-muted mt-6 mb-9 max-w-[560px]">
          Content, commerce, or both. Start with one module and a live site in five minutes — add
          the rest whenever you&apos;re ready.
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Button color="neutral" size="xl">
            Start free
          </Button>
          <Button size="xl" variant="outline">
            Talk to sales
          </Button>
        </div>
        <Text className="text-mini text-ink-subtle mt-6 font-mono">
          No credit card · Cancel anytime · Your data, always exportable
        </Text>
      </div>
    </Section>
  );
}
