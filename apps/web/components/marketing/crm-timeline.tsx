import { getModuleColor, type MarketingModule, Section, SectionHeader } from './primitives';

/**
 * The /crm activity-timeline device — an append-only customer feed beside three
 * callout pins. Markers are colored by the module that produced the event and
 * the event titles mirror the real CRM activity vocabulary (order.placed,
 * email.opened, call, deal/quote, order.delivered) from the dashboard's
 * activity-timeline.tsx. CRM cyan + module hues as signals.
 *
 * Class-based per SILICA-VOCABULARY.md; the marker's fill is the only inline
 * style left, because it's a per-event module hue VALUE.
 */

const M = getModuleColor('crm');

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
      <div className="mkt-frame-grid mt-[52px]">
        <ol className="relative list-none">
          {EVENTS.map((e, i) => (
            <li key={e.title + e.time} className="relative pb-[22px] pl-[34px]">
              {i < EVENTS.length - 1 ? (
                <span
                  aria-hidden
                  className="bg-base-300 absolute top-6 bottom-0 left-2.5 w-[1.5px]"
                />
              ) : null}
              <span
                aria-hidden
                className="absolute top-0.5 left-0 flex size-[22px] items-center justify-center rounded-full text-white"
                style={{ backgroundColor: getModuleColor(e.module).color }}
              >
                <EventIcon kind={e.icon} />
              </span>
              <div className="text-small flex flex-wrap items-center gap-2 font-medium">
                {e.title}
                {/* Actor tag — feed-row chrome mirroring the dashboard timeline. */}
                <span className="text-ink-subtle text-micro border-base-300 rounded-full border px-[7px] py-0.5 font-mono">
                  {e.actor}
                </span>
              </div>
              <p className="text-ink-muted text-caption mt-1">{e.desc}</p>
              <div className="text-ink-subtle text-micro mt-1 font-mono">{e.time}</div>
            </li>
          ))}
        </ol>
        <div>
          {PINS.map((p) => (
            <div
              key={p.title}
              className="bg-base-200 border-base-300 border-l-module-crm mb-3.5 rounded-xl border-y border-r border-l-[3px] px-[18px] py-4"
            >
              <h4 className="text-small mb-1 font-medium">{p.title}</h4>
              <p className="text-ink-muted text-caption">{p.body}</p>
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
    stroke: 'currentColor',
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
