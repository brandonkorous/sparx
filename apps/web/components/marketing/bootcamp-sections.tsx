import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Section, SectionHeader, Spark } from './primitives';
import type { FaqItem } from './faq';

/**
 * The /bootcamp static marketing sections (hero, who it's for, format labels, the
 * dark host CTA) + the bootcamp FAQ data. The build arc lives in bootcamp-arc.tsx
 * and the faceted directory in app/bootcamp/_components; the route assembles all
 * of them. Accent = the sparx primary brand color: the bootcamp is a platform
 * program, not the commerce module, so it carries brand indigo (like /partners) —
 * NOT a module hue. The four modules you build wear their own hues inside the arc.
 */

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';
// The bootcamp is a PLATFORM program, not the commerce module — so it wears the
// sparx primary brand color, not a module hue (the /partners page does the same).
const PRIMARY = 'var(--color-primary)';
const PRIMARY_TINT = 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))';
const PRIMARY_TEXT = 'var(--color-primary)';

// ── HERO ────────────────────────────────────────────────────────────────────
export function BootcampHero() {
  const chips = ['site', 'CRM', 'email', 'automation', 'one platform'];
  return (
    <section
      style={{
        backgroundColor: PRIMARY_TINT,
        paddingTop: 'clamp(56px, 8vw, 104px)',
        paddingBottom: 'clamp(72px, 10vw, 120px)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div style={{ maxWidth: '760px' }}>
          <Display as="h1" size={88} lineHeight={86}>
            Build your business.
            <br />
            Launch on sparx
            <Spark />
          </Display>
        </div>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 'clamp(17px, 1.7vw, 20px)',
            lineHeight: 1.55,
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            maxWidth: '600px',
            margin: 0,
          }}
        >
          In-person and virtual sessions, led by certified sparx partners. Build a real business
          &mdash; site, customers, email, automation &mdash; and graduate the day you hit publish.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="#directory">
            <Button size="lg" color="primary">
              Find a bootcamp →
            </Button>
          </a>
          <a href="/partners">
            <Button
              size="lg"
              variant="outline"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'color-mix(in oklab, var(--color-base-content) 30%, transparent)',
                color: 'var(--color-base-content)',
              }}
            >
              Are you a partner? Host one
            </Button>
          </a>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 22px',
            marginTop: '12px',
            fontFamily: MONO,
            fontSize: '12.5px',
            color: PRIMARY_TEXT,
          }}
        >
          {chips.map((c) => (
            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: PRIMARY }} />
              {c}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ── WHO IT'S FOR · profile ledger ───────────────────────────────────────────
export function BootcampWhoFor() {
  const who = [
    {
      t: 'You have an idea',
      d: 'A product, a service, a shop in your head — and you need the structure to turn it into something real and live.',
    },
    {
      t: "You're early-stage",
      d: 'A young startup that wants to move fast without gluing together five subscriptions to get off the ground.',
    },
    {
      t: "You're consolidating",
      d: "A running business tired of paying for a store, a CRM, and an email tool that don't talk to each other. One platform, one bill.",
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={PRIMARY}
        headline={<>Who it&rsquo;s for</>}
        lede="You don't need a business degree or a developer. You need an afternoon and something you want to build."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {who.map((w) => (
          <div key={w.t}>
            <span
              style={{
                display: 'block',
                height: 3,
                width: 44,
                borderRadius: 2,
                backgroundColor: PRIMARY,
              }}
            />
            <h3
              style={{
                margin: '20px 0 0',
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '20px',
                letterSpacing: '-0.02em',
              }}
            >
              {w.t}
            </h3>
            <p
              style={{
                margin: '12px 0 0',
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: '24px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {w.d}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── FORMAT LABELS · hairline strip ──────────────────────────────────────────
export function BootcampFormats() {
  const formats = [
    {
      nm: 'In-person cohort',
      ds: 'A room, a whiteboard, and a group building together over a few days.',
    },
    { nm: 'Virtual · live', ds: 'Live online sessions you join from anywhere, screen-to-screen.' },
    { nm: 'Hybrid', ds: 'Kick off in person, finish the build on your own with live check-ins.' },
    { nm: 'Async · self-paced', ds: 'A cohort on your schedule — work through it week by week.' },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={PRIMARY}
        headline={<>Every format</>}
        lede="Hosted the way that fits your week. Filter the directory below by the one you want."
      />
      <div className="mkt-formats" style={{ marginTop: '52px' }}>
        {formats.map((f) => (
          <div key={f.nm} style={{ padding: '28px 24px' }}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '17px',
                letterSpacing: '-0.01em',
              }}
            >
              {f.nm}
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '20px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                marginTop: '8px',
              }}
            >
              {f.ds}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── HOST CTA (dark) ─────────────────────────────────────────────────────────
export function BootcampHostCta() {
  return (
    <section
      style={{
        backgroundColor: '#0A0A0A',
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'flex-start' }}
      >
        <Display size={60} lineHeight={60} color="#FFFFFF">
          Want to host a bootcamp
          <span style={{ color: PRIMARY }}>?</span>
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: 1.6,
            color: '#A1A1AA',
            maxWidth: '560px',
            margin: 0,
          }}
        >
          Certified sparx partners run bootcamps, bring new businesses onto the platform, and earn
          on every one that publishes. Get certified and start hosting.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px', marginTop: '10px' }}>
          <a href="/partners">
            <Button size="xl" color="primary">
              Get certified →
            </Button>
          </a>
          <a href="/partners">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              See the partner program
            </Button>
          </a>
        </div>
        <span style={{ marginTop: '24px', fontFamily: MONO, fontSize: '12px', color: '#52525B' }}>
          Powered by <span style={{ color: '#A1A1AA', fontWeight: 500 }}>sparx</span> · sparx.works
        </span>
      </Container>
    </section>
  );
}

// Bootcamp-specific FAQ (docs/114 §B.5 + bootcamp-spec). Grounded: 14-day free
// trial, certified-partner-hosted, on-platform RSVP → host CRM (with an external
// escape hatch), format options. Emitted as FAQPage JSON-LD by <Faq>.
export const BOOTCAMP_FAQ: FaqItem[] = [
  {
    id: 'b-what',
    question: 'What is the Business OS Bootcamp?',
    answer:
      'It’s a hands-on program, led by certified sparx partners, where you build a real business on one platform — site, CRM, email, and an automation layer — over a cohort. You build it piece by piece, and the graduation moment is hitting publish and going live.',
  },
  {
    id: 'b-cost',
    question: 'Do I have to pay for sparx during the bootcamp?',
    answer:
      'sparx starts with a 14-day free trial, so you can dive straight into building during the bootcamp at no cost. After the trial, sparx is a paid subscription — and you only pay for the modules you actually switch on. The bootcamp session itself is priced separately by the hosting partner; some are free, some are paid, and each listing shows its price.',
  },
  {
    id: 'b-who',
    question: 'Who runs the bootcamps?',
    answer:
      'Certified sparx partners — consultants, agencies, and developers who’ve been through the certification process. Every listing shows the host and their tier badge, and certified partners appear higher in the directory. sparx provides the platform; the partner provides the teaching.',
  },
  {
    id: 'b-online',
    question: 'Are there online options?',
    answer:
      'Yes. Bootcamps run in four formats — in-person cohort, virtual (live online), hybrid, and async (self-paced). Filter the directory by format and location to find one that fits, whether you want a room to show up to or a cohort you join from anywhere.',
  },
  {
    id: 'b-register',
    question: 'What happens after I register?',
    answer:
      'For bootcamps with on-platform registration, your RSVP goes straight to the hosting partner — it creates a lead in their CRM and reserves your seat, and they follow up with the details. Some hosts use an external registration link (Eventbrite, Luma, or a form) instead; either way the listing shows exactly how to sign up.',
  },
  {
    id: 'b-host',
    question: 'I want to host a bootcamp — how?',
    answer:
      'Hosting is a certified-partner capability. Join the sparx Partner Program and reach the Certified tier to create and publish bootcamp listings on sparx.works/bootcamp. Registered partners can build listings too, but only Certified partners publish them publicly.',
  },
];
