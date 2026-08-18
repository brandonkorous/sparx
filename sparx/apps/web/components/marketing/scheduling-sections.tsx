import type { ReactNode } from 'react';
import { Alert, Badge, Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';
import { Dot, getModuleColor, Section, Spark } from './primitives';

/**
 * The core capability devices for the /scheduling page, split out of
 * scheduling-page.tsx:
 *
 *  - SchedulingShapes ... the four booking shapes (appointment / class /
 *    reservation / rental) as one engine, a 4-up matrix keyed by the
 *    `bookingType` discriminator — capacity model + example verticals each.
 *  - SchedulingDeposits . the Tock-style per-service policy ladder
 *    (free → card hold → deposit → prepay) as a comparison panel, honest about
 *    the one requirement: a connected payment gateway, never the Commerce module.
 *  - SchedulingCalendar . the calendar device, scoped to what SHIPS: an outbound
 *    iCal feed you subscribe to, plus inbound busy import by iCal URL / CalDAV.
 *    No two-way OAuth claim.
 *  - SchedulingLoop ..... the connective-tissue rail — book → remind → deposit →
 *    fulfill → record → follow-up — each step landing in a real sparx module.
 *  - SchedulingVerticals  same engine, configured: six verticals as proof of the
 *    industry-agnostic claim.
 *
 * Grounded in docs/79 §5 (unified model), §9.1–9.2 (deposits/policies), §8.1–8.2
 * (the shipped calendar scope), §2 (the all-in-one loop), §12 (vertical
 * playbooks). Rose is a signal, not fill. (The hero lives in scheduling-hero.tsx;
 * the no-overlap + reminder/waitlist devices live in scheduling-devices.tsx.)
 *
 * 100% SILICA: type is `Heading`/`Text` (semantic steps, no px anywhere), panels
 * are `Card`/`CardBody`/`CardTitle`, every chip is a `Badge`, the gateway notice
 * is an `Alert`, and module identity rides `M.bg`/`M.ink` literals. `Section`,
 * `Spark`, and `Dot` stay app-local — they carry the marketing band rhythm and
 * the brand accent, not appearance silica already owns. No inline `style`, no
 * hand-rolled color-mix, no faded ink: every string here is meant to be read, so
 * every string is full-ink `<Text>` rather than a shrunk-and-dimmed caption.
 */

const M = getModuleColor('scheduling');

// ── THE FOUR BOOKING SHAPES (one engine) ────────────────────────────────────
export function SchedulingShapes() {
  const shapes: { type: string; what: string; capacity: string; verticals: string }[] = [
    {
      type: 'appointment',
      what: 'One slot of one service with one or more resources.',
      capacity: 'capacity 1',
      verticals: 'salon · clinic · tutor · mechanic · law',
    },
    {
      type: 'class',
      what: 'A scheduled session with a capped roster and a waitlist.',
      capacity: 'capacity N + waitlist',
      verticals: 'fitness · workshops · cohorts',
    },
    {
      type: 'reservation',
      what: 'A time-block on a finite resource matched to party size.',
      capacity: 'by resource',
      verticals: 'restaurants · venues · tours',
    },
    {
      type: 'rental',
      what: 'A time-block allocation of an asset to one renter.',
      capacity: '1 per asset',
      verticals: 'rooms · bays · courts · equipment',
    },
  ];
  return (
    <Section id="shapes" surface="surface" padding="lg">
      <div className="flex flex-col items-start gap-6">
        <Heading level={2} className="max-w-[960px]">
          Four booking shapes, one engine
          <Spark color={M.color} />
        </Heading>
        <Text variant="lead" className="max-w-[640px] pt-2">
          An appointment, a class, a reservation, and a rental aren&apos;t four products —
          they&apos;re one booking engine with a type discriminator. The same availability math, the
          same deposits and reminders, the same reports. Switch on the shapes a business needs;
          nothing is a separate tool to learn or pay for.
        </Text>
      </div>
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {shapes.map((s) => (
          <Card key={s.type} className="bg-base-100">
            <CardBody className="flex min-h-[236px] flex-col gap-3.5">
              <CardTitle className={M.ink}>{s.type}</CardTitle>
              <Text>{s.what}</Text>
              <Badge color="module-scheduling" size="sm" className="w-fit gap-2 font-mono">
                {s.capacity}
              </Badge>
              <Text as="span" className="mt-auto">
                {s.verticals}
              </Text>
            </CardBody>
          </Card>
        ))}
      </div>
    </Section>
  );
}

// ── DEPOSITS & POLICIES (the Tock-style ladder) ─────────────────────────────
export function SchedulingDeposits() {
  const ladder: { name: string; tag: string; body: string; emphasis: boolean }[] = [
    {
      name: 'Free',
      tag: 'no payment',
      body: 'Book with nothing held — for low-stakes slots where a no-show costs little.',
      emphasis: false,
    },
    {
      name: 'Card hold',
      tag: 'authorize, capture only on no-show',
      body: 'Authorize a card at booking; capture a no-show or late-cancel fee only if the policy fires, then auto-void the hold.',
      emphasis: true,
    },
    {
      name: 'Deposit',
      tag: 'partial now, applied to the bill',
      body: 'Capture a fixed amount or a percentage up front and apply it to the final total.',
      emphasis: true,
    },
    {
      name: 'Prepay',
      tag: 'full price now',
      body: 'Take the full service price at booking — the strongest commitment, ideal for classes and rentals.',
      emphasis: false,
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <div className="flex flex-col items-start gap-6">
        <Heading level={2} className="max-w-[960px]">
          Deposits stop no-shows — pick the policy per service
          <Spark color={M.color} />
        </Heading>
        <Text variant="lead" className="max-w-[640px] pt-2">
          No-show protection is the single highest-ROI feature in booking. Choose it per service and
          mix it across your catalog: a free slot here, a deposit there, a card hold for the ones
          that hurt. When a fee fires, the policy the customer accepted, the reminders sent, and the
          booking timeline are all on record — the evidence you need, captured automatically.
        </Text>
      </div>
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ladder.map((p) => (
          <Card
            key={p.name}
            className={p.emphasis ? 'bg-base-100 border-module-scheduling' : 'bg-base-100'}
          >
            <CardBody className="flex min-h-[208px] flex-col gap-3">
              <CardTitle className={p.emphasis ? M.ink : undefined}>{p.name}</CardTitle>
              <Text as="span" className="font-mono">
                {p.tag}
              </Text>
              <Text>{p.body}</Text>
            </CardBody>
          </Card>
        ))}
      </div>
      <Alert color="info" className="mt-6">
        Deposits need only a connected payment gateway &mdash; Stripe, sparx Pay, PayPal, or Square
        at your own rates. Not the Commerce module, not a locked-in processor. Scheduling stays
        standalone.
      </Alert>
    </Section>
  );
}

// ── CALENDAR (honest, shipped scope) ────────────────────────────────────────
export function SchedulingCalendar() {
  const panels: { tag: string; title: string; body: string; points: string[] }[] = [
    {
      tag: 'outbound',
      title: 'Subscribe to your schedule, anywhere',
      body: 'Every resource gets a private, signed iCal feed. Add it once to Google, Apple, or Outlook and your sparx bookings appear in the calendar you already live in.',
      points: [
        'One subscribe URL per staff member or resource.',
        'A per-booking .ics rides on every confirmation and reminder.',
        'Read-only and one-way — your bookings flow out to their calendar.',
      ],
    },
    {
      tag: 'inbound',
      title: 'Import the busy time you already keep',
      body: 'Point sparx at the calendars where your outside commitments live — by secret iCal URL or a CalDAV connection — and that busy time blocks your sparx availability so nothing books over it.',
      points: [
        'Pull external busy blocks from an iCal URL or CalDAV.',
        'All connected calendars are checked, never just a primary.',
        'A failing feed raises an alert and falls back to sparx-only data.',
      ],
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <div className="flex flex-col items-start gap-6">
        <Heading level={2} className="max-w-[960px]">
          Works with the calendar you already keep
          <Spark color={M.color} />
        </Heading>
        <Text variant="lead" className="max-w-[640px] pt-2">
          No spreadsheet, no copy-paste. Subscribe to your sparx schedule in any calendar, and
          import the busy time from the calendars you already keep so external commitments block
          your slots. And whatever a synced feed says, the double-booking guarantee holds at the
          database — degraded sync never degrades the core promise.
        </Text>
      </div>
      <div className="mt-13 grid grid-cols-1 gap-6 md:grid-cols-2">
        {panels.map((p) => (
          <Card key={p.title} className="bg-base-100">
            <CardBody className="flex flex-col gap-4">
              <Badge color="module-scheduling" size="sm" className="w-fit gap-2 font-mono">
                {p.tag}
              </Badge>
              <CardTitle>{p.title}</CardTitle>
              <Text>{p.body}</Text>
              <ul className="grid list-none gap-3">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-[11px]">
                    <span className="shrink-0 pt-[9px]">
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

// ── THE LOOP (connective tissue) ────────────────────────────────────────────
export function SchedulingLoop() {
  const stages: { n: string; title: string; body: string; where: string }[] = [
    {
      n: '01 · book',
      title: 'A slot is booked',
      body: 'From your branded site, the customer portal, the phone, or an AI assistant — every channel hits one engine.',
      where: 'Scheduling',
    },
    {
      n: '02 · remind',
      title: 'Confirmations & reminders go out',
      body: 'Email and SMS on your cadence, deduped and logged — the same pipeline your other sends already use.',
      where: 'Email + SMS',
    },
    {
      n: '03 · deposit',
      title: 'A deposit or hold is taken',
      body: 'Through your own connected gateway at your own rates — held, captured, or refunded by policy.',
      where: 'Payments',
    },
    {
      n: '04 · fulfill',
      title: 'The visit happens',
      body: 'Check in, complete, no-show, or reschedule — every state captured on the booking timeline.',
      where: 'Scheduling',
    },
    {
      n: '05 · record',
      title: 'It writes to the customer',
      body: 'Every booking and no-show is tied to the customer record or B2B account it belongs to.',
      where: 'CRM',
    },
    {
      n: '06 · follow up',
      title: 'The win-back fires',
      body: 'A re-book nudge or review ask runs on its own — turning one visit into the next.',
      where: 'Automation',
    },
  ];
  return (
    <Section id="loop" padding="lg">
      <div className="flex flex-col items-start gap-6">
        <Heading level={2} className="max-w-[960px]">
          One booking, one loop — not five disconnected tools
          <Spark color={M.color} />
        </Heading>
        <Text variant="lead" className="max-w-[640px] pt-2">
          Every scheduling SaaS is an island: the booking is in a booking app, the customer in a
          CRM, the deposit in a payment tool, the reminder in an SMS tool, and the no-show never
          updates lifetime value. On sparx it&apos;s one loop, because sparx already owns the
          customer, the money, the messaging, and the site.
        </Text>
      </div>
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((s) => (
          <Card key={s.n} className="bg-base-100">
            <CardBody className="flex min-h-[196px] flex-col gap-3">
              <Badge color="module-scheduling" size="sm" className="w-fit gap-2 font-mono">
                {s.n}
              </Badge>
              <CardTitle className="flex items-center gap-2.5">
                <Dot color={M.color} size={8} />
                {s.title}
              </CardTitle>
              <Text>{s.body}</Text>
              <Text as="span" className={`${M.ink} mt-auto font-mono`}>
                lives in {s.where}
              </Text>
            </CardBody>
          </Card>
        ))}
      </div>
    </Section>
  );
}

// ── INDUSTRY-AGNOSTIC VERTICAL STRIP ────────────────────────────────────────
export function SchedulingVerticals() {
  const verticals: { name: string; shape: string; note: ReactNode }[] = [
    {
      name: 'Salons & studios',
      shape: 'appointment',
      note: 'Customer picks the stylist, leaves a deposit, and books in seconds.',
    },
    {
      name: 'Restaurants',
      shape: 'reservation',
      note: 'Tables matched to party size, reservations by the slot — and no per-cover fee, ever.',
    },
    {
      name: 'Fitness & classes',
      shape: 'class',
      note: 'Capped rosters, waitlist auto-promote, and auto-generated recurring class schedules.',
    },
    {
      name: 'Clinics & practitioners',
      shape: 'appointment',
      note: 'Recurring series, reminders on the cadence you set, and bookings on the patient’s record.',
    },
    {
      name: 'Rentals & spaces',
      shape: 'rental',
      note: 'Rooms, bays, courts, and equipment booked by the block — one renter per asset.',
    },
    {
      name: 'Field & fleet service',
      shape: 'appointment',
      note: 'Bookings linked to a B2B account and a fleet vehicle, with the visit on the account’s history.',
    },
  ];
  return (
    <Section padding="lg">
      <div className="flex flex-col items-start gap-6">
        <Heading level={2} className="max-w-[960px]">
          The same engine, configured for your business
          <Spark color={M.color} />
        </Heading>
        <Text variant="lead" className="max-w-[640px] pt-2">
          A salon, a restaurant, a studio, a clinic, a makerspace, and a fleet shop all run on this
          one engine. They differ only in which booking shapes and capabilities they switch on —
          never in which product they had to buy.
        </Text>
      </div>
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {verticals.map((v) => (
          <Card key={v.name} className="bg-base-100">
            <CardBody className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{v.name}</CardTitle>
                <Badge color="module-scheduling" size="sm" className="shrink-0 gap-2 font-mono">
                  {v.shape}
                </Badge>
              </div>
              <Text>{v.note}</Text>
            </CardBody>
          </Card>
        ))}
      </div>
    </Section>
  );
}
