import { getModuleColor, Section, SectionHeader, Dot } from './primitives';

/**
 * Two /crm structural devices (split for cohesion / line budget):
 *
 *  - CrmSegments ... a live segment DEFINITION (field / operator / value
 *    predicate rows joined by AND / AND NOT) beside the matching-customer
 *    panel it resolves to. Fields + operators mirror the real segment
 *    rule-builder (field-metadata.ts): lifetime spend, days since last order,
 *    order count, do-not-contact.
 *  - CrmPipeline ... a 5-stage deal board (Lead → Closed Won) over a weighted
 *    forecast strip, mirroring the dashboard kanban + forecast view.
 *
 * Grounded in docs/11 + the dashboard CRM surfaces. CRM cyan as a signal.
 *
 * Class-based per SILICA-VOCABULARY.md. The uppercase/mono strings that survive
 * here ("segment · win-back at-risk", the stage names, the predicate operators)
 * are DEVICE CHROME inside a mimicked CRM surface, not editorial eyebrows.
 */

const M = getModuleColor('crm');

// ── SEGMENTS ────────────────────────────────────────────────────────────────────
export function CrmSegments() {
  const preds: { join?: string; field: string; op: string; value: string }[] = [
    { field: 'Lifetime spend', op: 'is at least', value: '$500' },
    { join: 'AND', field: 'Days since last order', op: 'is greater than', value: '90' },
    { join: 'AND', field: 'Order count', op: 'is at least', value: '4' },
    { join: 'AND NOT', field: 'Do-not-contact', op: 'is', value: 'true' },
  ];
  const matches = [
    { name: 'Marcus Lee', meta: '12 orders · last 104 days ago', amt: '$3,240' },
    { name: 'Priya Nair', meta: '6 orders · last 96 days ago', amt: '$880' },
    { name: 'Reyes Fabrication', meta: '9 orders · last 121 days ago', amt: '$5,110' },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Define the audience, watch it fill"
        lede="Build a segment from any field on the record — lifetime spend, days since last order, email engagement, B2B pricing tier. It updates itself as customers cross the line, and syncs straight to an Email broadcast. No list to export, ever."
      />
      <div className="mkt-seg-grid mt-[52px]">
        <div
          className={`${M.bg} bg-soft border-base-300 flex flex-col overflow-hidden rounded-[14px] border`}
        >
          {/* Device chrome: the segment's name rail inside the mimicked builder. */}
          <div className="border-base-300 flex items-center gap-[9px] border-b px-5 py-3.5">
            <Dot color={M.color} size={8} />
            <span className={`${M.ink} font-mono text-sm`}>segment · win-back at-risk</span>
          </div>
          {preds.map((p) => (
            <div
              key={p.field}
              className="border-base-200 flex flex-wrap items-center gap-2 border-b px-5 py-[13px]"
            >
              {p.join ? (
                <span
                  className={`${M.bg} bg-soft ${M.ink} rounded-md px-[9px] py-[3px] font-mono text-sm`}
                >
                  {p.join}
                </span>
              ) : null}
              <span className="border-base-300 bg-base-200 rounded-[7px] border px-2.5 py-[5px] text-sm">
                <span className="font-medium">{p.field}</span>{' '}
                <span className="font-mono text-sm">{p.op}</span> {p.value}
              </span>
            </div>
          ))}
          <div className="bg-base-200 border-base-300 mt-auto flex items-center gap-[9px] border-t px-5 py-3.5 font-mono text-sm">
            <Dot color={M.color} size={6} />
            recomputed live · synced to Email
          </div>
        </div>
        <div className="bg-base-100 border-base-300 flex flex-col overflow-hidden rounded-[14px] border">
          <div className="px-[22px] pt-6 pb-[18px]">
            <div className={`${M.ink} text-[52px] leading-none font-medium tracking-[-0.03em]`}>
              218
            </div>
            <p className="mt-2 text-sm">
              customers match right now — auto-added the moment they cross the line, removed when
              they reorder.
            </p>
          </div>
          {matches.map((c) => (
            <div
              key={c.name}
              className="border-base-200 flex items-center gap-[11px] border-t px-[22px] py-3"
            >
              <span className="bg-base-200 size-7 shrink-0 rounded-full" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{c.name}</span>
                <span className="text-sm">{c.meta}</span>
              </span>
              <span className="ml-auto font-mono text-sm">{c.amt}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ── PIPELINE ────────────────────────────────────────────────────────────────────
export function CrmPipeline() {
  const stages: {
    name: string;
    n: string;
    opacity: number;
    won?: boolean;
    deals: { t: string; v: string; p: string }[];
  }[] = [
    {
      name: 'Lead',
      n: '3',
      opacity: 0.4,
      deals: [
        { t: 'North Loop wholesale', v: '$4,200', p: '20%' },
        { t: 'Hudson farm CSA', v: '$1,800', p: '20%' },
      ],
    },
    {
      name: 'Qualified',
      n: '2',
      opacity: 0.6,
      deals: [{ t: 'Atlas reorder contract', v: '$12,400', p: '40%' }],
    },
    {
      name: 'Proposal',
      n: '2',
      opacity: 0.8,
      deals: [{ t: 'Waggle retail expansion', v: '$6,900', p: '60%' }],
    },
    {
      name: 'Negotiation',
      n: '1',
      opacity: 1,
      deals: [{ t: 'Reyes fleet account', v: '$18,000', p: '75%' }],
    },
    {
      name: 'Closed Won',
      n: '4',
      opacity: 1,
      won: true,
      deals: [{ t: 'Flax & Fern bulk', v: '$9,300', p: 'won' }],
    },
  ];
  const forecast = [
    ['$24,180', 'weighted pipeline value'],
    ['8', 'open deals across 5 stages'],
    ['$9,300', 'closed-won this month'],
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="A pipeline that already knows your orders"
        lede="Deals move Lead → Qualified → Proposal → Negotiation → Closed, on a board you drag, a list you sort, or a forecast weighted by probability. Each deal links to the customer’s real quotes and orders — so “quote sent → accepted → invoice paid” lives on one card."
      />
      <div className="mkt-pipeline-5 mt-[52px]">
        {stages.map((s) => (
          <div
            key={s.name}
            className="bg-base-100 flex min-h-[220px] flex-col gap-[11px] px-3.5 py-4"
          >
            <div className="flex items-center justify-between">
              {/* Stage header — kanban column chrome, kept as-is. */}
              <span className="flex items-center gap-[7px] text-sm font-medium">
                {s.won ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={M.color}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  // Per-stage confidence ramp — a computed value, so it stays inline.
                  <span style={{ opacity: s.opacity }}>
                    <Dot color={M.color} size={8} />
                  </span>
                )}
                {s.name}
              </span>
              <span className="font-mono text-sm">{s.n}</span>
            </div>
            {s.deals.map((d) => (
              <div
                key={d.t}
                className={`bg-base-200 rounded-[9px] border p-[11px] ${
                  d.p === 'won' ? 'border-module-crm' : 'border-base-300'
                }`}
              >
                <div className="text-sm leading-[1.3] font-medium">{d.t}</div>
                <div className="mt-1.5 flex justify-between font-mono text-sm">
                  <span>{d.v}</span>
                  <span className={M.ink}>{d.p}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="bg-base-100 border-base-300 mt-[22px] flex flex-wrap items-center gap-8 rounded-xl border px-[22px] py-[18px]">
        {forecast.map(([n, l]) => (
          <div key={l}>
            <div className="text-2xl font-medium tracking-[-0.02em]">{n}</div>
            <div className="mt-0.5 text-sm">{l}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
