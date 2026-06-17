import { Dot, getModuleColor, type MarketingModule, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The remaining structural devices for the /b2b page, split out of b2b-page.tsx:
 *
 *  - B2bTerms ........ net terms & credit: an account's terms + credit bar beside
 *    the A/R aging ledger (current → 60+), the cashflow-risk view.
 *  - B2bBulkPo ....... bulk / PO ordering: how a wholesale order is placed (PO
 *    number, saved cart reorder, approval hold) as labeled rows.
 *  - B2bFleet ........ fleet & service scheduling (industry-neutral capability).
 *  - B2bSameEngine ... the "D2C + B2B on one engine" beat — retail vs wholesale
 *    columns over one shared catalog/checkout/record.
 *
 * Grounded in docs/10 (B2B PRD) + the real dashboard B2B surfaces (credit
 * limit/used, A/R aging buckets, approval rules, fleet/engine profiles,
 * service-types/appointments). B2B slate is a signal, not fill.
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
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderTop: `3px solid ${M.color}`,
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

// ── FLEET & SERVICE SCHEDULING (industry-neutral capability) ─────────────────
export function B2bFleet() {
  const points = [
    {
      title: 'Fitment-aware catalog',
      body: 'Accounts with a registered fleet see a “fits your fleet” badge and fitment-matched products first — relevant parts surface, incompatible ones still browse with a warning.',
    },
    {
      title: 'Bookable service',
      body: 'Define service types with durations and daily capacity; customers book appointments from the portal, tied to the account, with confirmations and reminders via sparx Email.',
    },
    {
      title: 'History per unit',
      body: 'Service history records against the vehicle in the fleet profile, and parts from an order link to the appointment — the full picture for the next visit.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Fleet and service, when the account needs it"
        lede="For accounts that run equipment or vehicles, sparx stores a fleet profile and books service against it. It’s one capability of the module — a salon-products or office-coffee distributor never touches it, while a parts-and-service supplier leans on it daily."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {points.map((p) => (
          <div
            key={p.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '26px',
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
              minHeight: '186px',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                backgroundColor: M.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Dot color={M.color} size={9} />
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
              {p.title}
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
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── SAME ENGINE: D2C + B2B ──────────────────────────────────────────────────
export function B2bSameEngine() {
  const cols: {
    tag: string;
    title: string;
    body: string;
    points: string[];
    accent: MarketingModule;
  }[] = [
    {
      tag: 'retail · D2C',
      title: 'Your storefront',
      body: 'List price, public catalog, card and wallet checkout — the orders you take from anyone who lands on the site.',
      points: [
        'List pricing, open catalog, guest checkout.',
        'Cards, Apple Pay, Google Pay, Link via Stripe.',
        'Same inventory, same order timeline, same reports.',
      ],
      accent: 'commerce',
    },
    {
      tag: 'wholesale · B2B',
      title: 'Your account book',
      body: 'The same catalog, but a logged-in buyer sees their tier price, pays on net terms with a PO, and can request a quote.',
      points: [
        'Account price lists, credit limits, net terms.',
        'RFQ → quote, bulk POs, approval holds.',
        'A second sales channel, not a second platform.',
      ],
      accent: 'b2b',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Retail and wholesale, one engine underneath"
        lede="B2B isn’t a separate store you keep in sync. It’s a sales channel layered on Commerce — the same products, inventory, checkout, and customer record, with account pricing and terms switched on for the buyers who get them."
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '24px' }}>
        {cols.map((c) => {
          const accent = getModuleColor(c.accent);
          return (
            <div
              key={c.title}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '32px',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                borderTop: `3px solid ${accent.color}`,
                borderRadius: '14px',
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: accent.text,
                }}
              >
                {c.tag}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '24px',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '15px',
                  lineHeight: '24px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {c.body}
              </p>
              <ul
                style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}
              >
                {c.points.map((p) => (
                  <li key={p} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                    <span style={{ paddingTop: '7px', flexShrink: 0 }}>
                      <Dot color={accent.color} size={7} />
                    </span>
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: '14.5px',
                        lineHeight: '23px',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p
        style={{
          marginTop: '20px',
          fontFamily: SANS,
          fontSize: '14px',
          lineHeight: '22px',
          color: 'var(--color-text-tertiary)',
          maxWidth: '700px',
        }}
      >
        B2B requires Commerce — it’s wholesale on top of the commerce engine, so they run as one and
        bill as one. See{' '}
        <a href="/commerce" style={{ color: M.text, fontWeight: 500 }}>
          Commerce
        </a>{' '}
        for the retail side.
      </p>
    </Section>
  );
}
