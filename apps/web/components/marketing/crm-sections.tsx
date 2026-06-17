import { Button } from '@sparx/ui';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  type MarketingModule,
  Section,
  SectionHeader,
  Spark,
} from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The markup-heavy structural devices for the /crm page, split out of
 * crm-page.tsx so each file stays cohesive:
 *
 *  - CrmHero ........... tinted-band hero: split copy + the UNIFIED CUSTOMER
 *    RECORD card (stats + module-colored signals) that crossfades through
 *    EXAMPLE_BUSINESSES so CRM reads as the spine for ANY business. The marquee
 *    device — one person, a signal from every module, colored by source.
 *  - CrmOneRecord ...... the "no sync" argument: a before stack (tools trading
 *    webhooks) vs. one sparx record, joined by a connector arrow.
 *  - CrmTimeline ....... the append-only activity feed beside the auto-logged /
 *    manual / auditable callout pins.
 *
 * Grounded in docs/11 (CRM PRD) + the real dashboard CRM surfaces (record
 * stats, activity event vocabulary). CRM cyan is a signal, not fill.
 */

const M = getModuleColor('crm');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

/** Module hue for a signal source — the record colors each signal by module. */
function sourceColor(module: MarketingModule): string {
  return getModuleColor(module).color;
}

// ── HERO ──────────────────────────────────────────────────────────────────────
export function CrmHero() {
  const lede =
    'sparx CRM is the customer spine — profiles, activity, segments, pipeline, and automation, all on the same database as your orders, emails, and quotes. No sync, no Zapier, no “which system is right?” The record is the record.';
  const chips = ['one record, every module', 'live segments', 'pipeline + forecast', 'no sync, ever'];
  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: M.tint,
      }}
    >
      <Container>
        <div
          className="mkt-stack-on-tablet"
          style={{ gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Display as="h1" size={84} lineHeight={80}>
              One customer, every signal
              <Spark color={M.color} />
            </Display>
            <p
              style={{
                fontFamily: SANS,
                fontWeight: 400,
                fontSize: 'clamp(16px, 1.6vw, 20px)',
                lineHeight: 1.55,
                color: 'var(--color-text-secondary)',
                maxWidth: '560px',
                margin: '28px 0 0',
              }}
            >
              {lede}
            </p>
            <div className="mkt-cluster" style={{ gap: '12px', marginTop: '34px' }}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Activate CRM →
              </Button>
              <a href="#record">
                <Button size="lg" variant="outline">
                  See a customer record
                </Button>
              </a>
            </div>
            <ul
              className="mkt-cluster"
              style={{ gap: '10px', marginTop: '26px', listStyle: 'none', padding: 0 }}
            >
              {chips.map((c) => (
                <li
                  key={c}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 13px',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '9999px',
                  }}
                >
                  <Dot color={M.color} size={6} />
                  <span style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div id="record" style={{ flex: 1, minWidth: 0, width: '100%', scrollMarginTop: '80px' }}>
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <RecordCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — one real customer record, every module's
 *  signal attached, colored by source. Crossfades through EXAMPLE_BUSINESSES;
 *  every scene has the same 3 stats + 5 signals so the card never reflows. */
function RecordCard({ business }: { business: ExampleBusiness }) {
  const { crm, customer } = business;
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '16px',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '13px',
          padding: '18px 20px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: '9999px',
            backgroundColor: M.tint,
            border: `1.5px solid ${M.color}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: '15px',
            color: M.text,
          }}
        >
          {crm.initials}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: SANS, fontWeight: 500, fontSize: '16px' }}>
            {customer.name}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            {crm.type} · one record · 5 live signals
          </span>
        </span>
        <Dot color={M.color} size={9} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        {[
          [crm.totalSpent, 'total spent'],
          [String(crm.orders), 'orders'],
          [crm.avgOrder, 'avg order'],
        ].map(([v, l], i) => (
          <div
            key={l}
            style={{
              padding: '14px 18px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--color-bg-subtle)',
            }}
          >
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: '18px', letterSpacing: '-0.01em' }}>
              {v}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              {l}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 20px 14px' }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: '10.5px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-tertiary)',
            padding: '12px 0 4px',
          }}
        >
          activity · from every module
        </div>
        {crm.signals.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '11px',
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--color-bg-subtle)',
              fontFamily: SANS,
              fontSize: '13.5px',
            }}
          >
            <Dot color={sourceColor(s.module)} size={8} />
            <span style={{ minWidth: 0 }}>{s.label}</span>
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: MONO,
                fontSize: '10.5px',
                color: 'var(--color-text-tertiary)',
                padding: '3px 8px',
                border: '1px solid var(--color-border-default)',
                borderRadius: '9999px',
                flexShrink: 0,
              }}
            >
              {s.module === 'ai' ? 'mcp' : s.module}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
