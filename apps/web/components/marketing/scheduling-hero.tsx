import {
  Badge,
  Button,
  Card,
  Display,
  Divider,
  Heading,
  List,
  ListColGrow,
  ListRow,
  Text,
} from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as `render` crosses the
// Server→Client boundary and arrives as a lazy client reference, so its `.type`
// is undefined and silica's `cloneElement(render, …)` throws. The class builders
// are React-free; import them from `/server` because the ROOT is 'use client'.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Container, Dot, getModuleColor, Spark } from './primitives';
import { Cycle } from './cycle';
import { SCHEDULING_SCENES, type SchedulingScene } from './scheduling-data';

/**
 * The /scheduling hero — a rose-tinted split: copy on the left, the marquee
 * CONFIRMED-BOOKING card on the right. The card crossfades through
 * SCHEDULING_SCENES so Scheduling reads as the engine for ANY business — salon,
 * fitness studio, restaurant, clinic, makerspace rental, fleet shop — never
 * anchored on one vertical. Every scene has the same shape (service + resource +
 * slot, the deposit taken, the reminder cadence, a capacity note) so the card
 * never reflows as it rotates.
 *
 * Grounded in docs/79: the unified booking model (§5), the per-service policy
 * model (§9.2), multi-channel reminders (§10). Rose is a signal, not fill; the
 * band is silica's own `bg-soft` wash over the Scheduling hue, with real ink.
 * See the rotation rule + feedback-industry-agnostic-no-diesel.
 *
 * Typography is silica's semantic scale end to end — Display / Text lead / Text,
 * with Heading level={6} for the field-NAME half of a label/value pair. No px
 * sizes and no app-local ink tones. Nothing here is `variant="caption"`: every
 * line in the booking card is content a visitor actually reads, and muted ink is
 * reserved for text that isn't. See SILICA-VOCABULARY.md.
 */

const M = getModuleColor('scheduling');

export function SchedulingHero() {
  const lede =
    'Appointments, classes, reservations, and rentals run on one booking engine — with deposits, reminders, waitlists, and policies built in. Because it lives on sparx, every booking writes to the customer you already have: the deposit, the reminder, the no-show, the re-book all land in one system, not five disconnected tools.';
  const chips = ['appointments', 'classes', 'reservations', 'rentals'];
  return (
    <section className={`${M.bg} bg-soft px-page pb-section-lg pt-[clamp(56px,9vw,96px)]`}>
      <Container>
        {/* `mkt-*` rules are UNLAYERED, so a `gap-*` utility cannot beat their
            gap — the fluid column gap stays inline by design. */}
        <div className="mkt-stack-on-tablet items-center" style={{ gap: 'clamp(40px, 6vw, 72px)' }}>
          <div className="min-w-0 flex-1">
            <Display level={1}>
              Every booking, one engine
              <Spark color={M.color} />
            </Display>
            <Text variant="lead" className="mt-7 max-w-[580px]">
              {lede}
            </Text>
            <div className="mkt-cluster mt-[34px]" style={{ gap: '12px' }}>
              <Button size="lg" color="neutral">
                Activate Scheduling →
              </Button>
              <a href="#shapes" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
                See the booking shapes
              </a>
            </div>
            <ul className="mkt-cluster mt-[26px] list-none p-0" style={{ gap: '10px' }}>
              {chips.map((c) => (
                <li
                  key={c}
                  className="bg-base-100 border-base-300 inline-flex items-center gap-2 rounded-full border px-[13px] py-[7px]"
                >
                  <Dot color={M.color} size={6} />
                  <Text as="span" className="font-mono">
                    {c}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full min-w-0 flex-1">
            <Cycle
              items={SCHEDULING_SCENES.map((s) => (
                <BookingCard key={s.ref} scene={s} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — one confirmed booking: who, what service,
 *  which resource and slot, the deposit taken and the reminders queued. */
function BookingCard({ scene: s }: { scene: SchedulingScene }) {
  return (
    // No CardBody: the card is three rule-separated bands whose own components
    // (List rows / the resource grid) carry their padding.
    <Card className="overflow-hidden">
      <BookingHeader s={s} />
      <Divider className="my-0" />
      <BookingResource s={s} />
      <Divider className="my-0" />
      <BookingFooter s={s} />
    </Card>
  );
}

function BookingHeader({ s }: { s: SchedulingScene }) {
  return (
    <List>
      <ListRow>
        <Dot color={M.color} size={9} />
        <ListColGrow className="min-w-0">
          <Text as="div" className="font-medium">
            {s.service}
          </Text>
          <Text as="div">
            {s.customer} · {s.business}
          </Text>
        </ListColGrow>
        {/* `confirmed` is booking STATE, not module identity — semantic success. */}
        <Badge color="success" size="sm" className="shrink-0 gap-[7px]">
          <Dot color="currentColor" size={6} /> confirmed
        </Badge>
      </ListRow>
    </List>
  );
}

function BookingResource({ s }: { s: SchedulingScene }) {
  const cells: [string, string][] = [
    [s.slot, 'slot'],
    [s.resource, s.resourceRole],
    [s.duration, 'duration'],
  ];
  return (
    <div className="grid grid-cols-3">
      {cells.map(([v, l], i) => (
        <div key={l} className={`min-w-0 px-4 py-3.5 ${i === 0 ? '' : 'border-base-200 border-l'}`}>
          <Text as="div" className="font-medium">
            {v}
          </Text>
          {/* The field NAME half of a label/value pair — small, but full ink. */}
          <Heading level={6} className="mt-[3px] font-mono">
            {l}
          </Heading>
        </div>
      ))}
    </div>
  );
}

function BookingFooter({ s }: { s: SchedulingScene }) {
  return (
    <List>
      <ListRow>
        <BellIcon size={16} color={M.color} />
        <ListColGrow className="min-w-0">
          <Text as="div" className="font-medium">
            {s.deposit === '—' ? 'No deposit · free booking' : `${s.deposit} taken`}
          </Text>
          <Text as="div" className="font-mono">
            reminders {s.reminders}
          </Text>
        </ListColGrow>
        <Text as="span" className={`${M.ink} shrink-0 font-medium`}>
          {s.policy}
        </Text>
      </ListRow>
      <ListRow>
        <Dot color={M.color} size={6} />
        <ListColGrow className="min-w-0">
          <Text as="span" className="font-mono">
            {s.ref} · {s.capacityNote}
          </Text>
        </ListColGrow>
      </ListRow>
    </List>
  );
}

function BellIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
