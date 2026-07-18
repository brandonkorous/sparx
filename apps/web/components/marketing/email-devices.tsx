import { Dot, getModuleColor, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The remaining structural devices for the /email page:
 *
 *  - EmailBroadcast ..... split copy + a BROADCAST card (segment → recipients →
 *    open · click · complaints), crossfading subject lines through the
 *    EXAMPLE_BUSINESSES so the campaign reads as vertical-agnostic. A second
 *    <Cycle> from the hero's, far apart on the page so they're never co-visible.
 *  - EmailAutomations ... the live default automations as when → then rows on
 *    real platform-event triggers, with an Active / Optional status.
 *  - EmailCapabilities .. the rest (templates, analytics, suppressions,
 *    CRM-synced segments, inbox placement, MCP) as a signal-dot grid.
 *
 * Grounded in docs/13 (Email PRD) + the real dashboard email surfaces
 * (broadcasts "segment-targeted marketing campaigns"; automations Welcome
 * series / Abandoned cart / Order shipped / Win-back). Email sky is a signal.
 */

const E = getModuleColor('email');
const CRM = getModuleColor('crm');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── BROADCAST + STATS ───────────────────────────────────────────────────────
export function EmailBroadcast() {
  const chips = ['live segments', 'schedule or send now', 'revenue attributed'];
  return (
    <Section padding="lg">
      <div
        className="mkt-stack-on-tablet"
        style={{ gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SectionHeader
            accent={E.color}
            headline="Send to a segment, watch it land"
            lede="Pick a saved CRM segment, compose, and send — or schedule it. Opens, clicks, bounces, and unsubscribes report back per send, and revenue is attributed to orders placed within 24 hours of a click. The list never leaves sparx."
          />
          <ul
            className="mkt-cluster"
            style={{ gap: '10px', marginTop: '30px', listStyle: 'none', padding: 0 }}
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
                <Dot color={E.color} size={6} />
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
            items={EXAMPLE_BUSINESSES.map((b) => (
              <BroadcastCard key={b.domain} business={b} />
            ))}
          />
        </div>
      </div>
    </Section>
  );
}

function BroadcastCard({ business }: { business: ExampleBusiness }) {
  const { email } = business;
  const stats: [string, string][] = [
    [email.recipients, 'delivered'],
    [email.openRate, 'opened'],
    [email.clickRate, 'clicked'],
    ['0.0%', 'complaints'],
  ];
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          padding: '20px 22px',
          borderBottom: '1px solid var(--color-base-300)',
        }}
      >
        <Dot color={E.color} size={9} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: SANS, fontWeight: 500, fontSize: '15px' }}>
            {email.broadcastSubject}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '11.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            from {email.sender} · sent · just now
          </span>
        </span>
        <span
          className={`${E.bg} bg-soft ${E.ink}`}
          style={{
            marginLeft: 'auto',
            fontFamily: MONO,
            fontSize: '11px',
            padding: '3px 9px',
            borderRadius: '9999px',
            flexShrink: 0,
          }}
        >
          Sent
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '14px 22px',
          backgroundColor: 'var(--color-base-200)',
          borderBottom: '1px solid var(--color-base-300)',
          fontFamily: SANS,
          fontSize: '13px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        <Dot color={CRM.color} size={7} />
        Segment:{' '}
        <strong style={{ color: 'var(--color-base-content)', fontWeight: 500 }}>
          {email.segment}
        </strong>{' '}
        · {email.recipients} recipients
      </div>
      <div className="mkt-bstats">
        {stats.map(([v, l]) => (
          <div key={l} className="mkt-bstat" style={{ padding: '20px' }}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '24px',
                letterSpacing: '-0.02em',
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: '10.5px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                marginTop: '3px',
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AUTOMATIONS ─────────────────────────────────────────────────────────────
export function EmailAutomations() {
  const rows: { when: string; title: string; hint: string; on: boolean }[] = [
    {
      when: 'crm.customer.created',
      title: 'Welcome series',
      hint: 'greets every new customer, immediately',
      on: true,
    },
    {
      when: 'cart.abandoned',
      title: 'Abandoned cart',
      hint: 'waits 2 hours, then nudges if no order',
      on: true,
    },
    {
      when: 'order.fulfilled',
      title: 'Order shipped',
      hint: 'sends tracking the moment it ships',
      on: true,
    },
    {
      when: 'no order · 90 days',
      title: 'Win-back',
      hint: 're-engages lapsed customers on a daily check',
      on: false,
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={E.color}
        headline="The automations are already on"
        lede="Activate Email and the default flows run from minute one — zero configuration. Each is a when → then rule on a real platform event, and you can tune, pause, or disable the optional ones whenever you like."
      />
      <div
        style={{
          marginTop: '52px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          backgroundColor: 'var(--color-base-300)',
          border: '1px solid var(--color-base-300)',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        {rows.map((r) => (
          <div key={r.title} className="mkt-auto-grid">
            <span className={`mono ${E.ink}`} style={{ fontFamily: MONO, fontSize: '12px' }}>
              {r.when}
            </span>
            <span className="mkt-auto-chev" aria-hidden>
              →
            </span>
            <span style={{ fontFamily: SANS, fontSize: '14.5px' }}>
              {r.title}
              <small
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  marginTop: '3px',
                }}
              >
                {r.hint}
              </small>
            </span>
            <span
              className={`mkt-auto-badge ${r.on ? `${E.bg} bg-soft ${E.ink}` : 'bg-base-200'}`}
              style={{
                justifySelf: 'end',
                fontFamily: MONO,
                fontSize: '11px',
                padding: '4px 11px',
                borderRadius: '9999px',
                color: r.on
                  ? undefined
                  : 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {r.on ? 'Active' : 'Optional'}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── CAPABILITIES ────────────────────────────────────────────────────────────
export function EmailCapabilities() {
  const caps = [
    {
      title: 'Template editor',
      body: 'Edit on-brand templates with a variable picker, mobile and dark-mode preview, a spam-score check, and a test send to any address.',
    },
    {
      title: 'Engagement analytics',
      body: 'Sent, delivered, opened, clicked, bounced, and unsubscribed per send — plus attributed revenue and your best send time.',
    },
    {
      title: 'Suppressions, handled',
      body: 'Hard bounces and complaints suppress automatically, one-click unsubscribe is in every email, and the list stays CAN-SPAM and GDPR clean.',
    },
    {
      title: 'Segments from CRM',
      body: 'Target any live segment — spend, recency, tags, B2B tier — straight from the CRM. The audience recomputes itself; no export, ever.',
    },
    {
      title: 'Inbox placement',
      body: 'Per-provider delivery to Gmail, Apple Mail, Outlook, and Yahoo, with bounce and complaint rates watched against the thresholds that matter.',
    },
    {
      title: 'Drive it over MCP',
      body: 'Your AI assistant can pull email stats and send a broadcast in plain English — with a confirmation step before anything goes out.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={E.color}
        headline={<>Everything a sender needs</>}
        lede="The parts that make email actually work — building, measuring, and keeping a clean list — are all in the box, not add-ons."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {caps.map((c) => (
          <div
            key={c.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '26px',
              backgroundColor: 'var(--color-base-100)',
              border: '1px solid var(--color-base-300)',
              borderRadius: '12px',
              minHeight: '172px',
            }}
          >
            <span
              className={`${E.bg} bg-soft`}
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Dot color={E.color} size={9} />
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {c.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
