import {
  Badge,
  type BadgeColor,
  Card,
  CardBody,
  Heading,
  List,
  ListColGrow,
  ListRow,
  ListTitle,
  MockupCode,
  MockupCodeLine,
  Text,
  Timeline,
  TimelineEnd,
  TimelineItem,
  TimelineMiddle,
} from '@wizeworks/silicaui-react';
import { Dot, getModuleColor, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { SCHEDULING_SCENES, type SchedulingScene } from './scheduling-data';

/**
 * Two structural devices for the /scheduling page, split out of
 * scheduling-page.tsx:
 *
 *  - SchedulingNoOverlap .. the differentiator: a resource lane holding one
 *    booking, beside a "racing second booking" that the database REJECTS — the
 *    Postgres EXCLUDE constraint (§7.4) made visible. Double-booking isn't
 *    guarded by app logic, it's structurally impossible.
 *  - SchedulingReminders .. the highest-ROI feature (§3.1): a multi-channel
 *    reminder timeline (confirm → 24h → 2h → follow-up) beside the waitlist
 *    auto-promote card, both rotating through verticals.
 *
 * Grounded in docs/79 §7.4 (DB-level no-overlap), §10 (notifications), §5
 * (waitlists, session + service level, auto-promote). Rose is a signal, not
 * fill. (The hero + booking card live in scheduling-hero.tsx; the booking
 * shapes, deposits, calendar, loop, and verticals live in scheduling-sections.tsx.)
 *
 * SILICA-ONLY (see SILICA-VOCABULARY.md): type is `<Heading>` / `<Text>` with no
 * px anywhere, surfaces are `Card`, rows are `List`/`ListRow`, the rejected write
 * is `MockupCode` (already a dark terminal — no `data-theme` island, no zinc
 * hexes), the reminder lifecycle is `Timeline`, and waitlist states are `Badge`.
 * Only the band rhythm (`Section`), the module-class lookup, and `Dot` stay
 * app-local.
 *
 * COLOR: /scheduling is a SINGLE-MODULE surface, so the cards are NEUTRAL — no
 * `bg-module-scheduling bg-soft` wash on the lane, the timeline, or the waitlist.
 * A wall of tinted rectangles differentiates nothing when everything on the page
 * is the same module; identity rides the `<Spark>`, the `<Dot>`s, the module-ink
 * lane label, and the one SOLID module block (the booked slot). Badges are
 * silica's default `solid` too — a status pill is a signal and should read at a
 * glance, not fade into a pale tint.
 *
 * INK: there is no `variant="caption"` in this file. Every label, timing, slot
 * value, and lane row here is content a visitor actually reads, so it is
 * full-ink `<Text>`; the small mono labels that used to be 11–12px muted are
 * `<Heading level={6}>` — small, still full ink. `caption` is reserved for text
 * nobody is meant to read, and nothing on this surface qualifies.
 */

const M = getModuleColor('scheduling');

// ── DOUBLE-BOOKING IS IMPOSSIBLE (DB-level) ─────────────────────────────────
export function SchedulingNoOverlap() {
  return (
    <Section id="no-overlap" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Double-booking is impossible, not unlikely"
        lede="Most tools check for conflicts in code, then hope the check ran before someone else booked. sparx enforces it in the database itself: a resource cannot hold two overlapping bookings at the same time, full stop. A racing second request fails cleanly and is offered the next open slot — even if your calendar sync lags."
      />
      <div className="mt-13 flex flex-col gap-6 lg:flex-row">
        <ResourceLane />
        <RejectedRace />
      </div>
      <Text className="mt-6 max-w-[760px]">
        Enforced by a Postgres exclusion constraint on every exclusive resource &mdash; staff,
        tables, rooms, bays, equipment. Pooled capacity (intentional overbooking) is a separate,
        deliberate setting, never an accident.
      </Text>
    </Section>
  );
}

/** Left: a resource's day lane with one confirmed booking occupying a slot. */
function ResourceLane() {
  const lanes = [
    { t: '12:00', booking: null },
    { t: '1:00', booking: 'Balayage + cut · Nora P.' },
    { t: '2:00', booking: 'held' },
    { t: '3:00', booking: null },
  ];
  return (
    <Card className="min-w-0 flex-1 overflow-hidden">
      <List>
        <ListTitle className="border-base-300 border-b">
          {/* A panel label a visitor reads → a small full-ink `<Heading>`, not a
              muted caption. Silica `Heading` emits no tone class, so the module
              ink utility has nothing to collide with. */}
          <Heading level={6} className={`${M.ink} font-mono`}>
            resource lane · one exclusive booking
          </Heading>
        </ListTitle>
        {lanes.map((l) => {
          const taken = l.booking === 'Balayage + cut · Nora P.';
          return (
            <ListRow key={l.t} className="items-center gap-3.5">
              <Text as="span" className="w-11 shrink-0 font-mono">
                {l.t}
              </Text>
              {taken ? (
                // The ONE signal in an otherwise neutral lane, so it goes SOLID
                // rather than washed: the booked slot is what the whole device is
                // pointing at. `bg-module-scheduling` pairs with its own
                // `-content` ink, so contrast is the token's problem, not a
                // hand-picked pair.
                <ListColGrow
                  className={`${M.bg} text-module-scheduling-content flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5`}
                >
                  <Dot color="var(--color-module-scheduling-content)" size={7} />
                  <Text as="span" className="font-medium">
                    {l.booking}
                  </Text>
                </ListColGrow>
              ) : l.booking === 'held' ? (
                <ListColGrow className="border-base-300 rounded-[10px] border border-dashed px-3.5 py-2.5">
                  <Text as="span" className="font-mono">
                    buffer · held by service settings
                  </Text>
                </ListColGrow>
              ) : (
                <ListColGrow className="px-3.5 py-2.5">
                  <Text as="span" className="font-mono">
                    open
                  </Text>
                </ListColGrow>
              )}
            </ListRow>
          );
        })}
      </List>
    </Card>
  );
}

/**
 * Right: a racing second write hitting the same slot — rejected at the DB.
 *
 * `MockupCode` IS the dark terminal, so the old `data-theme="dark"` island, the
 * `bg-base-100` surface, the padding, and the radius are all gone with it. The
 * rejection stays INSIDE the transcript as a `text-error` line rather than a
 * badge underneath it: the constraint firing is the database's own next line of
 * output, and lifting it out of the gutter breaks the write → refusal read.
 */
function RejectedRace() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <Heading level={6} className="font-mono">
        a second booking races for 1:00 PM
      </Heading>
      <MockupCode>
        <MockupCodeLine prefix=">">INSERT booking_resources</MockupCodeLine>
        <MockupCodeLine prefix=" ">{'  resource = Nora P.'}</MockupCodeLine>
        <MockupCodeLine prefix=" ">{'  range    = [1:00 PM, 3:15 PM)'}</MockupCodeLine>
        <MockupCodeLine prefix="!" className="text-error">
          rejected · no_overlap constraint
        </MockupCodeLine>
      </MockupCode>
      <Text>
        The overlap never commits. The customer is shown the next open time instead of a
        double-booked staff member &mdash; no apology email, no awkward call.
      </Text>
    </div>
  );
}

// ── REMINDERS + WAITLISTS ───────────────────────────────────────────────────
export function SchedulingReminders() {
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Reminders that fill the gaps a no-show leaves"
        lede="Deposits and reminders are the highest-ROI things a booking tool does. sparx sends confirmations, reminders, and follow-ups by email and SMS on the cadence you set — and when someone cancels, the waitlist auto-promotes the next person before the slot ever sits empty."
      />
      {/* See the note in SchedulingNoOverlap: the unlayered `.mkt-*` gap wins. */}
      <div className="mt-13 flex flex-col gap-6 lg:flex-row">
        <Cycle
          items={SCHEDULING_SCENES.map((s) => (
            <ReminderTimeline key={s.ref} scene={s} />
          ))}
        />
        <Cycle
          items={SCHEDULING_SCENES.map((s) => (
            <WaitlistCard key={s.ref} scene={s} />
          ))}
        />
      </div>
    </Section>
  );
}

/** Left: the lifecycle of messages for a booking — confirm → reminders → follow-up. */
function ReminderTimeline({ scene: s }: { scene: SchedulingScene }) {
  const steps: { label: string; meta: string; done: boolean }[] = [
    { label: 'Booking confirmed', meta: 'email + .ics · sent', done: true },
    { label: 'Reminder', meta: s.reminders, done: true },
    { label: '2h reminder', meta: 'SMS · queued', done: false },
    { label: 'Post-visit follow-up', meta: 're-book / review ask', done: false },
  ];
  return (
    <Card className="h-full min-w-0 flex-1">
      <CardBody className="flex flex-col gap-4.5 p-6">
        <div>
          <Heading level={3}>{s.service}</Heading>
          <Text as="span" className="mt-1 block font-mono">
            {s.ref} · {s.customer}
          </Text>
        </div>
        <Timeline>
          {steps.map((step) => (
            <TimelineItem key={step.label}>
              {step.done ? (
                <TimelineMiddle className={M.ink}>
                  <Check size={12} color="currentColor" />
                </TimelineMiddle>
              ) : (
                <TimelineMiddle />
              )}
              <TimelineEnd box className="w-full">
                <Text as="span" className="block font-medium">
                  {step.label}
                </Text>
                <Text as="span" className="block font-mono">
                  {step.meta}
                </Text>
              </TimelineEnd>
            </TimelineItem>
          ))}
        </Timeline>
      </CardBody>
    </Card>
  );
}

/** Right: a session/service waitlist with one slot freeing and the next auto-promoted. */
function WaitlistCard({ scene: s }: { scene: SchedulingScene }) {
  return (
    <Card className="bg-base-100 h-full min-w-0 flex-1 overflow-hidden">
      <div className="border-base-300 bg-base-200 flex items-center justify-between border-b px-5 py-4">
        <Heading level={3}>Waitlist · {s.service}</Heading>
        <Text as="span" className="font-mono">
          {s.slot}
        </Text>
      </div>
      <List>
        <WaitlistRow name={s.customer} state="cancelled" />
        <WaitlistRow name="next in line" state="offered" />
        <WaitlistRow name="holds their place" state="waiting" />
        <ListRow className="items-center gap-[9px]">
          <Dot color={M.color} size={6} />
          <Text as="span" className="font-mono">
            auto-promote · offer held for a window, then rolls on
          </Text>
        </ListRow>
      </List>
    </Card>
  );
}

function WaitlistRow({
  name,
  state,
}: {
  name: string;
  state: 'cancelled' | 'offered' | 'waiting';
}) {
  // State is its own color axis — the label is a semantic `<Badge>`, never a
  // hand-inked span.
  const byState: Record<typeof state, { label: string; color: BadgeColor; strike: boolean }> = {
    cancelled: { label: 'cancelled', color: 'error', strike: true },
    offered: { label: 'offered → promoted', color: 'success', strike: false },
    waiting: { label: 'waiting', color: 'warning', strike: false },
  };
  const s = byState[state];
  return (
    <ListRow className="border-base-200 items-center border-b">
      <ListColGrow className="flex items-center gap-2.5">
        <Dot color={state === 'offered' ? M.color : 'var(--color-base-content)'} size={7} />
        <Text as="span" className={s.strike ? 'line-through' : undefined}>
          {name}
        </Text>
      </ListColGrow>
      <Badge color={s.color} size="sm">
        {s.label}
      </Badge>
    </ListRow>
  );
}

function Check({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
