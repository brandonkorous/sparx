import { getModuleColor, type MarketingModule, Section, SectionHeader } from './primitives';

/**
 * The /crm activity-timeline device — an append-only customer feed beside three
 * callout pins. Markers are colored by the module that produced the event and
 * the event titles mirror the real CRM activity vocabulary (order.placed,
 * email.opened, call, deal/quote, order.delivered) from the dashboard's
 * activity-timeline.tsx. CRM cyan + module hues as signals.
 */

const M = getModuleColor('crm');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

interface Event {
  module: MarketingModule;
  title: string;
  actor: string;
  desc: string;
  time: string;
  icon: 'cart' | 'mail' | 'phone' | 'ai' | 'arrow';
}

const EVENTS: Event[] = [
  {
    module: 'commerce',
    title: 'Order placed',
    actor: 'system',
    desc: 'Order #1042 · $539.38 · paid with Apple Pay',
    time: 'today · 9:14 AM',
    icon: 'cart',
  },
  {
    module: 'email',
    title: 'Email opened',
    actor: 'system',
    desc: '“Spring restock is here” · clicked through to the new arrivals',
    time: 'yesterday · 6:02 PM',
    icon: 'mail',
  },
  {
    module: 'crm',
    title: 'Call logged',
    actor: 'staff · Maya',
    desc: 'Walked through the bedding-set sizes — wants to reorder for a guest room.',
    time: '2 days ago · 11:40 AM',
    icon: 'phone',
  },
  {
    module: 'ai',
    title: 'Asked the AI for a quote',
    actor: 'mcp',
    desc: '“What would two more bedding sets cost with my usual discount?”',
    time: '3 days ago · 8:21 PM',
    icon: 'ai',
  },
  {
    module: 'commerce',
    title: 'Order delivered',
    actor: 'system',
    desc: 'Order #1031 marked delivered by the carrier',
    time: 'last week',
    icon: 'arrow',
  },
];

const PINS = [
  {
    title: 'Auto-logged, every module',
    body: 'Orders, shipments, email opens and clicks, quotes, invoices, logins — written by the system as events fire.',
  },
  {
    title: 'Add yours by hand',
    body: 'Notes, calls with duration, meetings, and tasks with a due date and an assigned rep.',
  },
  {
    title: 'Append-only & auditable',
    body: 'Nothing is ever overwritten. An edit lands as a new entry marked “Edited,” so the history stays honest.',
  },
];

export function CrmTimeline() {
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Every interaction, in order, logged for you"
        lede="The activity feed is append-only and auto-populated. Orders, shipments, email opens, quotes, invoices, logins — written the moment they happen, from whatever module did them. Add a call, a note, or a meeting by hand; corrections appear as new entries, never overwrites."
      />
      <div className="mkt-frame-grid" style={{ marginTop: '52px' }}>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
          {EVENTS.map((e, i) => (
            <li key={e.title + e.time} style={{ position: 'relative', padding: '0 0 22px 34px' }}>
              {i < EVENTS.length - 1 ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '24px',
                    bottom: 0,
                    width: '1.5px',
                    backgroundColor: 'var(--color-base-300)',
                  }}
                />
              ) : null}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '2px',
                  width: 22,
                  height: 22,
                  borderRadius: '9999px',
                  backgroundColor: getModuleColor(e.module).color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <EventIcon kind={e.icon} />
              </span>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '14.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {e.title}
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: '10.5px',
                    color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                    padding: '2px 7px',
                    border: '1px solid var(--color-base-300)',
                    borderRadius: '9999px',
                  }}
                >
                  {e.actor}
                </span>
              </div>
              <p
                style={{
                  margin: '4px 0 0',
                  fontFamily: SANS,
                  fontSize: '13px',
                  lineHeight: '20px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                }}
              >
                {e.desc}
              </p>
              <div
                style={{
                  marginTop: '4px',
                  fontFamily: MONO,
                  fontSize: '11px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                {e.time}
              </div>
            </li>
          ))}
        </ol>
        <div>
          {PINS.map((p) => (
            <div
              key={p.title}
              style={{
                padding: '16px 18px',
                backgroundColor: 'var(--color-base-200)',
                border: '1px solid var(--color-base-300)',
                borderLeft: `3px solid ${M.color}`,
                borderRadius: '12px',
                marginBottom: '14px',
              }}
            >
              <h4
                style={{ margin: '0 0 4px', fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}
              >
                {p.title}
              </h4>
              <p
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '12.5px',
                  lineHeight: '19px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function EventIcon({ kind }: { kind: Event['icon'] }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#FFFFFF',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (kind === 'cart')
    return (
      <svg {...common}>
        <path d="M16 16h2a2 2 0 0 0 2-2V7l-4-4H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
        <circle cx="9" cy="19" r="2" />
        <circle cx="17" cy="19" r="2" />
      </svg>
    );
  if (kind === 'mail')
    return (
      <svg {...common}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 5L2 7" />
      </svg>
    );
  if (kind === 'phone')
    return (
      <svg {...common}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  if (kind === 'ai')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
