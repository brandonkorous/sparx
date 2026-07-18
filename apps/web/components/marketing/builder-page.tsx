import { Button } from '@wizeworks/silicaui-react';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  Section,
  SectionHeader,
  Spark,
} from './primitives';

/**
 * The /builder marketing page. Builder is the **website module** — the one
 * module that renders, hosts, and serves a public site. The story is the
 * two-promise arc: **live in 5 minutes** (the on-ramp) AND **built to last**
 * (permanence — "AI builds it. sparx keeps it."; you own the data and the site,
 * maintain it yourself for years, no rebuild). Bespoke + full-length, modeled on
 * ai-page.tsx; Builder's accent is the indigo platform color.
 *
 * Selling is kept optional throughout (content AND/OR commerce). No invented
 * metrics or customers. The "code optional" escape ladder is grounded in
 * docs/47-class-first-authoring-model.md. All copy is rendered from string
 * consts so there are no JSX-entity escapes to manage.
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
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

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
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-base-200)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '1100px' }}>
          <Display as="h1" size={96} lineHeight={90}>
            Your site,
          </Display>
          <Display as="h1" size={96} lineHeight={90}>
            live in 5 minutes
            <Spark color={B.color} />
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
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              maxWidth: '640px',
              margin: 0,
            }}
          >
            {lede}
          </p>

          <div className="mkt-cluster" style={{ gap: '12px' }}>
            <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
              Start your site →
            </Button>
            <a href="#how">
              <Button size="lg" variant="outline">
                See how it works
              </Button>
            </a>
          </div>
        </div>

        <ul
          className="mkt-cluster"
          style={{ gap: '10px 12px', listStyle: 'none', margin: 0, padding: 0 }}
        >
          {chips.map((c) => (
            <li
              key={c}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 13px',
                backgroundColor: 'var(--color-base-100)',
                border: '1px solid var(--color-base-300)',
                borderRadius: '9999px',
              }}
            >
              <Dot color={B.color} size={6} />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '12px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                }}
              >
                {c}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

// ── THE ARC · live in 5 minutes AND built to last ─────────────────────────────
function TheArc() {
  const cards: { kicker: string; title: string; body: string; points: string[] }[] = [
    {
      kicker: 'the on-ramp',
      title: 'Live in 5 minutes',
      body: 'Pick a theme, change the parts that matter, point your domain, publish. No app store, no Zapier, no waiting on a developer to get a real site online.',
      points: [
        'Start from a polished theme, not a blank page',
        'Edit blocks right in the browser — see it as you type',
        'Custom domain and SSL provision themselves',
      ],
    },
    {
      kicker: 'the payoff',
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
      <div style={{ maxWidth: '760px' }}>
        <SectionHeader
          accent={B.color}
          headline="Fast to start. Permanent to keep"
          lede="Most site tools make you choose: quick and disposable, or powerful and painful. Builder is both ends at once. You're live the first afternoon — and the site you stand up today is the one you still run in five years, no rebuild, no developer on retainer."
        />
      </div>
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '24px' }}>
        {cards.map((c, i) => (
          <div
            key={c.title}
            className={i === 0 ? `${B.bg} bg-soft` : 'bg-base-200'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              padding: '32px',
              border: '1px solid var(--color-base-300)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span
                className={B.ink}
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {c.kicker}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '24px',
                  letterSpacing: '-0.02em',
                  color: 'var(--color-base-content)',
                }}
              >
                {c.title}
              </h3>
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: '24px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {c.body}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
              {c.points.map((p) => (
                <li key={p} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                  <span style={{ paddingTop: '7px', flexShrink: 0 }}>
                    <Dot color={B.color} size={7} />
                  </span>
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: '14.5px',
                      lineHeight: '23px',
                      color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                    }}
                  >
                    {p}
                  </span>
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
  const steps = [
    {
      n: '01',
      title: 'Pick a theme',
      body: "Start from a theme that already looks finished. It's responsive and accessible out of the box, so you're tuning a real site, not assembling one from scratch.",
    },
    {
      n: '02',
      title: 'Edit in the browser',
      body: "Drag, drop, and type directly on the page. Swap copy, images, and sections — every change previews exactly as it'll publish, no separate preview mode to second-guess.",
    },
    {
      n: '03',
      title: 'Point your domain',
      body: 'Add your custom domain and update one DNS record. Your SSL certificate provisions itself — no separate certificate service, no renewals, no upcharge.',
    },
    {
      n: '04',
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
      <div className="mkt-grid-4-2-1" style={{ marginTop: '52px' }}>
        {steps.map((s, i) => (
          <div
            key={s.n}
            className={i === 0 ? `${B.bg} bg-soft` : 'bg-base-100'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '30px 26px 34px',
              border: '1px solid var(--color-base-300)',
              borderRadius: '12px',
              minHeight: '210px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '12px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {s.n}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '20px',
                letterSpacing: '-0.02em',
                color: 'var(--color-base-content)',
              }}
            >
              {s.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '23px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {s.body}
            </p>
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
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {caps.map((c) => (
          <div
            key={c.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '28px',
              backgroundColor: 'var(--color-base-200)',
              border: '1px solid var(--color-base-300)',
              borderRadius: '12px',
              minHeight: '180px',
            }}
          >
            <span
              className={`${B.bg} bg-soft`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '8px',
              }}
            >
              <Dot color={B.color} size={9} />
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '18px',
                letterSpacing: '-0.01em',
                color: 'var(--color-base-content)',
              }}
            >
              {c.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '14px',
                lineHeight: '22px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── CODE OPTIONAL · the escape ladder (docs/47) ───────────────────────────────
function CodeOptional() {
  const rungs = [
    {
      tag: '01 · no code',
      title: 'Pick a component',
      body: "Choose a ready-made section — a hero, a feature card, a stat row — and it's styled, responsive, and consistent with the rest of your site automatically.",
    },
    {
      tag: '02 · no code',
      title: 'Adjust the controls',
      body: 'Open the inspector and tune spacing, color, size, and layout with real controls — bounded so the choices always stay coherent.',
    },
    {
      tag: '03 · light code',
      title: 'Add your own utilities',
      body: "Reach for a class field and apply your own spacing, color, and layout utilities, drawn from your brand's design system — the muscle memory, none of the chaos.",
    },
    {
      tag: '04 · full code',
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
      <div className="mkt-grid-4-2-1" style={{ marginTop: '52px' }}>
        {rungs.map((r, i) => (
          <div
            key={r.tag}
            className={i === 0 ? `${B.bg} bg-soft` : 'bg-base-100'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '28px 24px',
              border: '1px solid var(--color-base-300)',
              borderRadius: '12px',
              minHeight: '200px',
            }}
          >
            <span
              className={B.ink}
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {r.tag}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '18px',
                letterSpacing: '-0.01em',
                color: 'var(--color-base-content)',
              }}
            >
              {r.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '14px',
                lineHeight: '22px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {r.body}
            </p>
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
      <div style={{ maxWidth: '760px' }}>
        <Display size={56} lineHeight={60} color="#FFFFFF">
          AI builds it. sparx keeps it
          <Spark color={B.color} />
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
          Anything can spit out a website in a minute. The hard part is the years after — keeping it
          current, owning it, never being held hostage by the tool that made it. That&rsquo;s the
          part sparx is built for. Fast to start, permanent to keep.
        </p>
      </div>
      <div className="mkt-grid-3-2-1" style={{ marginTop: '56px' }}>
        {cards.map((it) => (
          <div
            key={it.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '24px',
              backgroundColor: '#141414',
              border: '1px solid #262626',
              borderRadius: '12px',
            }}
          >
            <h3
              style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '16px',
                letterSpacing: '-0.01em',
                color: '#FFFFFF',
              }}
            >
              <Dot color={B.color} size={8} />
              {it.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: '#A1A1AA',
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
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {uses.map((u, i) => (
          <div
            key={u.title}
            className={i === 0 ? `${B.bg} bg-soft` : 'bg-base-200'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '28px 26px',
              border: '1px solid var(--color-base-300)',
              borderRadius: '12px',
              minHeight: '200px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '17px',
                letterSpacing: '-0.01em',
                color: 'var(--color-base-content)',
              }}
            >
              {u.title}
            </h3>
            <p
              style={{
                margin: 0,
                flex: 1,
                fontFamily: SANS,
                fontSize: '14px',
                lineHeight: '22px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {u.body}
            </p>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '12px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {u.runs}
            </span>
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
        className={`mkt-stack-on-tablet ${B.bg} bg-soft`}
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px',
          border: '1px solid var(--color-base-300)',
          borderRadius: '12px',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '56px',
                letterSpacing: '-0.025em',
                color: 'var(--color-base-content)',
              }}
            >
              $10
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '16px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              /mo
            </span>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '22px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              margin: 0,
              maxWidth: '640px',
            }}
          >
            A flat $10/mo. Builder hosts and serves your site — pages, custom domains, SSL, and the
            global CDN, all in. It&rsquo;s a module, not a required base: switch it on when you want
            a hosted sparx site, leave it off and run headless through the API and MCP. One bill
            with everything else, off the moment you stop.
          </p>
        </div>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
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
    <section
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'flex-start' }}
      >
        <Display size={88} lineHeight={84} color="#FFFFFF">
          Your site, live this afternoon
          <Spark color={B.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: 0,
          }}
        >
          Pick a theme, point your domain, publish — no developer, no rebuild looming, no contract.
          The site you start today is yours to keep and grow for years.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <Button size="xl" variant="solid">
            Start your site →
          </Button>
          <a href="#how">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              See how it works
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}
