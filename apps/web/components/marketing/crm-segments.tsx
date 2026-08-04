import { Badge } from '@wizeworks/silicaui-react';
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
        accent={M.ink}
        // BEAT 5b — IT GROUPS. Second link: now that everything is recorded,
        // the record can answer questions about itself. "Define the audience,
        // watch it fill" was product-manager framing for an owner audience.
        headline="Ask a question once, keep getting the answer"
        lede="“Everyone who spent over $500 and hasn’t ordered since spring.” Ask it once and it stays asked — people join and leave on their own as they cross the line, and the answer is still right in March. Send to it straight from Email, so there is never a list to export, clean up and re-upload."
      />
      <div className="mkt-seg-grid mt-[52px]">
        {/* The rule-builder panel. This was `${M.bg} bg-soft` — a cyan wash across
            the whole panel, with `${M.ink}` cyan type on top of it at 2.15:1. It
            is differentiated from the results panel beside it by a real elevation
            step and the accent top edge (the same idiom `Panel accent` uses in
            crm-devices), not by tinting the surface: RULE #3, and the hue now
            reads as a signal on the dot and the join chips instead of draining
            into a background. */}
        <div className="bg-base-100 border-base-300 border-t-module-crm flex flex-col overflow-hidden rounded-[14px] border border-t-[3px]">
          {/* Device chrome: the segment's name rail inside the mimicked builder. */}
          <div className="border-base-300 flex items-center gap-[9px] border-b px-5 py-3.5">
            <Dot fill={M.bg} size={8} />
            <span className="font-mono text-sm">segment · win-back at-risk</span>
          </div>
          {preds.map((p) => (
            <div
              key={p.field}
              className="border-base-200 flex flex-wrap items-center gap-2 border-b px-5 py-[13px]"
            >
              {/* The boolean joins are the one thing in this device that carries
                  meaning rather than chrome, so they get the solid module hue —
                  which also resolves the 2.15:1 `bg-soft`-plus-same-hue-ink pair
                  they used to be. */}
              {p.join ? (
                <Badge color="module-crm" variant="solid" size="sm" className="font-mono">
                  {p.join}
                </Badge>
              ) : null}
              <span className="border-base-300 bg-base-200 rounded-[7px] border px-2.5 py-[5px] text-sm">
                <span className="font-medium">{p.field}</span>{' '}
                <span className="font-mono text-sm">{p.op}</span> {p.value}
              </span>
            </div>
          ))}
          <div className="bg-base-200 border-base-300 mt-auto flex items-center gap-[9px] border-t px-5 py-3.5 font-mono text-sm">
            <Dot fill={M.bg} size={6} />
            recomputed live · synced to Email
          </div>
        </div>
        <div className="bg-base-100 border-base-300 flex flex-col overflow-hidden rounded-[14px] border">
          <div className="px-[22px] pt-6 pb-[18px]">
            {/* Default ink, not `${M.ink}`. Cyan as TEXT on white measures
                2.43:1 — module hues are fills, and on a light surface they all
                land between 2.2 and 2.8:1, which is why `-content` pairings
                exist. At 52px it needs 3.0 and still missed. The number carries
                itself at this scale; the panel's identity is already on the
                accent edge and the dots. */}
            <div className="text-[52px] leading-none font-medium tracking-[-0.03em]">218</div>
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
    /** Confidence ramp as a Dot SIZE (6→9), not an opacity — see the render. */
    dot: number;
    won?: boolean;
    deals: { t: string; v: string; p: string }[];
  }[] = [
    {
      name: 'Lead',
      n: '3',
      dot: 6,
      deals: [
        { t: 'North Loop wholesale', v: '$4,200', p: '20%' },
        { t: 'Hudson farm CSA', v: '$1,800', p: '20%' },
      ],
    },
    {
      name: 'Qualified',
      n: '2',
      dot: 7,
      deals: [{ t: 'Atlas reorder contract', v: '$12,400', p: '40%' }],
    },
    {
      name: 'Proposal',
      n: '2',
      dot: 8,
      deals: [{ t: 'Waggle retail expansion', v: '$6,900', p: '60%' }],
    },
    {
      name: 'Negotiation',
      n: '1',
      dot: 9,
      deals: [{ t: 'Reyes fleet account', v: '$18,000', p: '75%' }],
    },
    {
      name: 'Closed Won',
      n: '4',
      dot: 9,
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
        accent={M.ink}
        // BEAT 5c — IT CONNECTS. Third link: the record now joins up the two
        // halves of a sale that normally live in different tools.
        headline="The deal already knows what they bought"
        lede="Work deals across Lead, Qualified, Proposal, Negotiation and Closed — on a board you drag, a list you sort, or a forecast weighted by how likely each one is. Every deal is attached to that customer’s real quotes and orders, so the whole thread from “quote sent” to “invoice paid” sits on one card instead of across a CRM, an inbox and a spreadsheet."
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
                  // Per-stage confidence ramp, expressed as SIZE rather than
                  // opacity. It was `<span style={{opacity: s.opacity}}>` — a dot
                  // faded to 40% on Lead, which is RULE #3 exactly: fading used to
                  // signal hierarchy, on something the reader IS meant to see. It
                  // also cost four inline styles. Scale is the sanctioned device
                  // and reads better anyway: the marker grows as the deal firms
                  // up, and every step stays legible instead of the earliest one
                  // being the hardest to see.
                  <Dot fill={M.bg} size={s.dot} />
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
                {/* Same reason as the "218" above: `${M.ink}` cyan on base-200
                    is 2.22:1 at 14px. The probability is already distinguished
                    from the deal value by position and the mono face, and the
                    one card that means something different — the won deal —
                    carries `border-module-crm`, which is the hue doing its
                    actual job as a fill rather than failing as an ink. */}
                <div className="mt-1.5 flex justify-between font-mono text-sm">
                  <span>{d.v}</span>
                  <span>{d.p}</span>
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
