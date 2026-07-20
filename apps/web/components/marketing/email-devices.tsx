import { Text } from '@wizeworks/silicaui-react';
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

// ── BROADCAST + STATS ───────────────────────────────────────────────────────
export function EmailBroadcast() {
  const chips = ['live segments', 'schedule or send now', 'revenue attributed'];
  return (
    <Section padding="lg">
      <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
        <div className="min-w-0 flex-1">
          <SectionHeader
            accent={E.color}
            headline="Send to a segment, watch it land"
            lede="Pick a saved CRM segment, compose, and send — or schedule it. Opens, clicks, bounces, and unsubscribes report back per send, and revenue is attributed to orders placed within 24 hours of a click. The list never leaves sparx."
          />
          <ul className="mt-[30px] flex list-none flex-wrap items-center gap-2.5 p-0">
            {chips.map((c) => (
              <li
                key={c}
                className="bg-base-100 border-base-300 inline-flex items-center gap-2 rounded-full border px-3 py-[7px]"
              >
                <Dot color={E.color} size={6} />
                <Text as="span" className="text-mini text-ink-muted font-mono">
                  {c}
                </Text>
              </li>
            ))}
          </ul>
        </div>
        <div className="w-full min-w-0 flex-1">
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
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border shadow-lg">
      <div className="border-base-300 flex items-center gap-3 border-b px-[22px] py-5">
        <Dot color={E.color} size={9} />
        <span className="min-w-0">
          <Text as="span" className="text-body-sm text-base-content block font-medium">
            {email.broadcastSubject}
          </Text>
          <Text as="span" className="text-mini text-ink-subtle font-mono">
            from {email.sender} · sent · just now
          </Text>
        </span>
        <Text
          as="span"
          className={`${E.bg} bg-soft ${E.ink} text-micro ml-auto shrink-0 rounded-full px-2.5 py-[3px] font-mono`}
        >
          Sent
        </Text>
      </div>
      <div className="bg-base-200 border-base-300 text-caption text-ink-muted flex items-center gap-2 border-b px-[22px] py-3.5">
        <Dot color={CRM.color} size={7} />
        Segment: <strong className="text-base-content font-medium">{email.segment}</strong> ·{' '}
        {email.recipients} recipients
      </div>
      <div className="mkt-bstats">
        {stats.map(([v, l]) => (
          <div key={l} className="mkt-bstat p-5">
            <div className="text-h2 text-base-content font-sans font-medium tracking-[-0.02em]">
              {v}
            </div>
            <Text className="text-micro text-ink-subtle mt-[3px] font-mono">{l}</Text>
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
      <div className="bg-base-300 border-base-300 mt-13 flex flex-col gap-px overflow-hidden rounded-[14px] border">
        {rows.map((r) => (
          <div key={r.title} className="mkt-auto-grid">
            <span className={`text-mini font-mono ${E.ink}`}>{r.when}</span>
            <span className="mkt-auto-chev" aria-hidden>
              →
            </span>
            <span className="text-small text-base-content">
              {r.title}
              <small className="text-mini text-ink-muted mt-[3px] block">{r.hint}</small>
            </span>
            <span
              className={`mkt-auto-badge text-micro justify-self-end rounded-full px-3 py-1 font-mono ${
                r.on ? `${E.bg} bg-soft ${E.ink}` : 'bg-base-200 text-ink-subtle'
              }`}
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
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {caps.map((c) => (
          <div
            key={c.title}
            className="bg-base-100 border-base-300 flex min-h-[172px] flex-col gap-3 rounded-xl border p-6"
          >
            <span className={`${E.bg} bg-soft flex h-8 w-8 items-center justify-center rounded-lg`}>
              <Dot color={E.color} size={9} />
            </span>
            <h3 className="text-body-lg m-0 font-sans font-medium tracking-[-0.01em]">{c.title}</h3>
            <Text className="text-caption text-ink-muted m-0">{c.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}
