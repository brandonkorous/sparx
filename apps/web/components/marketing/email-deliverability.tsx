import type { ReactNode } from 'react';
import { Text } from '@wizeworks/silicaui-react';
import { getModuleColor, Section, SectionHeader } from './primitives';

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

// ── TRANSACTIONAL vs MARKETING ──────────────────────────────────────────────
export function EmailKinds() {
  const panels: { title: string; body: string; flow: [string, string, string] }[] = [
    {
      title: 'Sent the instant something happens',
      body: 'Order confirmations, shipping updates, password resets, quote replies — wired into every module and live from the moment Email is on. Editable, brandable, never missed.',
      flow: ['order.placed', 'email.send', 'delivered'],
    },
    {
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
      <div className="mt-13 grid grid-cols-1 gap-6 md:grid-cols-2">
        {panels.map((p, i) => (
          <div
            key={p.title}
            className={`${i === 0 ? `${E.bg} bg-soft` : 'bg-base-100'} border-base-300 flex flex-col gap-4 rounded-[14px] border p-[30px]`}
          >
            <h3 className="text-h3 m-0 font-sans font-medium tracking-[-0.02em]">{p.title}</h3>
            <Text className="text-small text-ink-muted m-0">{p.body}</Text>
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
    <div className="bg-base-200 border-base-300 text-mini text-ink-muted mt-auto flex flex-wrap items-center gap-2 rounded-[10px] border px-4 py-3 font-mono">
      {steps.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-2">
          <span
            className={`rounded-md border px-2.5 py-1 whitespace-nowrap ${
              i === 1
                ? `${E.bg} bg-soft ${E.ink} border-module-email`
                : 'bg-base-100 border-base-300 text-ink-muted'
            }`}
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
      <div className="mkt-deliv-grid mt-13">
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
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-[14px] border">
      <div className="border-base-300 bg-base-200 flex items-center justify-between border-b px-5 py-4">
        <span className="text-body-sm text-base-content flex items-center gap-2.5 font-medium">
          <span className={`${E.bg} h-[9px] w-[9px] rounded-full`} /> Sender health
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
      className={`text-small text-base-content flex items-center gap-3 px-5 py-3.5 ${
        first ? '' : 'border-base-200 border-t'
      }`.trimEnd()}
    >
      <span
        className={`${E.bg} bg-soft ${E.ink} text-mini flex h-5 w-5 shrink-0 items-center justify-center rounded-full`}
        aria-hidden
      >
        ✓
      </span>
      {label}
      <span className="ml-auto">{children}</span>
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone: 'email' | 'muted' }) {
  return (
    <span
      className={`text-micro rounded-full px-2.5 py-[3px] font-mono ${
        tone === 'email' ? `${E.bg} bg-soft ${E.ink}` : 'bg-base-200 text-ink-muted'
      }`}
    >
      {label}
    </span>
  );
}

/** The auto-configured DNS records, on a dark themed island so the record
 *  values read as a terminal/console surface without a single literal hex. */
function DnsPanel() {
  const records: { type: string; name: string; value: string }[] = [
    { type: 'TXT', name: '@', value: 'v=spf1 include:sparx.email ~all' },
    { type: 'TXT', name: 'sparx._domainkey', value: 'k=rsa; p=MIIBIjANBgkq…' },
    { type: 'TXT', name: '_dmarc', value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@…' },
    { type: 'CNAME', name: 'email', value: '(open/click tracking)' },
  ];
  return (
    <div data-theme="dark" className="bg-base-100 rounded-[14px] p-6">
      {/* Panel chrome inside a device mockup — not an eyebrow. */}
      <span className="text-micro text-ink-subtle font-mono tracking-[0.05em] uppercase">
        Auto-configured DNS · added for you
      </span>
      {records.map((r, i) => (
        <div
          key={r.name}
          className={`text-mini font-mono leading-[1.7] ${
            i === 0 ? 'mt-3.5' : 'border-base-300 mt-4 border-t pt-4'
          }`}
        >
          <span className={E.ink}>{r.type}</span>{' '}
          <span className="text-base-content">{r.name}</span>
          <br />
          <span className="text-ink-muted break-all">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
