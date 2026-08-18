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
        accent={M.ink}
        // BEAT 5d — IT ACTS. Last and highest link in the chain: it stops
        // waiting to be looked at. The lede's job is to make clear this runs on
        // the SAME events beat 5a described, which is why the order matters.
        headline="And then it does the next thing without being asked"
        lede="Pick something that happens and pick what should follow it — send an email, hand the customer to someone, put a task on their list. It runs on the same events already landing on the timeline, so there is nothing extra to wire up and no code to write."
      />
      <div className="mt-[52px] flex flex-col gap-3.5">
        {rows.map((r) => (
          <div key={r.when} className="mkt-auto-row">
            <AutoCell label="when" module={r.whenModule} text={r.when} />
            <div className={`mkt-auto-arrow ${M.ink} flex items-center justify-center`} aria-hidden>
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
    <div className={`px-6 py-5 ${then ? 'mkt-auto-then bg-base-200' : 'bg-base-100'}`}>
      {/* "when" / "then" are field labels on the rule row — device chrome. */}
      <div className="font-mono text-sm">{label}</div>
      <div className="mt-[7px] flex items-center gap-[9px] text-sm font-medium">
        <Dot fill={getModuleColor(module).bg} size={8} />
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
        accent={M.ink}
        // The inventory section, and honest about being one — it comes AFTER the
        // story has finished rather than standing in for it. "Everything a sales
        // and support team needs" was enterprise framing on a page written for
        // owners of small businesses (docs/brain/business/audience.md).
        headline="What else comes with it"
        lede="The story above is the part worth reading. This is the rest of what turns up when you switch it on."
      />
      <div className="mt-[52px] grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {caps.map((c) => {
          const hue = getModuleColor(c.module ?? 'crm');
          return (
            <div
              key={c.title}
              className="bg-base-200 border-base-300 flex min-h-[172px] flex-col gap-3 rounded-xl border p-[26px]"
            >
              <span
                className={`${hue.bg} bg-soft flex size-8 items-center justify-center rounded-lg`}
              >
                <Dot fill={hue.bg} size={9} />
              </span>
              <h3 className="text-lg font-medium tracking-[-0.01em]">{c.title}</h3>
              <p className="text-sm">{c.body}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
