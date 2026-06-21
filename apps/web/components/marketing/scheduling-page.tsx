import type { ReactNode } from 'react';
import { Button } from '@sparx/ui';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  Section,
  SectionHeader,
  Spark,
} from './primitives';
import { SchedulingHero } from './scheduling-hero';
import {
  SchedulingShapes,
  SchedulingDeposits,
  SchedulingCalendar,
  SchedulingLoop,
  SchedulingVerticals,
} from './scheduling-sections';
import { SchedulingNoOverlap, SchedulingReminders } from './scheduling-devices';
import { Faq, type FaqItem } from './faq';

/**
 * The /scheduling marketing page — Scheduling is "every booking shape, one
 * engine, on the platform that already owns your customer." The thesis is the
 * loop no island scheduler can close: book → remind → take deposit → fulfill →
 * record to the customer → follow up, all in one system. The page walks hero
 * (a confirmed booking, rotating verticals) → the four booking shapes →
 * double-booking-impossible (the DB-level differentiator) → deposits & policies
 * → reminders & waitlists → calendar (honest, shipped scope) → the loop →
 * standalone panel → industry-agnostic vertical strip → dark proof → pricing →
 * FAQ → dark CTA. Scheduling rose is a signal (accent spark, dots, key numbers,
 * the hero tint, card top-stripe) — never flood fill; the hero takes the light
 * rose tint.
 *
 * Bespoke + full-length, modeled on dropship-page.tsx / commerce-page.tsx; the
 * device-heavy sections live in scheduling-hero/-sections/-devices.tsx so each
 * file stays cohesive, with the rotation scenes in scheduling-data.ts.
 *
 * Facts grounded in docs/79 (Scheduling PRD) + docs/17 (billing). Scheduling is
 * a flat $29/mo, requires NOTHING, is ALWAYS standalone (§18.1, §18.3), with
 * unlimited staff/resources/locations/bookings and no feature ever tier-gated;
 * the only metered cost is SMS volume. Deposits need a connected payment gateway
 * (via @sparx/payments), NOT the Commerce module. Calendar is described to its
 * SHIPPED scope only — outbound iCal feed + inbound busy import (iCal URL /
 * CalDAV) — never live two-way OAuth, which is a later enhancement. Double-
 * booking is structurally impossible at the database (§7.4). Industry-agnostic
 * by construction — fleet is ONE vertical of several, never the lens.
 */
export function SchedulingPage() {
  return (
    <>
      <SchedulingHero />
      <SchedulingShapes />
      <SchedulingNoOverlap />
      <SchedulingDeposits />
      <SchedulingReminders />
      <SchedulingCalendar />
      <SchedulingLoop />
      <SchedulingStandalone />
      <SchedulingVerticals />
      <SchedulingProof />
      <SchedulingPricing />
      <Faq
        items={SCHEDULING_FAQ}
        id="faq"
        accent={M.color}
        heading={
          <>
            Scheduling questions
            <Spark color={M.color} />
          </>
        }
        lede="Pricing, deposits, calendars, no-shows, and how it fits the rest of sparx — answered straight. Still deciding? Read the scheduling docs or start the 14-day trial."
      />
      <SchedulingCta />
    </>
  );
}

const M = getModuleColor('scheduling');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// Page-specific FAQ. Real evaluation questions for sparx Scheduling, answered
// straight and grounded in docs/79 (PRD) + docs/17 (billing) — no tier/plan
// language, no claim beyond what ships. Feeds the FAQPage JSON-LD via <Faq>, so
// accuracy is load-bearing.
const SCHEDULING_FAQ: FaqItem[] = [
  {
    id: 'scheduling-pricing',
    question: 'How much does sparx Scheduling cost?',
    answer:
      'A flat $29/mo for unlimited staff, resources, locations, and bookings. No per-seat, no per-staff, and no per-cover fee — the one flat fee beats every per-seat competitor the moment you have more than one person taking bookings. Every feature is included; nothing is ever gated into a higher tier. The only metered cost is SMS send volume, billed as a physical cost like email. Start on a 14-day free trial; no card required to begin.',
  },
  {
    id: 'scheduling-requires',
    question: 'Do I need any other module to use Scheduling?',
    answer:
      'No. Scheduling requires nothing and is always standalone — a salon, a tutor, or a consultant can activate only Scheduling and run their whole booking operation. Taking deposits needs just one thing: a connected payment gateway (Stripe, sparx Pay, PayPal, or Square) at your own rates. That is a platform capability, not the Commerce module.',
  },
  {
    id: 'scheduling-types',
    question: 'What kinds of bookings can I run?',
    answer:
      'Four shapes on one engine: appointments (one slot, one service, capacity one), classes (a capped roster with a waitlist), reservations (a finite resource matched to party size), and rentals (a time-block of an asset for one renter). Recurring series, round-robin and collective team availability, and group bookings all run on the same engine. You switch on the shapes your business needs.',
  },
  {
    id: 'scheduling-double-booking',
    question: 'How do you prevent double-booking?',
    answer:
      'It is impossible by design, not by best effort. Every exclusive resource — a staff member, a table, a room, a bay, a piece of equipment — is protected by a database constraint that refuses two overlapping bookings outright. A racing second request fails cleanly and the customer is offered the next open slot. This holds even when an external calendar feed lags, because the guarantee lives in the database, not in app logic that has to win a race. Intentional overbooking (pooled capacity) is a separate, deliberate setting.',
  },
  {
    id: 'scheduling-calendar',
    question: 'Does it sync with Google, Apple, or Outlook calendars?',
    answer:
      'Yes, in two honest ways. Outbound: every resource gets a private iCal feed you subscribe to once in Google, Apple, or Outlook, plus a per-booking .ics on every confirmation — so your sparx bookings show up in the calendar you already use. Inbound: import the busy time from the calendars you already keep, by secret iCal URL or a CalDAV connection, so outside commitments block your sparx availability. All connected calendars are checked, and a failing feed raises an alert rather than silently going stale.',
  },
  {
    id: 'scheduling-no-shows',
    question: 'How does it protect me from no-shows?',
    answer:
      'Two ways, both first-class. First, a per-service policy: free, a card hold that captures a fee only if someone no-shows or late-cancels, a partial deposit applied to the bill, or full prepay. Second, automated email and SMS reminders on the cadence you set. When a fee fires, the policy the customer accepted, the timestamped reminder log, and the booking timeline are all on record — the evidence you need if you ever contest a chargeback. And if a cancellation does happen, the waitlist auto-promotes the next person before the slot sits empty.',
  },
  {
    id: 'scheduling-customer-record',
    question: 'Where do bookings live — do they connect to my customers?',
    answer:
      'Every booking writes to the customer you already have. Confirmations, no-shows, and preferences land on the CRM customer record or B2B account, so the next visit starts with full history. That is the whole point: the booking, the deposit, the reminder, the visit, and the follow-up are one loop on one platform, not five disconnected tools that never talk to each other.',
  },
  {
    id: 'scheduling-verticals',
    question: 'Is this built for one industry?',
    answer:
      'No — it is industry-agnostic by construction. A salon booking a stylist, a restaurant seating a party, a studio filling a class, a clinic running a recurring series, a makerspace renting a bay, and a fleet shop scheduling a service visit all drive the same engine. They differ only in which booking shapes and capabilities they switch on. Fleet and field service is one well-served context among many, not the assumption.',
  },
];

// ── ALWAYS STANDALONE PANEL ──────────────────────────────────────────────────
function SchedulingStandalone() {
  const panels: { tag: string; title: string; body: string; points: string[] }[] = [
    {
      tag: 'on its own',
      title: 'Standalone from day one',
      body: 'Scheduling is a complete product by itself. Activate only this module, connect a gateway if you want deposits, and run your entire booking operation — no other module required.',
      points: [
        'Unlimited staff, resources, locations, and bookings on one flat fee.',
        'Every feature included — waitlists, recurring, policies, reports.',
        'Embed the booking widget on any site, on your brand, no “Powered by.”',
      ],
    },
    {
      tag: 'better together',
      title: 'Richer with the modules you run',
      body: 'Because it shares the platform, Scheduling gets stronger the more of sparx you use — but it never depends on any of it. Each connection is a bonus, not a requirement.',
      points: [
        'CRM — bookings and no-shows write to the customer record.',
        'Payments — deposits, holds, and refunds at your own rates.',
        'B2B + Inventory — link a booking to an account, asset, parts, work order.',
      ],
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Complete on its own, better with the rest"
        lede="Scheduling is never bundled and never required by another module — it stands fully on its own. But it lives on the same platform as your customers, your money, and your messaging, so connecting them turns booking into a loop instead of an island."
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '24px' }}>
        {panels.map((p) => (
          <div
            key={p.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '32px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderTop: `3px solid ${M.color}`,
              borderRadius: '14px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: M.text,
              }}
            >
              {p.tag}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '24px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
              }}
            >
              {p.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: '24px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {p.body}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
              {p.points.map((pt) => (
                <li key={pt} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                  <span style={{ paddingTop: '7px', flexShrink: 0 }}>
                    <Dot color={M.color} size={7} />
                  </span>
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: '14.5px',
                      lineHeight: '23px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {pt}
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

// ── DARK PROOF ──────────────────────────────────────────────────────────────
function SchedulingProof() {
  const stats: { n: ReactNode; l: string }[] = [
    { n: '$0', l: 'per seat — unlimited staff, resources, and locations on one flat fee' },
    {
      n: <>1{<Spark color={M.color} />}</>,
      l: 'engine — appointments, classes, reservations, and rentals on one record',
    },
    { n: 'DB', l: 'guaranteed — overlapping bookings of a resource can’t commit, ever' },
    { n: 'all', l: 'features included — waitlists, deposits, reminders, reports, sync' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div style={{ maxWidth: '760px' }}>
        <Display size={46} lineHeight={48} color="#FFFFFF">
          One flat fee, unlimited everything
          <Spark color={M.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: '22px 0 0',
          }}
        >
          The two things people hate most about booking software — features yanked into higher tiers
          and per-seat pricing that punishes growth — are impossible here by policy. Add the staff,
          add the rooms, add the locations. The price doesn’t move.
        </p>
      </div>
      <div className="mkt-grid-4-2-1" style={{ marginTop: '56px', gap: 0 }}>
        {stats.map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: i === 0 ? '0' : '0 0 0 32px',
              borderLeft: i === 0 ? 'none' : '1px solid #262626',
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(34px, 5vw, 52px)',
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                marginTop: '12px',
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '22px',
                color: '#A1A1AA',
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ───────────────────────────────────────────────────────────
function SchedulingPricing() {
  return (
    <Section padding="lg">
      <div
        className="mkt-stack-on-tablet"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderTop: `3px solid ${M.color}`,
          borderRadius: '14px',
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
                color: 'var(--color-text-primary)',
              }}
            >
              $29
            </span>
            <span
              style={{ fontFamily: SANS, fontSize: '16px', color: 'var(--color-text-tertiary)' }}
            >
              /mo
            </span>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '22px',
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: '660px',
            }}
          >
            A flat $29/mo — unlimited staff, resources, locations, and bookings, with every feature
            included and nothing ever tier-gated. No per-seat, per-staff, or per-cover fee. Requires
            nothing else; always standalone. The only metered cost is SMS send volume. Start free
            for 14 days; no card to begin.
          </p>
        </div>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
            Activate Scheduling
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
function SchedulingCta() {
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
        style={{ display: 'flex', flexDirection: 'column', gap: '36px', alignItems: 'flex-start' }}
      >
        <Display size={88} lineHeight={84} color="#FFFFFF">
          Take your first booking today
          <Spark color={M.color} />
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
          Add a service, set your hours, embed the widget — and take a booking that reminds the
          customer, holds a deposit, and writes to their record automatically. No per-seat math, no
          migration weekend. Turn Scheduling off the day you stop, and your bookings stay yours.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <Button size="xl" style={{ backgroundColor: M.color }}>
            Activate Scheduling →
          </Button>
          <a href="#loop">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              See the whole loop
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}
