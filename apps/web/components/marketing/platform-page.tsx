import type { ReactNode } from 'react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Dot, getModuleColor, type MarketingModule, Spark } from './primitives';
import { Band } from './band';
import { MODULE_ORDER } from '@/lib/modules';

/**
 * A section's headline + lede. Replaces `<SectionHeader>`, whose `accent` prop
 * every one of this page's six calls passed the same `var(--color-primary)`
 * to — six sections, one hue, applied as a decorative full stop. The accent is
 * now a real per-section ink class, so a section that belongs to a module can
 * say so (RULE #4: if it distinguishes A from B, its color carries the
 * distinction).
 */
function BandHeader({
  headline,
  lede,
  accent = 'text-primary',
}: {
  headline: ReactNode;
  lede?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="max-w-3xl">
      <Heading
        level={2}
        size="display"
        className="text-5xl leading-[0.98] tracking-tight sm:text-6xl"
      >
        {headline}
        <span className={accent}>.</span>
      </Heading>
      {lede ? (
        <Text variant="lead" className="mt-5 max-w-2xl text-xl">
          {lede}
        </Text>
      ) : null}
    </div>
  );
}

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
 * Built on silicaui + Tailwind utilities via the shared `<Band>` shell — no
 * `primitives.tsx` layout components, no `px-page` / section-rhythm vars, no
 * inline `style` and no literal hex. Dark bands are real `data-theme` islands,
 * so everything inside resolves its own ink rather than being painted.
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
      className={`bg-base-200 border-base-300 rounded-full border px-2.5 py-1 text-sm font-mono${
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
    { v: '13', s: 'modules, one platform' },
    { v: '1', s: 'place your whole business lives' },
    { v: '$10', suffix: '/mo', s: 'starting price' },
    { v: 'AI', spark: true, s: 'that works from your real data' },
    { v: '100%', s: 'yours — export it any time' },
  ] as const;

  return (
    <Band className="pt-16 lg:pt-20">
      <div className="flex flex-col gap-14">
        {/* One left column, headline → lede → action. It used to be a two-column
            row with the lede on the left and the buttons bottom-aligned on the
            right, which left the whole right half of the fold empty and floated
            the CTA at mid-height, detached from the sentence it answers. */}
        <div className="flex max-w-4xl flex-col gap-8">
          <Heading
            level={1}
            size="display"
            className="text-7xl leading-[0.94] tracking-tight sm:text-8xl"
          >
            One platform for{' '}
            <span>
              content and commerce
              <Spark />
            </span>
          </Heading>

          <Text variant="lead" className="max-w-2xl text-xl">
            Run your whole business from one place. Builder, Commerce, CMS, CRM, Invoicing, Email,
            B2B, Dropship, Inventory, Live Chat, Scheduling, Finance and AI — plus Social, SEO and
            Automations free with any of them. Everything you switch on shares the same customers
            and the same records, behind one login, on one bill. A publisher, a shop, a wholesale
            distributor and a team that only wants a customer list are all equally at home here.
            Selling is one thing sparx can do, never the assumption.
          </Text>

          <div className="flex flex-col items-start gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Was `` — the page's single most important action,
                  rendered in the one color RULE #4 says has to be earned. */}
              <Button color="primary" size="xl">
                Start free →
              </Button>
              <Button size="xl" variant="outline">
                Talk to sales
              </Button>
            </div>
            <Text className="font-mono text-sm">No credit card · Live in five minutes</Text>
          </div>
        </div>

        <div className="border-base-300 mt-2 flex flex-wrap items-center justify-between gap-x-14 gap-y-8 border-t pt-8">
          {metrics.map((m) => (
            <div key={m.s} className="flex flex-col gap-1">
              <span className="text-4xl font-medium tracking-[-0.02em] sm:text-5xl">
                {m.v}
                {'suffix' in m && m.suffix ? (
                  <span className="text-md font-normal">{m.suffix}</span>
                ) : null}
                {'spark' in m && m.spark ? <Spark /> : null}
              </span>
              <Text className="text-sm">{m.s}</Text>
            </div>
          ))}
        </div>
      </div>
    </Band>
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
    { label: 'Social', module: 'social' },
  ];

  return (
    <Band tone="surface">
      <div className="max-w-[720px]">
        <BandHeader
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
              className="bg-base-200 border-base-300 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
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

        {/* the records bar — a dark theme island, so every token below it flips */}
        <div
          data-theme="dark"
          className="bg-base-100 border-t-primary flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 rounded-2xl border-t-[3px] px-7 py-6"
        >
          <div className="max-w-[420px]">
            <Heading level={3} size={5}>
              One set of records
            </Heading>
            <Text className="mt-1">
              Your customers, orders, content and contacts are one set of records that every part
              reads — not copies being kept in step. And your business is fenced off from every
              other business on sparx, by the database itself.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            {['one copy', 'always current', 'fenced off'].map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>

        {/* surface bar (light) */}
        <div className="bg-base-100 border-base-300 mt-3.5 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 rounded-2xl border px-7 py-6">
          <div className="max-w-[440px]">
            <Heading level={3} size={5}>
              One source everything reads from
            </Heading>
            <Text className="mt-1">
              Your dashboard, your website and any AI assistant you connect all read the same live
              information. Nothing is stuck inside a screen.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            {['open to your tools', 'works with AI', 'keeps apps in step'].map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>

        <Text className="text-md mt-9 max-w-[620px] text-center">
          <b className="font-medium">Turn a module off and it stops billing</b> — no migration, no
          exports, no goodbyes. The data stays where it was; it just goes quiet.
        </Text>
      </div>
    </Band>
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
    <Band>
      <BandHeader
        headline={<>A customer is one customer</>}
        lede={
          <>
            Because every module writes to the same tables, there are no duplicate records and
            nothing to keep in sync. The buyer who placed an order, opened your email, and called
            your sales line is a single profile — with each module&apos;s view of them attached.
          </>
        }
      />

      <div className="bg-base-100 border-base-300 mt-14 max-w-[760px] overflow-hidden rounded-2xl border">
        {/* head */}
        <div className="border-base-300 flex items-center gap-4 border-b px-6 py-5">
          <span className="bg-primary text-primary-content text-md inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full font-medium">
            RT
          </span>
          <div className="flex-1">
            <Heading level={3} size={5}>
              Ranchero Trucking Co.
            </Heading>
            <Text className="mt-0.5 font-mono text-sm">orders@rancherotrucking.com</Text>
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
                <Text as="span" className="text-sm font-medium">
                  {f.label}
                </Text>
              </div>
              <Text className="text-md">{f.val}</Text>
              <Text className="mt-1">{f.sub}</Text>
            </div>
          ))}
        </div>

        {/* foot */}
        <div className="flex items-center gap-2.5 px-6 py-4">
          <Dot color="var(--color-success)" size={7} />
          <Text>One profile, written by four modules — no integration, no copy, no drift.</Text>
        </div>
      </div>
    </Band>
  );
}

// ── FOUR COMMITMENTS ───────────────────────────────────────────────────────
function FourCommitments() {
  const items = [
    {
      title: 'Modular',
      body: 'Switch on only what you need. Anything switched off does nothing and costs nothing. Add the next part when you’re ready — without starting over.',
    },
    {
      title: 'One set of records',
      body: 'Modules share records, not syncs. A customer is one customer across Commerce, CRM, and Email. Reporting is unified because the data was never split.',
    },
    {
      title: 'Open, never locked in',
      body: 'Everything sparx can do, your other tools can do too — including an AI assistant you connect yourself, working from your live business information rather than a stale export.',
    },
    {
      title: 'Permanent',
      body: 'You own the data and the site. Export anytime, edit anything no-code, drop to full code when you want. AI can build it — sparx is what keeps it.',
    },
  ];

  return (
    <Band tone="surface">
      <BandHeader headline={<>Four commitments that hold across every module</>} />
      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.title}
            className="bg-base-200 border-base-300 flex min-h-[240px] flex-col gap-3 rounded-xl border px-6 pt-7 pb-8"
          >
            <Heading level={3} size={4}>
              {it.title}
            </Heading>
            <Text>{it.body}</Text>
          </div>
        ))}
      </div>
    </Band>
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
    <Band>
      <BandHeader
        headline={<>Start with one. Add the rest without starting over</>}
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
            <Text className="mt-2">
              {s.when} — {s.body}
            </Text>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {s.tags.map((t) => (
                <span
                  key={t.label}
                  className="bg-base-100 border-base-300 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium"
                >
                  <Dot color={MODS[t.module].color} size={6} />
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Band>
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
      body: 'An AI assistant that works from your real data.',
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
    {
      module: 'finance',
      label: 'Finance',
      price: '$29/mo',
      title: 'Know what you kept',
      body: 'Spending, profit and job margins — free with Commerce or B2B.',
    },
  ];

  return (
    <Band id="modules" tone="surface">
      <BandHeader
        headline={
          <>
            Thirteen modules. <span>Mix any combination</span>
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
                <Text as="span" className="font-mono text-sm">
                  {m.price}
                </Text>
              </div>
              <Text>{m.title}</Text>
              <Text>{m.body}</Text>
            </a>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Text className="max-w-[520px]">
          Content-only, commerce-only, or the whole platform — every combination shares the same
          dashboard, the same data, and the same bill.
        </Text>
        <a href="/modules" className={buttonClasses({ variant: 'outline' })}>
          Explore all modules →
        </a>
      </div>
    </Band>
  );
}

// ── API SURFACE (dark) ─────────────────────────────────────────────────────
function ApiSurface() {
  const clients = [
    { ci: 'D', bg: MODS.builder.bg, name: 'Dashboard', desc: 'The admin UI is just a client' },
    {
      ci: 'S',
      bg: MODS.commerce.bg,
      name: 'Your site',
      desc: 'Your pages read the same live information',
    },
    { ci: 'AI', bg: MODS.ai.bg, name: 'Your AI', desc: 'Claude, ChatGPT or Copilot, on your data' },
    { ci: '↯', bg: MODS.cms.bg, name: 'Webhooks', desc: 'Events push to your own systems' },
    {
      ci: '</>',
      bg: MODS.b2b.bg,
      name: 'Your code',
      desc: 'Build anything you like on top of it',
    },
  ];

  return (
    <Band tone="dark">
      <div className="max-w-[720px]">
        <Heading
          level={2}
          size="display"
          className="text-5xl leading-[0.98] tracking-tight sm:text-6xl"
        >
          Nothing is locked in. Not even to us
          <Spark color={MODS.ai.color} />
        </Heading>
        <Text variant="lead" className="mt-6 max-w-[640px]">
          Everything sparx can do is open to your other tools, not just to the screens we built.
          Your dashboard, your website, whatever you connect, and any AI assistant you bring are all
          reading the same live information.
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
                className={`${c.bg} soft inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md font-mono text-sm font-medium`}
              >
                {c.ci}
              </span>
              <div>
                <Text className="font-medium">{c.name}</Text>
                <Text>{c.desc}</Text>
              </div>
            </div>
          ))}
        </div>

        {/* code card */}
        <div className="bg-base-200 border-base-300 border-t-primary min-w-[320px] flex-1 self-start overflow-hidden rounded-xl border border-t-[3px]">
          <div className="border-base-300 flex items-center gap-2 border-b px-4 py-3.5 font-mono text-sm">
            <span className="text-success font-medium">GET</span>
            /v1/customers/cus_4471
          </div>
          <div className="overflow-x-auto px-5 py-4 font-mono text-sm leading-[22px] whitespace-pre">
            <div>{'// one customer, as four parts of sparx know them'}</div>
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
          {/* The code sample stays — it is EVIDENCE, not instruction. A reader
              who cannot parse it should still get the point from this caption,
              which is the inline definition the audience rule asks for. */}
          <Text className="border-base-300 border-t px-5 py-4">
            One customer, asked for directly. Everything Commerce, CRM, Email and B2B know about
            them comes back together — because it was never four separate records.
          </Text>
        </div>
      </div>

      <Text variant="lead" className="mt-9 max-w-[640px]">
        Connect Claude, ChatGPT or Copilot and let it work with your real business information.{' '}
        <a href="/agentic" className="text-primary font-medium">
          See it answer questions about your business →
        </a>
      </Text>
    </Band>
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
      body: 'Every record is tagged to your business, and the database itself enforces the boundary rather than the software on top of it. Another business cannot see your customers even if something goes wrong in the app.',
    },
    {
      title: 'Self-hosted email',
      body: 'Transactional and marketing email send from your own domain and reputation on sparx.email — no third-party markup, no shared-IP deliverability roulette.',
    },
    {
      title: 'Nothing keeps you waiting',
      body: 'When something happens — an order lands, a form comes in — the follow-on work runs in the background instead of holding up the page. New automations slot in without disturbing anything already running.',
    },
    {
      title: 'One dashboard, module-aware',
      body: 'Each module shifts the dashboard to its own color and surfaces only its tools. Disabled modules return a clear upgrade path, not a dead end.',
    },
    {
      title: 'Multi-property, multi-brand',
      body: 'Run several sites under one account — separate addresses, looks and catalogs — sharing the same customers, content and bill wherever you want them to.',
    },
    {
      title: 'Own it, export it, leave anytime',
      body: 'Your data is yours. Take all of it with you whenever you want, and open it to your own tools meanwhile. Turn something off and it simply stops — your records stay exactly as they were.',
    },
  ];

  return (
    <Band>
      <BandHeader headline={<>Enterprise foundations, on by default</>} />
      <div className="mt-13 grid grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.title}>
            <Heading level={3} size={5} className="flex items-center gap-3">
              <Dot color="var(--color-primary)" size={9} />
              {it.title}
            </Heading>
            <Text className="text-md mt-2 ml-5">{it.body}</Text>
          </div>
        ))}
      </div>
    </Band>
  );
}

// ── PRICING TEASER ─────────────────────────────────────────────────────────
function PricingTeaser() {
  const tiers = [
    { name: 'Start', price: '$10', note: 'one module', highlight: false },
    { name: 'Grow', price: '$108', note: 'Builder + Commerce + CMS', highlight: true },
    { name: 'Everything', price: '$411', note: 'all thirteen modules', highlight: false },
  ];

  return (
    <Band id="pricing" tone="primary">
      <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
        <div className="flex-1">
          <Heading
            level={2}
            size="display"
            className="text-4xl leading-[1] tracking-tight sm:text-5xl"
          >
            {/* No <Spark/> here — it paints the closing period `text-primary`,
                which is this band's own fill. The band IS the accent. */}
            Pay only for what you use.
          </Heading>
          <Text variant="lead" className="mt-4 max-w-[460px]">
            Start with one module from $10/mo. Add the next when you need it. No bundles, no seat
            tax, no &ldquo;contact us for content.&rdquo; Turn anything off and it stops billing the
            same day.
          </Text>
          <div className="mt-7">
            {/* `neutral` on the Ember band, and it belongs there: near-black on
                Ember is a contrasting solid, not black-on-black. Neutral is a
                real member of the palette — the only thing it must never do is
                sit on a dark fill. */}
            <a href="/pricing" className={buttonClasses({ color: 'neutral', size: 'lg' })}>
              See full pricing →
            </a>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3.5">
          {tiers.map((t) => (
            <div
              key={t.name}
              // `bg-base-100 text-base-content` — the fill AND its paired ink.
              // Carrying only the fill left these inheriting the band's
              // `text-primary-content`, i.e. white type on a light card.
              className={`bg-base-100 text-base-content min-w-[150px] rounded-xl border px-6 py-5 ${
                t.highlight ? 'border-primary border-2' : 'border-base-300'
              }`}
            >
              <Text>{t.name}</Text>
              <Heading level={3} size={1} className="mt-2">
                {t.price}
                <span className="text-md font-normal">/mo</span>
              </Heading>
              <Text className="mt-1.5">{t.note}</Text>
            </div>
          ))}
        </div>
      </div>
    </Band>
  );
}

// ── FINAL CTA ──────────────────────────────────────────────────────────────
function PlatformCta() {
  return (
    <Band tone="dark" className="text-center">
      <div className="flex flex-col items-center">
        <Heading
          level={2}
          size="display"
          className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
        >
          Put your whole business on one platform
          <Spark />
        </Heading>
        <Text variant="lead" className="mt-6 mb-9 max-w-[560px]">
          Content, commerce, or both. Start with one module and a live site in five minutes — add
          the rest whenever you&apos;re ready.
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Button color="primary" size="xl">
            Start free
          </Button>
          <Button size="xl" variant="outline">
            Talk to sales
          </Button>
        </div>
        <Text className="mt-6 font-mono text-sm">
          No credit card · Cancel anytime · Your data, always exportable
        </Text>
      </div>
    </Band>
  );
}
