// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// In a Server Component the `render` element crosses the RSC boundary as a lazy
// client reference whose `.type` is undefined, and silica's cloneElement throws.
import type { ReactNode } from 'react';
import {
  Button,
  Card,
  CardBody,
  Display,
  Heading,
  Stat,
  Stats,
  StatValue,
  Text,
} from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Dot, getModuleColor, Section, SectionHeader, Spark } from './primitives';
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
 * (via @wizeworks/payments), NOT the Commerce module. Calendar is described to its
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
        headline="Complete on its own, better with the rest"
        lede="Scheduling is never bundled and never required by another module — it stands fully on its own. But it lives on the same platform as your customers, your money, and your messaging, so connecting them turns booking into a loop instead of an island."
      />
      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        {panels.map((p) => (
          <Card key={p.title} className="bg-base-100">
            <CardBody className="flex flex-col gap-4">
              <Heading level={6} className={`${M.ink} font-mono`}>
                {p.tag}
              </Heading>
              <Heading level={3}>{p.title}</Heading>
              <Text>{p.body}</Text>
              <ul className="grid list-none gap-3">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-[11px]">
                    <span className="shrink-0 pt-[7px]">
                      <Dot color={M.color} size={7} />
                    </span>
                    <Text as="span">{pt}</Text>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
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
      <div className="max-w-[760px]">
        <Heading level={2}>
          One flat fee, unlimited everything
          <Spark color={M.color} />
        </Heading>
        <Text variant="lead" className="mt-[22px] max-w-[640px]">
          The two things people hate most about booking software — features yanked into higher tiers
          and per-seat pricing that punishes growth — are impossible here by policy. Add the staff,
          add the rooms, add the locations. The price doesn’t move.
        </Text>
      </div>
      {/* `Stats` brings its own dividers and sizing. Below `sm` the blocks stack,
          so the inline-start rule between them becomes a top rule. */}
      <Stats className="mt-14 w-full max-sm:flex-col max-sm:[&>*:not(:first-child)]:border-t max-sm:[&>*:not(:first-child)]:border-l-0">
        {stats.map((s) => (
          <Stat key={s.l}>
            <StatValue>{s.n}</StatValue>
            {/* The label is meant to be read, so it is body `Text` at full ink —
                not `StatDesc`, which is deliberately small and muted. */}
            <Text className="mt-3">{s.l}</Text>
          </Stat>
        ))}
      </Stats>
    </Section>
  );
}

// ── PRICING STRIP ───────────────────────────────────────────────────────────
function SchedulingPricing() {
  return (
    <Section padding="lg">
      <Card>
        <CardBody className="flex flex-col items-center justify-between gap-8 p-10 lg:flex-row">
          <div className="flex flex-1 flex-col gap-3">
            {/* Transparent so the card's module wash reads through the Stats block. */}
            <Stats className="border-0 bg-transparent">
              <Stat className="p-0">
                <StatValue>$29</StatValue>
                <Text as="span">/mo</Text>
              </Stat>
            </Stats>
            <Text className="max-w-[660px]">
              A flat $29/mo — unlimited staff, resources, locations, and bookings, with every
              feature included and nothing ever tier-gated. No per-seat, per-staff, or per-cover
              fee. Requires nothing else; always standalone. The only metered cost is SMS send
              volume. Start free for 14 days; no card to begin.
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/pricing" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
              See all plans →
            </a>
            <Button size="lg" color="primary">
              Activate Scheduling
            </Button>
          </div>
        </CardBody>
      </Card>
    </Section>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
function SchedulingCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display>
          Take your first booking today
          <Spark color={M.color} />
        </Display>
        <Text variant="lead" className="max-w-[640px]">
          Add a service, set your hours, embed the widget — and take a booking that reminds the
          customer, holds a deposit, and writes to their record automatically. No per-seat math, no
          migration weekend. Turn Scheduling off the day you stop, and your bookings stay yours.
        </Text>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="xl" color="module-scheduling">
            Activate Scheduling →
          </Button>
          <a href="#loop" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
            See the whole loop
          </a>
        </div>
      </div>
    </Section>
  );
}
