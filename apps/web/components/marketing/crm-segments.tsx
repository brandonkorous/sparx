import { getModuleColor, moduleTint, Section, SectionHeader, Dot } from './primitives';

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
 */

const M = getModuleColor('crm');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

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
      <div className="mkt-seg-grid" style={{ marginTop: '52px' }}>
        <div
          style={{
            backgroundColor: moduleTint(M.color),
            border: '1px solid var(--color-base-300)',
            borderRadius: '14px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '14px 20px',
              borderBottom: '1px solid var(--color-base-300)',
            }}
          >
            <Dot color={M.color} size={8} />
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: M.text,
              }}
            >
              segment · win-back at-risk
            </span>
          </div>
          {preds.map((p) => (
            <div
              key={p.field}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                padding: '13px 20px',
                borderBottom: '1px solid var(--color-base-200)',
              }}
            >
              {p.join ? (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: '11px',
                    color: M.text,
                    padding: '3px 9px',
                    backgroundColor: M.tint,
                    borderRadius: '6px',
                  }}
                >
                  {p.join}
                </span>
              ) : null}
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: '13.5px',
                  padding: '5px 10px',
                  border: '1px solid var(--color-base-300)',
                  borderRadius: '7px',
                  backgroundColor: 'var(--color-base-200)',
                }}
              >
                <span style={{ fontWeight: 500 }}>{p.field}</span>{' '}
                <span
                  style={{
                    color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                    fontFamily: MONO,
                    fontSize: '12px',
                  }}
                >
                  {p.op}
                </span>{' '}
                {p.value}
              </span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '14px 20px',
              marginTop: 'auto',
              backgroundColor: 'var(--color-base-200)',
              borderTop: '1px solid var(--color-base-300)',
              fontFamily: MONO,
              fontSize: '11.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            <Dot color={M.color} size={6} />
            recomputed live · synced to Email
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-base-100)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '14px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '24px 22px 18px' }}>
            <div
              style={{
                fontFamily: SANS,
                fontSize: '52px',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: M.text,
              }}
            >
              218
            </div>
            <p
              style={{
                margin: '8px 0 0',
                fontFamily: SANS,
                fontSize: '13px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              customers match right now — auto-added the moment they cross the line, removed when
              they reorder.
            </p>
          </div>
          {matches.map((c) => (
            <div
              key={c.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '11px',
                padding: '12px 22px',
                borderTop: '1px solid var(--color-base-200)',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-base-200)',
                  flexShrink: 0,
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: SANS,
                    fontSize: '13.5px',
                    fontWeight: 500,
                  }}
                >
                  {c.name}
                </span>
                <span
                  style={{
                    fontFamily: SANS,
                    fontSize: '11.5px',
                    color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                  }}
                >
                  {c.meta}
                </span>
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: MONO,
                  fontSize: '13px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                }}
              >
                {c.amt}
              </span>
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
      <div className="mkt-pipeline-5" style={{ marginTop: '52px' }}>
        {stages.map((s) => (
          <div
            key={s.name}
            style={{
              backgroundColor: 'var(--color-base-100)',
              padding: '16px 14px',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              gap: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: '12.5px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                {s.won ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={M.text}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ opacity: s.opacity }}>
                    <Dot color={M.color} size={8} />
                  </span>
                )}
                {s.name}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                {s.n}
              </span>
            </div>
            {s.deals.map((d) => (
              <div
                key={d.t}
                style={{
                  border: `1px solid ${d.p === 'won' ? M.color : 'var(--color-base-300)'}`,
                  borderRadius: '9px',
                  padding: '11px',
                  backgroundColor: 'var(--color-base-200)',
                }}
              >
                <div
                  style={{ fontFamily: SANS, fontSize: '12.5px', fontWeight: 500, lineHeight: 1.3 }}
                >
                  {d.t}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: '11px',
                    color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                    marginTop: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{d.v}</span>
                  <span style={{ color: M.text }}>{d.p}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        className="mkt-cluster"
        style={{
          gap: '32px',
          marginTop: '22px',
          padding: '18px 22px',
          backgroundColor: 'var(--color-base-100)',
          border: '1px solid var(--color-base-300)',
          borderRadius: '12px',
        }}
      >
        {forecast.map(([n, l]) => (
          <div key={l}>
            <div
              style={{
                fontFamily: SANS,
                fontSize: '22px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
              }}
            >
              {n}
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: '12px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                marginTop: '2px',
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
