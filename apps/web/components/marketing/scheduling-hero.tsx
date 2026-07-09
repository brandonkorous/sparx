import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Dot, getModuleColor, Spark } from './primitives';
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
 * band is the light rose tint with near-black ink. See the rotation rule +
 * feedback-industry-agnostic-no-diesel.
 */

const M = getModuleColor('scheduling');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

export function SchedulingHero() {
  const lede =
    'Appointments, classes, reservations, and rentals run on one booking engine — with deposits, reminders, waitlists, and policies built in. Because it lives on sparx, every booking writes to the customer you already have: the deposit, the reminder, the no-show, the re-book all land in one system, not five disconnected tools.';
  const chips = ['appointments', 'classes', 'reservations', 'rentals'];
  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: M.tint,
      }}
    >
      <Container>
        <div
          className="mkt-stack-on-tablet"
          style={{ gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Display as="h1" size={84} lineHeight={80}>
              Every booking, one engine
              <Spark color={M.color} />
            </Display>
            <p
              style={{
                fontFamily: SANS,
                fontWeight: 400,
                fontSize: 'clamp(16px, 1.6vw, 20px)',
                lineHeight: 1.55,
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                maxWidth: '580px',
                margin: '28px 0 0',
              }}
            >
              {lede}
            </p>
            <div className="mkt-cluster" style={{ gap: '12px', marginTop: '34px' }}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Activate Scheduling →
              </Button>
              <a href="#shapes">
                <Button size="lg" variant="outline">
                  See the booking shapes
                </Button>
              </a>
            </div>
            <ul
              className="mkt-cluster"
              style={{ gap: '10px', marginTop: '26px', listStyle: 'none', padding: 0 }}
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
                  <Dot color={M.color} size={6} />
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
          </div>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
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
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '16px',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
        overflow: 'hidden',
      }}
    >
      <BookingHeader s={s} />
      <BookingResource s={s} />
      <BookingFooter s={s} />
    </div>
  );
}

function BookingHeader({ s }: { s: SchedulingScene }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-base-300)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <Dot color={M.color} size={9} />
        <span style={{ minWidth: 0 }}>
          <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px' }}>{s.service}</span>
          <br />
          <span
            style={{
              fontFamily: SANS,
              fontSize: '12px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            {s.customer} · {s.business}
          </span>
        </span>
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 11px',
          borderRadius: '9999px',
          backgroundColor: M.tint,
          color: M.text,
          fontFamily: SANS,
          fontSize: '12px',
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        <Dot color={M.color} size={6} /> confirmed
      </span>
    </div>
  );
}

function BookingResource({ s }: { s: SchedulingScene }) {
  const cells: [string, string][] = [
    [s.slot, 'slot'],
    [s.resource, s.resourceRole],
    [s.duration, 'duration'],
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        borderBottom: '1px solid var(--color-base-300)',
      }}
    >
      {cells.map(([v, l], i) => (
        <div
          key={l}
          style={{
            padding: '14px 16px',
            borderLeft: i === 0 ? 'none' : '1px solid var(--color-base-200)',
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: '14.5px',
              letterSpacing: '-0.01em',
              color: 'var(--color-base-content)',
            }}
          >
            {v}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              marginTop: '3px',
            }}
          >
            {l}
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingFooter({ s }: { s: SchedulingScene }) {
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
          backgroundColor: 'var(--color-base-200)',
          border: '1px solid var(--color-base-300)',
          borderRadius: '10px',
        }}
      >
        <BellIcon size={16} color={M.text} />
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontFamily: SANS,
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-base-content)',
            }}
          >
            {s.deposit === '—' ? 'No deposit · free booking' : `${s.deposit} taken`}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            reminders {s.reminders}
          </span>
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: SANS,
            fontSize: '11.5px',
            fontWeight: 500,
            color: M.text,
            flexShrink: 0,
          }}
        >
          {s.policy}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <Dot color={M.color} size={6} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          {s.ref} · {s.capacityNote}
        </span>
      </div>
    </div>
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
      style={{ flexShrink: 0 }}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
