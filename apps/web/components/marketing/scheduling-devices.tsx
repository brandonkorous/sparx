import { Dot, getModuleColor, moduleTint, Section, SectionHeader } from './primitives';
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
 */

const M = getModuleColor('scheduling');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── DOUBLE-BOOKING IS IMPOSSIBLE (DB-level) ─────────────────────────────────
export function SchedulingNoOverlap() {
  return (
    <Section id="no-overlap" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Double-booking is impossible, not unlikely"
        lede="Most tools check for conflicts in code, then hope the check ran before someone else booked. sparx enforces it in the database itself: a resource cannot hold two overlapping bookings at the same time, full stop. A racing second request fails cleanly and is offered the next open slot — even if your calendar sync lags."
      />
      <div className="mkt-stack-on-tablet" style={{ marginTop: '52px', gap: '24px' }}>
        <ResourceLane />
        <RejectedRace />
      </div>
      <p
        style={{
          marginTop: '24px',
          fontFamily: MONO,
          fontSize: '12px',
          lineHeight: '20px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          maxWidth: '760px',
        }}
      >
        Enforced by a Postgres exclusion constraint on every exclusive resource &mdash; staff,
        tables, rooms, bays, equipment. Pooled capacity (intentional overbooking) is a separate,
        deliberate setting, never an accident.
      </p>
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
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: moduleTint(M.color),
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-base-300)',
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: M.text,
        }}
      >
        resource lane · one exclusive booking
      </div>
      <div style={{ padding: '8px 0' }}>
        {lanes.map((l) => {
          const taken = l.booking === 'Balayage + cut · Nora P.';
          return (
            <div
              key={l.t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '6px 20px',
                minHeight: '52px',
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '12px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                  width: '44px',
                  flexShrink: 0,
                }}
              >
                {l.t}
              </span>
              {taken ? (
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: M.tint,
                    border: `1px solid ${M.color}`,
                    borderRadius: '10px',
                    fontFamily: SANS,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: M.text,
                  }}
                >
                  <Dot color={M.color} size={7} /> {l.booking}
                </span>
              ) : l.booking === 'held' ? (
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '10px 14px',
                    border:
                      '1px dashed color-mix(in oklab, var(--color-base-content) 30%, transparent)',
                    borderRadius: '10px',
                    fontFamily: MONO,
                    fontSize: '11.5px',
                    color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                  }}
                >
                  buffer · held by service settings
                </span>
              ) : (
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontFamily: MONO,
                    fontSize: '11.5px',
                    color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                  }}
                >
                  open
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Right: a racing second write hitting the same slot — rejected at the DB. */
function RejectedRace() {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '28px',
        backgroundColor: '#0A0A0A',
        borderRadius: '14px',
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: '#A1A1AA',
        }}
      >
        a second booking races for 1:00 PM
      </span>
      <pre
        style={{
          margin: 0,
          fontFamily: MONO,
          fontSize: '12.5px',
          lineHeight: '1.7',
          color: '#E4E4E7',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {`INSERT booking_resources
  resource = Nora P.
  range    = [1:00 PM, 3:15 PM)`}
      </pre>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
          backgroundColor: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.4)',
          borderRadius: '10px',
        }}
      >
        <BlockIcon size={16} color={M.color} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: '12px',
            color: '#FECDD3',
          }}
        >
          rejected · no_overlap constraint
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: SANS,
          fontSize: '13.5px',
          lineHeight: '21px',
          color: '#A1A1AA',
        }}
      >
        The overlap never commits. The customer is shown the next open time instead of a
        double-booked staff member &mdash; no apology email, no awkward call.
      </p>
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
      <div className="mkt-stack-on-tablet" style={{ marginTop: '52px', gap: '24px' }}>
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
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: moduleTint(M.color),
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        height: '100%',
      }}
    >
      <div>
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '16px' }}>{s.service}</span>
        <span
          style={{
            display: 'block',
            fontFamily: MONO,
            fontSize: '11.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            marginTop: '4px',
          }}
        >
          {s.ref} · {s.customer}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {steps.map((step) => (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '9999px',
                flexShrink: 0,
                backgroundColor: step.done ? M.color : 'var(--color-base-200)',
                border: step.done ? 'none' : '1px solid var(--color-base-300)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {step.done ? <Check size={11} color="#fff" /> : null}
            </span>
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: SANS,
                  fontSize: '14px',
                  fontWeight: 500,
                  color: step.done
                    ? 'var(--color-base-content)'
                    : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                }}
              >
                {step.label}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                {step.meta}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Right: a session/service waitlist with one slot freeing and the next auto-promoted. */
function WaitlistCard({ scene: s }: { scene: SchedulingScene }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-base-300)',
          backgroundColor: 'var(--color-base-200)',
        }}
      >
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px' }}>
          Waitlist · {s.service}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          {s.slot}
        </span>
      </div>
      <div style={{ padding: '8px 20px 18px' }}>
        <WaitlistRow name={s.customer} state="cancelled" />
        <WaitlistRow name="next in line" state="offered" />
        <WaitlistRow name="holds their place" state="waiting" />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            paddingTop: '14px',
          }}
        >
          <Dot color={M.color} size={6} />
          <span
            style={{
              fontFamily: MONO,
              fontSize: '11.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            auto-promote · offer held for a window, then rolls on
          </span>
        </div>
      </div>
    </div>
  );
}

function WaitlistRow({
  name,
  state,
}: {
  name: string;
  state: 'cancelled' | 'offered' | 'waiting';
}) {
  const styleByState = {
    cancelled: {
      color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
      label: 'cancelled',
      strike: true,
    },
    offered: { color: M.text, label: 'offered → promoted', strike: false },
    waiting: {
      color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
      label: 'waiting',
      strike: false,
    },
  }[state];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 0',
        borderBottom: '1px solid var(--color-base-200)',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontFamily: SANS,
          fontSize: '13.5px',
          color: styleByState.color,
          textDecoration: styleByState.strike ? 'line-through' : 'none',
        }}
      >
        <Dot
          color={
            state === 'offered'
              ? M.color
              : 'color-mix(in oklab, var(--color-base-content) 50%, transparent)'
          }
          size={7}
        />
        {name}
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: '11px',
          fontWeight: state === 'offered' ? 500 : 400,
          color: styleByState.color,
        }}
      >
        {styleByState.label}
      </span>
    </div>
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

function BlockIcon({ size, color }: { size: number; color: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}
