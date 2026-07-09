import { getModuleColor, type MarketingModule, Section, SectionHeader, Dot } from './primitives';

/**
 * Two lighter /crm sections (split from crm-page.tsx for line budget):
 *
 *  - CrmAutomation .. trigger → action rows (when X, do Y), each a when / arrow
 *    / then triptych whose arrow rotates and panels stack on mobile. Triggers
 *    mirror the real CRM automation table in docs/11 §7.
 *  - CrmCapabilities  the supporting capability grid (tasks, contact roles,
 *    dedupe, reports, B2B-on-record, MCP), 3→2→1.
 *
 * CRM cyan + module hues as signals, never fill.
 */

const M = getModuleColor('crm');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── AUTOMATION ────────────────────────────────────────────────────────────────
export function CrmAutomation() {
  const rows: {
    whenModule: MarketingModule;
    when: string;
    thenModule: MarketingModule;
    then: string;
  }[] = [
    {
      whenModule: 'crm',
      when: 'no order in 90 days',
      thenModule: 'email',
      then: 'send the win-back email',
    },
    {
      whenModule: 'crm',
      when: 'lifetime spend crosses $5,000',
      thenModule: 'crm',
      then: 'assign to a senior rep · tag VIP',
    },
    {
      whenModule: 'crm',
      when: 'deal moves to Proposal',
      thenModule: 'email',
      then: 'send the proposal template',
    },
    {
      whenModule: 'b2b',
      when: 'credit utilization over 80%',
      thenModule: 'crm',
      then: 'create a task for the assigned rep',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="When something changes, do the next thing"
        lede="CRM shares triggers with the email automation engine. Pick the signal, pick the action — send an email, assign a rep, create a task, fire a webhook. No code, and it runs off the same events the timeline already records."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '52px' }}>
        {rows.map((r) => (
          <div key={r.when} className="mkt-auto-row">
            <AutoCell label="when" module={r.whenModule} text={r.when} />
            <div
              className="mkt-auto-arrow"
              aria-hidden
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: M.color,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
            <AutoCell label="then" module={r.thenModule} text={r.then} then />
          </div>
        ))}
      </div>
    </Section>
  );
}

function AutoCell({
  label,
  module,
  text,
  then,
}: {
  label: string;
  module: MarketingModule;
  text: string;
  then?: boolean;
}) {
  return (
    <div
      className={then ? 'mkt-auto-then' : undefined}
      style={{
        padding: '20px 24px',
        backgroundColor: then ? 'var(--color-base-200)' : 'var(--color-base-100)',
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: '10.5px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: '14.5px',
          fontWeight: 500,
          marginTop: '7px',
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
        }}
      >
        <Dot color={getModuleColor(module).color} size={8} />
        {text}
      </div>
    </div>
  );
}

// ── CAPABILITY GRID ─────────────────────────────────────────────────────────────
export function CrmCapabilities() {
  const caps: { title: string; body: string; module?: MarketingModule }[] = [
    {
      title: 'Tasks & reminders',
      body: 'Title, due date, priority, assignee — surfaced on the record, the deal, and a personal task list. Overdue tasks email the rep.',
    },
    {
      title: 'Contact roles',
      body: 'One person can be a retail customer, a B2B buyer, and a sales prospect at once — with tags, addresses, and a preferred contact method.',
    },
    {
      title: 'Dedupe & merge',
      body: 'Duplicate detection on email, a guided merge that keeps both activity feeds, and a bulk tool that surfaces likely matches.',
    },
    {
      title: 'Reports that reconcile',
      body: 'Pipeline value by stage, win/loss by rep, deal cycle length, lifetime-value distribution, churn risk — off live data, not an export.',
    },
    {
      title: 'B2B on the same record',
      body: 'Account membership, pricing tier, credit limit and utilization, and net terms ride along on the customer when B2B is on.',
    },
    {
      title: 'Ask it in plain English',
      body: '“Top 10 customers by lifetime value,” “deals closing this month,” “assign all at-risk to Sarah” — over MCP, from the chat you already use.',
      module: 'ai',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Everything a sales and support team needs"
        lede="The record and the pipeline are the spine — these are the parts that make a day’s work actually move."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {caps.map((c) => {
          const hue = getModuleColor(c.module ?? 'crm');
          return (
            <div
              key={c.title}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '26px',
                backgroundColor: 'var(--color-base-200)',
                border: '1px solid var(--color-base-300)',
                borderRadius: '12px',
                minHeight: '172px',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  backgroundColor: hue.tint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Dot color={hue.color} size={9} />
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
          );
        })}
      </div>
    </Section>
  );
}
