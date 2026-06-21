import type { ReactNode } from 'react';
import { Dot, getModuleColor, Section, SectionHeader } from './primitives';

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
 */

const M = getModuleColor('scheduling');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

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
      <SectionHeader
        accent={M.color}
        headline="Four booking shapes, one engine"
        lede="An appointment, a class, a reservation, and a rental aren't four products — they're one booking engine with a type discriminator. The same availability math, the same deposits and reminders, the same reports. Switch on the shapes a business needs; nothing is a separate tool to learn or pay for."
      />
      <div className="mkt-grid-4-2-1" style={{ marginTop: '52px' }}>
        {shapes.map((s) => (
          <div
            key={s.type}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '26px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderTop: `3px solid ${M.color}`,
              borderRadius: '12px',
              minHeight: '236px',
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
              {s.type}
            </span>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: '23px',
                color: 'var(--color-text-primary)',
                fontWeight: 500,
              }}
            >
              {s.what}
            </p>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 11px',
                width: 'fit-content',
                borderRadius: '9999px',
                backgroundColor: M.tint,
                color: M.text,
                fontFamily: MONO,
                fontSize: '11px',
              }}
            >
              {s.capacity}
            </span>
            <span
              style={{
                marginTop: 'auto',
                fontFamily: SANS,
                fontSize: '12.5px',
                lineHeight: '19px',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {s.verticals}
            </span>
          </div>
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
      <SectionHeader
        accent={M.color}
        headline="Deposits stop no-shows — pick the policy per service"
        lede="No-show protection is the single highest-ROI feature in booking. Choose it per service and mix it across your catalog: a free slot here, a deposit there, a card hold for the ones that hurt. When a fee fires, the policy the customer accepted, the reminders sent, and the booking timeline are all on record — the evidence you need, captured automatically."
      />
      <div className="mkt-grid-4-2-1" style={{ marginTop: '52px' }}>
        {ladder.map((p) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '26px',
              backgroundColor: p.emphasis ? M.tint : 'var(--color-bg-surface)',
              border: p.emphasis ? `1px solid ${M.color}` : '1px solid var(--color-border-default)',
              borderRadius: '12px',
              minHeight: '208px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '20px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: p.emphasis ? M.text : 'var(--color-text-primary)',
              }}
            >
              {p.name}
            </h3>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.03em',
                color: p.emphasis ? M.text : 'var(--color-text-tertiary)',
              }}
            >
              {p.tag}
            </span>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {p.body}
            </p>
          </div>
        ))}
      </div>
      <div
        className="mkt-cluster"
        style={{
          marginTop: '24px',
          gap: '10px',
          padding: '16px 20px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '12px',
        }}
      >
        <Dot color={M.color} size={7} />
        <span
          style={{
            fontFamily: SANS,
            fontSize: '13.5px',
            lineHeight: '21px',
            color: 'var(--color-text-secondary)',
          }}
        >
          Deposits need only a connected payment gateway &mdash; Stripe, sparx Pay, PayPal, or
          Square at your own rates. Not the Commerce module, not a locked-in processor. Scheduling
          stays standalone.
        </span>
      </div>
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
      <SectionHeader
        accent={M.color}
        headline="Works with the calendar you already keep"
        lede="No spreadsheet, no copy-paste. Subscribe to your sparx schedule in any calendar, and import the busy time from the calendars you already keep so external commitments block your slots. And whatever a synced feed says, the double-booking guarantee holds at the database — degraded sync never degrades the core promise."
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px' }}>
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
                fontSize: '22px',
                fontWeight: 500,
                letterSpacing: '-0.015em',
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
      <SectionHeader
        accent={M.color}
        headline="One booking, one loop — not five disconnected tools"
        lede="Every scheduling SaaS is an island: the booking is in a booking app, the customer in a CRM, the deposit in a payment tool, the reminder in an SMS tool, and the no-show never updates lifetime value. On sparx it's one loop, because sparx already owns the customer, the money, the messaging, and the site."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {stages.map((s) => (
          <div
            key={s.n}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '11px',
              padding: '26px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
              minHeight: '196px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {s.n}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
              }}
            >
              <Dot color={M.color} size={8} />
              {s.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {s.body}
            </p>
            <span
              style={{
                marginTop: 'auto',
                fontFamily: MONO,
                fontSize: '11px',
                color: M.text,
              }}
            >
              lives in {s.where}
            </span>
          </div>
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
      <SectionHeader
        accent={M.color}
        headline="The same engine, configured for your business"
        lede="A salon, a restaurant, a studio, a clinic, a makerspace, and a fleet shop all run on this one engine. They differ only in which booking shapes and capabilities they switch on — never in which product they had to buy."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {verticals.map((v) => (
          <div
            key={v.name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '26px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '16px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}
              >
                {v.name}
              </h3>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '10.5px',
                  letterSpacing: '0.03em',
                  color: M.text,
                  flexShrink: 0,
                }}
              >
                {v.shape}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {v.note}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
