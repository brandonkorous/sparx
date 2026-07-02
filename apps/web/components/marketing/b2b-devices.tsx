import { Dot, getModuleColor, moduleTint, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * Two structural devices for the /b2b page, split out of b2b-page.tsx:
 *
 *  - B2bTerms ........ net terms & credit: an account's terms + credit bar beside
 *    the A/R aging ledger (current → 60+), the cashflow-risk view.
 *  - B2bBulkPo ....... bulk / PO ordering: how a wholesale order is placed (PO
 *    number, saved cart reorder, quantity rules, approval hold) as labeled rows.
 *
 * Grounded in docs/10 (B2B PRD) + the real dashboard B2B surfaces (credit
 * limit/used, A/R aging buckets, approval rules). B2B slate is a signal, not
 * fill. (Fleet/service + the same-engine beat live in b2b-extras.tsx.)
 */

const M = getModuleColor('b2b');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── NET TERMS & CREDIT + A/R AGING ──────────────────────────────────────────
export function B2bTerms() {
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Net terms, credit, and what’s outstanding"
        lede="Sell on terms without selling blind. Set Net 15 to 60 and a credit limit per account; orders on terms invoice automatically with the buyer’s PO number and count against the limit. When an account would run over, the order holds for your approval — and A/R aging shows what’s outstanding by age."
      />
      <div className="mkt-b2b-split" style={{ marginTop: '52px' }}>
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <CreditCard key={b.domain} business={b} />
          ))}
        />
        <AgingLedger />
      </div>
    </Section>
  );
}

function CreditCard({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
  return (
    <div
      style={{
        backgroundColor: moduleTint(M.color),
        border: '1px solid var(--color-border-default)',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        height: '100%',
      }}
    >
      <div>
        <div
          style={{ fontFamily: SANS, fontWeight: 500, fontSize: '18px', letterSpacing: '-0.01em' }}
        >
          {b2b.account}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            marginTop: '4px',
          }}
        >
          {b2b.terms} · {b2b.tier}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span
            style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}
          >
            Credit used
          </span>
          <span
            style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}
          >
            {b2b.creditUsed} / {b2b.creditLimit}
          </span>
        </div>
        <span
          style={{
            display: 'block',
            height: '8px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-bg-subtle)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              height: '100%',
              width: b2b.creditUsedPct,
              backgroundColor: M.color,
              borderRadius: '9999px',
            }}
          />
        </span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
          {b2b.creditUsedPct} of limit used
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          marginTop: 'auto',
          padding: '12px 14px',
          backgroundColor: M.tint,
          borderRadius: '10px',
        }}
      >
        <Dot color={M.color} size={7} />
        <span style={{ fontFamily: SANS, fontSize: '12.5px', color: M.text }}>
          New PO checks the limit before it’s placed
        </span>
      </div>
    </div>
  );
}

/** Static A/R aging ledger — the real dashboard buckets (current, 1–30, 31–60,
 *  60+). Illustrative totals; the device is the shape, not a tenant's numbers. */
function AgingLedger() {
  const rows: { label: string; value: string; bar: string; tone: string }[] = [
    { label: 'Current', value: '$34,200', bar: '100%', tone: M.color },
    { label: '1–30 days', value: '$11,400', bar: '34%', tone: M.color },
    { label: '31–60 days', value: '$4,100', bar: '12%', tone: '#D97706' },
    { label: '60+ days', value: '$2,400', bar: '7%', tone: '#DC2626' },
  ];
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '14px',
        padding: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '15px' }}>
          Accounts receivable
        </span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
          outstanding by age
        </span>
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: '28px',
          letterSpacing: '-0.02em',
          marginTop: '10px',
        }}
      >
        $52,100
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: '13px',
          color: 'var(--color-text-tertiary)',
          marginBottom: '20px',
        }}
      >
        across 41 open invoices
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
            >
              <span
                style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}
              >
                {r.label}
              </span>
              <span style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 500 }}>
                {r.value}
              </span>
            </div>
            <span
              style={{
                display: 'block',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-bg-subtle)',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: r.bar,
                  backgroundColor: r.tone,
                  borderRadius: '9999px',
                  opacity: 0.9,
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BULK / PO ORDERING ──────────────────────────────────────────────────────
export function B2bBulkPo() {
  const rows = [
    {
      title: 'PO number at checkout',
      body: 'Buyers enter their purchase-order number when they place an order; it rides onto the invoice and every statement, so AP can reconcile without a phone call.',
    },
    {
      title: 'Saved carts & one-click reorder',
      body: 'Accounts keep named saved carts and reorder a past order in a click — the routine wholesale buy that doesn’t need a fresh quote every time.',
    },
    {
      title: 'Quantity rules per account',
      body: 'Set minimum and maximum order quantities, case packs, and minimum order values per product per account — the rules that make wholesale wholesale.',
    },
    {
      title: 'Approval holds over a threshold',
      body: 'Orders above a configured amount hold for staff approval before they’re placed — and so do orders that would push an account over its credit limit.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Ordering the way buyers actually order"
        lede="Wholesale isn’t a retail cart with a bigger total. POs, saved carts, case quantities, and approval thresholds are built into the same checkout — so a routine reorder is one click and a big first order routes for sign-off."
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '20px' }}>
        {rows.map((r) => (
          <div
            key={r.title}
            style={{
              display: 'flex',
              gap: '16px',
              padding: '26px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: '9px',
                backgroundColor: M.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Dot color={M.color} size={9} />
            </span>
            <div>
              <h3
                style={{
                  margin: '0 0 6px',
                  fontFamily: SANS,
                  fontSize: '16px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}
              >
                {r.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '13.5px',
                  lineHeight: '21px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {r.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
