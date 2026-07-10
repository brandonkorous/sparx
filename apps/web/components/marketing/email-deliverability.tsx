import type { ReactNode } from 'react';
import { getModuleColor, moduleTint, Section, SectionHeader } from './primitives';

/**
 * Two more structural devices for the /email page:
 *
 *  - EmailKinds ......... transactional vs marketing as a two-panel split, each
 *    with its real trigger flow (order.placed → email.send → delivered, and
 *    CRM segment → broadcast → open · click). One engine, one reputation.
 *  - EmailDeliverability  the sender-health checklist (SPF·DKIM·DMARC Pass,
 *    bounce/complaint guardrails) beside a dark auto-configured DNS records
 *    panel — mirrors the real dashboard "Sending domains" surface.
 *
 * Grounded in docs/13 (Email PRD) + the real dashboard email overview (sender
 * health rows: SPF authenticated / DKIM signed / DMARC enforced, bounce under
 * 2%, complaints under 0.1%). Email sky is a signal, not fill.
 */

const E = getModuleColor('email');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── TRANSACTIONAL vs MARKETING ──────────────────────────────────────────────
export function EmailKinds() {
  const panels: { tag: string; title: string; body: string; flow: [string, string, string] }[] = [
    {
      tag: 'transactional · triggered',
      title: 'Sent the instant something happens',
      body: 'Order confirmations, shipping updates, password resets, quote replies — wired into every module and live from the moment Email is on. Editable, brandable, never missed.',
      flow: ['order.placed', 'email.send', 'delivered'],
    },
    {
      tag: 'marketing · segment-targeted',
      title: 'Sent to exactly who should get it',
      body: 'Broadcasts target a live CRM segment — there is never a list to export. Compose, preview against a real customer, send or schedule, and watch opens and clicks roll in.',
      flow: ['CRM segment', 'broadcast', 'open · click'],
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={E.color}
        headline="One engine for both kinds of email"
        lede="Transactional messages your customers expect and marketing your team chooses to send — same domain, same reputation, same analytics. No second tool, no separate sender."
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '24px' }}>
        {panels.map((p, i) => (
          <div
            key={p.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '30px',
              backgroundColor: i === 0 ? moduleTint(E.color) : 'var(--color-base-100)',
              border: '1px solid var(--color-base-300)',
              borderRadius: '14px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: E.text,
              }}
            >
              {p.tag}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '23px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
              }}
            >
              {p.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '23px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {p.body}
            </p>
            <FlowLine steps={p.flow} />
          </div>
        ))}
      </div>
    </Section>
  );
}

/** A small monospace trigger flow: node → node → node, the middle node colored
 *  as the sparx step. Wraps gracefully on narrow panels. */
function FlowLine({ steps }: { steps: [string, string, string] }) {
  return (
    <div
      className="mkt-cluster"
      style={{
        gap: '8px',
        fontFamily: MONO,
        fontSize: '12px',
        color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        backgroundColor: 'var(--color-base-200)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '10px',
        padding: '13px 15px',
        marginTop: 'auto',
      }}
    >
      {steps.map((s, i) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              backgroundColor: i === 1 ? E.tint : 'var(--color-base-100)',
              border: `1px solid ${i === 1 ? E.color : 'var(--color-base-300)'}`,
              color:
                i === 1
                  ? E.text
                  : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            }}
          >
            {s}
          </span>
          {i < steps.length - 1 ? <span aria-hidden>→</span> : null}
        </span>
      ))}
    </div>
  );
}

// ── DELIVERABILITY ──────────────────────────────────────────────────────────
export function EmailDeliverability() {
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={E.color}
        headline="Authenticated the moment you verify"
        lede="Add your domain and sparx configures the records that get you to the inbox — SPF, DKIM, and DMARC — then watches them. Until a domain verifies, mail sends from the shared sparx domain, so you are never blocked."
      />
      <div className="mkt-deliv-grid" style={{ marginTop: '52px' }}>
        <SenderHealth />
        <DnsPanel />
      </div>
    </Section>
  );
}

function SenderHealth() {
  const auth = ['SPF authenticated', 'DKIM signed', 'DMARC enforced'];
  const guards: [string, string][] = [
    ['Bounce rate', '0.4% · under 2%'],
    ['Spam complaints', '0.02% · under 0.1%'],
  ];
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
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
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: '15px',
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: 9999, backgroundColor: E.color }} />{' '}
          Sender health
        </span>
        <Pill label="Verified" tone="email" />
      </div>
      {auth.map((a, i) => (
        <HealthRow key={a} first={i === 0} label={a}>
          <Pill label="Pass" tone="email" />
        </HealthRow>
      ))}
      {guards.map(([label, value]) => (
        <HealthRow key={label} first={false} label={label}>
          <Pill label={value} tone="muted" />
        </HealthRow>
      ))}
    </div>
  );
}

function HealthRow({
  first,
  label,
  children,
}: {
  first: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '11px',
        padding: '15px 20px',
        borderTop: first ? 'none' : '1px solid var(--color-base-200)',
        fontFamily: SANS,
        fontSize: '14px',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 9999,
          backgroundColor: E.tint,
          color: E.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '12px',
        }}
        aria-hidden
      >
        ✓
      </span>
      {label}
      <span style={{ marginLeft: 'auto' }}>{children}</span>
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone: 'email' | 'muted' }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: '11px',
        padding: '3px 9px',
        borderRadius: '9999px',
        backgroundColor: tone === 'email' ? E.tint : 'var(--color-base-200)',
        color:
          tone === 'email'
            ? E.text
            : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
      }}
    >
      {label}
    </span>
  );
}

function DnsPanel() {
  const records: { type: string; name: string; value: string }[] = [
    { type: 'TXT', name: '@', value: 'v=spf1 include:sparx.email ~all' },
    { type: 'TXT', name: 'sparx._domainkey', value: 'k=rsa; p=MIIBIjANBgkq…' },
    { type: 'TXT', name: '_dmarc', value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@…' },
    { type: 'CNAME', name: 'email', value: '(open/click tracking)' },
  ];
  return (
    <div style={{ backgroundColor: '#0A0A0A', borderRadius: '14px', padding: '26px' }}>
      <span
        style={{
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: '#71717A',
        }}
      >
        Auto-configured DNS · added for you
      </span>
      {records.map((r, i) => (
        <div
          key={r.name}
          style={{
            marginTop: i === 0 ? '14px' : '16px',
            paddingTop: i === 0 ? 0 : '16px',
            borderTop: i === 0 ? 'none' : '1px solid #1F1F1F',
            fontFamily: MONO,
            fontSize: '12px',
            lineHeight: 1.7,
          }}
        >
          <span style={{ color: E.color }}>{r.type}</span>{' '}
          <span style={{ color: '#FFFFFF' }}>{r.name}</span>
          <br />
          <span style={{ color: '#A1A1AA', wordBreak: 'break-all' }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
