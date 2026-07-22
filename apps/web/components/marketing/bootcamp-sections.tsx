import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Section, SectionHeader, Spark, Text } from './primitives';
import type { FaqItem } from './faq';

/**
 * The /bootcamp static marketing sections (hero, who it's for, format labels, the
 * dark host CTA) + the bootcamp FAQ data. The build arc lives in bootcamp-arc.tsx
 * and the faceted directory in app/bootcamp/_components; the route assembles all
 * of them. Accent = the sparx primary brand color: the bootcamp is a platform
 * program, not the commerce module, so it carries brand indigo (like /partners) —
 * NOT a module hue. The four modules you build wear their own hues inside the arc.
 */

// The bootcamp is a PLATFORM program, not the commerce module — so it wears the
// sparx primary brand color, not a module hue (the /partners page does the same).
const PRIMARY = 'var(--color-primary)';

// ── HERO ────────────────────────────────────────────────────────────────────
export function BootcampHero() {
  const chips = ['site', 'CRM', 'email', 'automation', 'one platform'];
  return (
    // `bg-primary bg-soft` IS the former hand-rolled 15% color-mix tint — silica's
    // own soft treatment, so it follows the theme instead of freezing one value.
    <section className="bg-primary bg-soft px-page pt-[clamp(56px,8vw,104px)] pb-[clamp(72px,10vw,120px)]">
      <Container className="flex flex-col gap-7">
        <div className="max-w-[760px]">
          <Display as="h1" size={88} lineHeight={86}>
            Build your business.
            <br />
            Launch on sparx
            <Spark />
          </Display>
        </div>
        <Text size={19} className="max-w-[600px]">
          In-person and virtual sessions, led by certified sparx partners. Build a real business
          &mdash; site, customers, email, automation &mdash; and graduate the day you hit publish.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#directory">
            <Button size="lg" color="primary">
              Find a bootcamp →
            </Button>
          </a>
          <a href="/partners">
            <Button size="lg" variant="outline">
              Are you a partner? Host one
            </Button>
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-[22px] gap-y-2.5">
          {chips.map((c) => (
            <Text
              key={c}
              as="span"
              mono
              size={12}
              tone="none"
              className="text-primary inline-flex items-center gap-2"
            >
              <span aria-hidden className="bg-primary size-[7px] rounded-full" />
              {c}
            </Text>
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
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {who.map((w) => (
          <div key={w.t}>
            <Text as="h3" size={20} weight={500} tone="default" className="tracking-[-0.02em]">
              {w.t}
            </Text>
            <Text size={15} className="mt-3">
              {w.d}
            </Text>
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
      <div className="mkt-formats mt-13">
        {formats.map((f) => (
          <div key={f.nm} className="px-6 py-7">
            <Text as="div" size={17} weight={500} tone="default" className="tracking-[-0.01em]">
              {f.nm}
            </Text>
            <Text as="div" size={14} className="mt-2">
              {f.ds}
            </Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── HOST CTA (dark) ─────────────────────────────────────────────────────────
export function BootcampHostCta() {
  return (
    // A themed dark island — the whole `--color-base-*` ramp flips, so the ink
    // below resolves on-brand with no `#0A0A0A`/`#FFFFFF`/`#A1A1AA` literals.
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-6">
        <Display size={60} lineHeight={60}>
          Want to host a bootcamp
          <span className="text-primary">?</span>
        </Display>
        <Text size={18} className="max-w-[560px]">
          Certified sparx partners run bootcamps, bring new businesses onto the platform, and earn
          on every one that publishes. Get certified and start hosting.
        </Text>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <a href="/partners">
            <Button size="xl" color="primary">
              Get certified →
            </Button>
          </a>
          <a href="/partners">
            <Button size="xl" variant="outline">
              See the partner program
            </Button>
          </a>
        </div>
        <Text as="span" mono size={12} tone="subtle" className="mt-6">
          Powered by{' '}
          <Text as="span" mono size={12} weight={500}>
            sparx
          </Text>{' '}
          · sparx.works
        </Text>
      </div>
    </Section>
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
