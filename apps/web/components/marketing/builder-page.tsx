import { Button } from '@wizeworks/silicaui-react';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  Section,
  SectionHeader,
  Spark,
  Text,
} from './primitives';

/**
 * The /builder marketing page. Builder is the **website module** — the one
 * module that renders, hosts, and serves a public site. The story is the
 * two-promise arc: **live in 5 minutes** (the on-ramp) AND **built to last**
 * (permanence — "AI builds it. sparx keeps it."; you own the data and the site,
 * maintain it yourself for years, no rebuild). Bespoke + full-length, modeled on
 * agentic-page.tsx; Builder's accent is the indigo platform color.
 *
 * Selling is kept optional throughout (content AND/OR commerce). No invented
 * metrics or customers. The "code optional" escape ladder is grounded in
 * docs/47-class-first-authoring-model.md. All copy is rendered from string
 * consts so there are no JSX-entity escapes to manage.
 *
 * Authoring: silica components + Tailwind utilities only (SILICA-VOCABULARY.md).
 * The only inline `style` left is the Builder module hue handed to <Dot>/<Spark>
 * as a VALUE — everything static is a class.
 */
export function BuilderPage() {
  return (
    <>
      <BuilderHero />
      <TheArc />
      <HowItWorks />
      <Capabilities />
      <CodeOptional />
      <BuiltToLast />
      <WhatYouCanBuild />
      <BuilderPricing />
      <BuilderCta />
    </>
  );
}

const B = getModuleColor('builder');

// ── HERO ──────────────────────────────────────────────────────────────────────
function BuilderHero() {
  const lede =
    'Builder is the one module that puts a real website in front of your work — themes, pages, a custom domain, SSL and a global CDN, all handled. Pick a theme, edit it in your browser, point your domain, publish. The same builder serves a one-page portfolio, a 40-post blog, or a 50,000-product catalog — selling is optional.';
  const chips = [
    'live in 5 minutes',
    'custom domain + SSL',
    'no code required',
    'content or commerce',
  ];
  return (
    <section className="bg-base-200 px-page pb-section-lg pt-[clamp(56px,9vw,96px)]">
      <Container className="flex flex-col gap-10">
        <div className="flex max-w-[1100px] flex-col gap-2">
          <Display as="h1" size={96} lineHeight={90}>
            Your site,
          </Display>
          <Display as="h1" size={96} lineHeight={90}>
            live in 5 minutes
            <Spark color={B.color} />
          </Display>
        </div>

        <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <Text size={18} className="max-w-[640px]">
            {lede}
          </Text>

          <div className="flex flex-wrap items-center gap-3">
            <Button color="primary" size="lg">
              Start your site →
            </Button>
            <a href="#how">
              <Button size="lg" variant="outline">
                See how it works
              </Button>
            </a>
          </div>
        </div>

        <ul className="flex list-none flex-wrap items-center gap-x-3 gap-y-2.5">
          {chips.map((c) => (
            <li
              key={c}
              className="bg-base-100 border-base-300 inline-flex items-center gap-2 rounded-full border px-3 py-[7px]"
            >
              <Dot color={B.color} size={6} />
              <Text as="span" size={12} mono>
                {c}
              </Text>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

// ── THE ARC · live in 5 minutes AND built to last ─────────────────────────────
function TheArc() {
  // No kicker above the titles: the heading carries itself (RULE #2).
  const cards: { title: string; body: string; points: string[] }[] = [
    {
      title: 'Live in 5 minutes',
      body: 'Pick a theme, change the parts that matter, point your domain, publish. No app store, no Zapier, no waiting on a developer to get a real site online.',
      points: [
        'Start from a polished theme, not a blank page',
        'Edit blocks right in the browser — see it as you type',
        'Custom domain and SSL provision themselves',
      ],
    },
    {
      title: 'Built to last',
      body: 'Generate it with AI if you want — but sparx is where the site lives afterward. You maintain and enhance it yourself, for years, in a no-code editor. AI builds it. sparx keeps it.',
      points: [
        'You own the data and the site — export anytime',
        'Change anything yourself, no rebuild, no dev on retainer',
        'Go headless whenever you want — the door is never locked',
      ],
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <div className="max-w-[760px]">
        <SectionHeader
          accent={B.color}
          headline="Fast to start. Permanent to keep"
          lede="Most site tools make you choose: quick and disposable, or powerful and painful. Builder is both ends at once. You're live the first afternoon — and the site you stand up today is the one you still run in five years, no rebuild, no developer on retainer."
        />
      </div>
      <div className="mt-13 grid grid-cols-1 gap-6 md:grid-cols-2">
        {cards.map((c, i) => (
          <div
            key={c.title}
            className={`${i === 0 ? `${B.bg} bg-soft` : 'bg-base-200'} border-base-300 flex flex-col gap-4.5 rounded-xl border p-8`}
          >
            <Text as="h3" size={24} weight={500} className="tracking-[-0.02em]">
              {c.title}
            </Text>
            <Text size={15}>{c.body}</Text>
            <ul className="grid list-none gap-3">
              {c.points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="shrink-0 pt-[7px]">
                    <Dot color={B.color} size={7} />
                  </span>
                  <Text as="span" size={14}>
                    {p}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── HOW IT WORKS · the 5-minute path ──────────────────────────────────────────
function HowItWorks() {
  // Order is carried by the grid, not by an "01/02/03" step marker (RULE #2).
  const steps = [
    {
      title: 'Pick a theme',
      body: "Start from a theme that already looks finished. It's responsive and accessible out of the box, so you're tuning a real site, not assembling one from scratch.",
    },
    {
      title: 'Edit in the browser',
      body: "Drag, drop, and type directly on the page. Swap copy, images, and sections — every change previews exactly as it'll publish, no separate preview mode to second-guess.",
    },
    {
      title: 'Point your domain',
      body: 'Add your custom domain and update one DNS record. Your SSL certificate provisions itself — no separate certificate service, no renewals, no upcharge.',
    },
    {
      title: "Publish — you're live",
      body: 'Hit publish and your site serves from the global CDN, fast everywhere. Edits go live the moment you publish — nothing to clear, nothing to wait on.',
    },
  ];
  return (
    <Section id="how" padding="lg">
      <SectionHeader
        accent={B.color}
        headline="Four steps to live"
        lede="No integration project, no migration weekend. This is the honest path from nothing to a site on your own domain — and it's the same path whether you're publishing a blog or opening a store."
      />
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className={`${i === 0 ? `${B.bg} bg-soft` : 'bg-base-100'} border-base-300 flex min-h-[210px] flex-col gap-3.5 rounded-xl border px-6 pt-7 pb-8`}
          >
            <Text as="h3" size={20} weight={500} className="tracking-[-0.02em]">
              {s.title}
            </Text>
            <Text size={14}>{s.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── CAPABILITIES ──────────────────────────────────────────────────────────────
function Capabilities() {
  const caps = [
    {
      title: 'Theme-first, yours to bend',
      body: 'Begin with a designed theme and change exactly what you want — colors, type, layout, sections. Coherent by default, custom when you decide it should be.',
    },
    {
      title: 'Block editor',
      body: 'Build pages by dragging blocks and editing in place. Every block is responsive and accessible by default — clean markup underneath, no mystery wrappers.',
    },
    {
      title: 'Custom domain + automatic SSL',
      body: 'Bring your own domain and point your DNS. The certificate provisions and renews itself — no separate DNS service, no cert to manage, no extra line on the bill.',
    },
    {
      title: 'Served from the edge',
      body: 'Pages cache on a global CDN, so they load fast wherever your visitors are. Publish once and the new version is live everywhere at the same moment.',
    },
    {
      title: 'Headless when you want it',
      body: 'Keep the data, bring your own front end. The Builder SDK works with Next.js, Remix, and Astro, with TypeScript types generated straight from your schema.',
    },
    {
      title: 'Many sites, one login',
      body: 'Run several sites from a single sparx account — each with its own domain, theme, and module mix. One bill, switched between in a click.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={B.color}
        headline="Everything a real site needs"
        lede="Builder isn't a page widget bolted onto a dashboard. It's the full website layer — the part that renders, hosts, and serves — with the plumbing most tools charge extra for already included."
      />
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {caps.map((c) => (
          <div
            key={c.title}
            className="bg-base-200 border-base-300 flex min-h-[180px] flex-col gap-3.5 rounded-xl border p-7"
          >
            <span
              className={`${B.bg} bg-soft inline-flex size-8 items-center justify-center rounded-lg`}
            >
              <Dot color={B.color} size={9} />
            </span>
            <Text as="h3" size={18} weight={500} className="tracking-[-0.01em]">
              {c.title}
            </Text>
            <Text size={14}>{c.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── CODE OPTIONAL · the escape ladder (docs/47) ───────────────────────────────
function CodeOptional() {
  // `level` is a functional annotation about how much code each rung costs —
  // it sits BELOW the card body, never as a kicker above the heading (RULE #2).
  const rungs = [
    {
      level: 'no code',
      title: 'Pick a component',
      body: "Choose a ready-made section — a hero, a feature card, a stat row — and it's styled, responsive, and consistent with the rest of your site automatically.",
    },
    {
      level: 'no code',
      title: 'Adjust the controls',
      body: 'Open the inspector and tune spacing, color, size, and layout with real controls — bounded so the choices always stay coherent.',
    },
    {
      level: 'light code',
      title: 'Add your own utilities',
      body: "Reach for a class field and apply your own spacing, color, and layout utilities, drawn from your brand's design system — the muscle memory, none of the chaos.",
    },
    {
      level: 'full code',
      title: 'Write the CSS, or go headless',
      body: 'When you want total control, write scoped custom CSS — or take the data headless and build the front end yourself. The escape hatch is always there.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={B.color}
        headline="Start with no code. Drop to as much as you want"
        lede="Builder is no-code by default, but it never traps you there. When you need more control, you take the next step down — and the step after that — without leaving sparx or rebuilding anything. You can go as deep as full code, and you're never locked out of going deeper."
      />
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {rungs.map((r, i) => (
          <div
            key={r.title}
            className={`${i === 0 ? `${B.bg} bg-soft` : 'bg-base-100'} border-base-300 flex min-h-[200px] flex-col gap-3 rounded-xl border px-6 py-7`}
          >
            <Text as="h3" size={18} weight={500} className="tracking-[-0.01em]">
              {r.title}
            </Text>
            <Text size={14} className="flex-1">
              {r.body}
            </Text>
            <Text as="span" size={12} mono className={B.ink}>
              {r.level}
            </Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── BUILT TO LAST · permanence (dark) ─────────────────────────────────────────
function BuiltToLast() {
  const cards = [
    {
      title: 'Own your data',
      body: 'Your content, pages, and records are yours — export the whole thing whenever you want, in formats you can actually use.',
    },
    {
      title: 'Own your site',
      body: 'No proprietary trap. The site you build is yours to keep, move, or take headless — sparx hosts it, it never holds it hostage.',
    },
    {
      title: 'Maintain it yourself',
      body: 'Update copy, swap images, add pages, change the design — all in the no-code editor, no support ticket and no developer required.',
    },
    {
      title: 'No rebuild, no retainer',
      body: 'The site you launch today is the one you grow for years. No replatform every two years, no developer on monthly retainer just to keep the lights on.',
    },
    {
      title: 'Headless anytime',
      body: 'Outgrow the rendered site? Flip to headless and serve the same data through the SDK and API — without recreating a thing.',
    },
    {
      title: 'Enhance as you grow',
      body: 'Turn on more modules — commerce, CMS, CRM, email — and they appear on the same site, the same login, the same bill. The site grows with you.',
    },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[760px]">
        <Display size={56} lineHeight={60}>
          AI builds it. sparx keeps it
          <Spark color={B.color} />
        </Display>
        <Text size={18} className="mt-6 max-w-[640px]">
          Anything can spit out a website in a minute. The hard part is the years after — keeping it
          current, owning it, never being held hostage by the tool that made it. That&rsquo;s the
          part sparx is built for. Fast to start, permanent to keep.
        </Text>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((it) => (
          <div
            key={it.title}
            className="bg-base-200 border-base-300 flex flex-col gap-2.5 rounded-xl border p-6"
          >
            <Text
              as="h3"
              size={16}
              weight={500}
              className="flex items-center gap-2.5 tracking-[-0.01em]"
            >
              <Dot color={B.color} size={8} />
              {it.title}
            </Text>
            <Text size={13}>{it.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── WHAT YOU CAN BUILD · content and/or commerce ──────────────────────────────
function WhatYouCanBuild() {
  const uses = [
    {
      title: 'Portfolio or brochure site',
      body: 'A few sharp pages, your own domain, online in an afternoon — no checkout, no clutter.',
      runs: 'Builder',
    },
    {
      title: 'Blog or publication',
      body: 'Write, format, and publish on a fast, SEO-ready site with media and structured content built in.',
      runs: 'Builder + CMS',
    },
    {
      title: 'Online store',
      body: "Products, cart, checkout, and orders on a hosted site — add selling the day you're ready, not before.",
      runs: 'Builder + Commerce',
    },
    {
      title: 'Booking or service site',
      body: 'Show your work, take inquiries, and let customers schedule — pages and contact, no shopping cart needed.',
      runs: 'Builder + CRM',
    },
    {
      title: 'Headless app',
      body: 'Build your own front end against the SDK and API while sparx runs the data, content, and commerce behind it.',
      runs: 'Builder (SDK) + any module',
    },
    {
      title: 'Agency, multi-site',
      body: 'Stand up and manage many client sites from one login — each its own domain, theme, and module mix.',
      runs: 'Builder × many sites',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={B.color}
        headline="Content, commerce, or both"
        lede="Builder renders the site; the modules you turn on decide what it does. A pure content site with no checkout is just as first-class as a full store — selling is one capability, never the assumption."
      />
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {uses.map((u, i) => (
          <div
            key={u.title}
            className={`${i === 0 ? `${B.bg} bg-soft` : 'bg-base-200'} border-base-300 flex min-h-[200px] flex-col gap-3 rounded-xl border p-7`}
          >
            <Text as="h3" size={17} weight={500} className="tracking-[-0.01em]">
              {u.title}
            </Text>
            <Text size={14} className="flex-1">
              {u.body}
            </Text>
            <Text as="span" size={12} mono>
              {u.runs}
            </Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ─────────────────────────────────────────────────────────────
function BuilderPricing() {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col lg:flex-row ${B.bg} bg-soft border-base-300 items-center justify-between gap-8 rounded-xl border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <Display as="h3" size={56} lineHeight={56}>
              $10
            </Display>
            <Text as="span" size={16}>
              /mo
            </Text>
          </div>
          <Text size={14} className="max-w-[640px]">
            A flat $10/mo. Builder hosts and serves your site — pages, custom domains, SSL, and the
            global CDN, all in. It&rsquo;s a module, not a required base: switch it on when you want
            a hosted sparx site, leave it off and run headless through the API and MCP. One bill
            with everything else, off the moment you stop.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button color="primary" size="lg">
            Activate Builder
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ──────────────────────────────────────────────────────────
function BuilderCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-10">
        <Display size={88} lineHeight={84}>
          Your site, live this afternoon
          <Spark color={B.color} />
        </Display>
        <Text size={18} className="max-w-[640px]">
          Pick a theme, point your domain, publish — no developer, no rebuild looming, no contract.
          The site you start today is yours to keep and grow for years.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xl" variant="solid">
            Start your site →
          </Button>
          <a href="#how">
            <Button size="xl" variant="outline">
              See how it works
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
