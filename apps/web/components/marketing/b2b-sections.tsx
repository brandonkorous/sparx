import { Dot, getModuleColor, moduleTint, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * Two structural devices for the /b2b page, split out of b2b-page.tsx:
 *
 *  - B2bPriceList .... account-specific pricing: the account card beside a
 *    same-SKU "list price vs account price" panel — proves login decides price.
 *  - B2bRfq .......... the RFQ → quote → order flow as a connected 4-stage rail.
 *
 * Both crossfade through EXAMPLE_BUSINESSES so neither anchors on one vertical.
 * Grounded in docs/10 (B2B PRD) + the real dashboard B2B surfaces (pricing tiers
 * "% off list", account overrides, the quote lifecycle). B2B slate is a signal,
 * not fill. (The hero + account card live in b2b-hero.tsx.)
 */

const M = getModuleColor('b2b');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── ACCOUNT PRICE LIST (same SKU, account-specific price) ───────────────────
export function B2bPriceList() {
  return (
    <Section id="price-list" surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Login decides the price"
        lede="Build pricing tiers — a percentage off list, a fixed price, or a per-product price list — and assign them to accounts. When a buyer signs in, the catalog and checkout already show their negotiated price. No manual quoting for everyday orders."
      />
      <div className="mkt-b2b-split" style={{ marginTop: '52px' }}>
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <PriceTierCard key={b.domain} business={b} />
          ))}
        />
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <PriceListPanel key={b.domain} business={b} />
          ))}
        />
      </div>
    </Section>
  );
}

/** Left card: who the account is and which tier resolves their price. */
function PriceTierCard({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
  const rows: [string, string][] = [
    ['Pricing tier', b2b.tier],
    ['Tier discount', b2b.tierDiscount],
    ['Payment terms', b2b.terms],
  ];
  return (
    <div
      style={{
        backgroundColor: moduleTint(M.color),
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        height: '100%',
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: M.text,
        }}
      >
        logged-in account
      </span>
      <div>
        <div
          style={{ fontFamily: SANS, fontWeight: 500, fontSize: '20px', letterSpacing: '-0.01em' }}
        >
          {b2b.account}
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            marginTop: '4px',
          }}
        >
          {b2b.buyer}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
        {rows.map(([l, v]) => (
          <div
            key={l}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: SANS,
              fontSize: '13.5px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--color-base-200)',
            }}
          >
            <span
              style={{ color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)' }}
            >
              {l}
            </span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: 'auto' }}>
        <Dot color={M.color} size={7} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          resolves automatically at checkout
        </span>
      </div>
    </div>
  );
}

/** Right panel: the SAME catalog SKU shown at list price vs the account price. */
function PriceListPanel({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
  const save = formatSaving(b2b.priceList.list, b2b.priceList.account);
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        className="mkt-pricerow-head"
        style={{
          borderBottom: '1px solid var(--color-base-300)',
          backgroundColor: 'var(--color-base-200)',
        }}
      >
        {['Catalog item', 'List price', `${b2b.tier} price`, 'You save'].map((h) => (
          <span
            key={h}
            style={{
              fontFamily: MONO,
              fontSize: '10.5px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            {h}
          </span>
        ))}
      </div>
      <div className="mkt-pricerow" style={{ borderBottom: '1px solid var(--color-base-200)' }}>
        <span
          className="mkt-pricerow-item"
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              backgroundColor: 'var(--color-base-200)',
              flexShrink: 0,
              boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.05)',
            }}
          />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}>
              {b2b.priceList.item}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {b2b.priceList.sku}
            </span>
          </span>
        </span>
        <span
          className="mkt-pricerow-cell"
          style={{
            fontFamily: SANS,
            fontSize: '14px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            textDecoration: 'line-through',
          }}
        >
          {b2b.priceList.list}
        </span>
        <span
          className="mkt-pricerow-cell"
          style={{
            fontFamily: SANS,
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--color-base-content)',
          }}
        >
          {b2b.priceList.account}
        </span>
        <span
          className="mkt-pricerow-cell"
          style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 500, color: M.text }}
        >
          {save}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '14px 22px',
          backgroundColor: 'var(--color-base-200)',
        }}
      >
        <Dot color={M.color} size={6} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          same SKU as retail · account override + tier resolve the price
        </span>
      </div>
    </div>
  );
}

// ── RFQ → QUOTE → ORDER FLOW ────────────────────────────────────────────────
export function B2bRfq() {
  const stages = [
    {
      n: '01 · request',
      title: 'Buyer submits an RFQ',
      body: 'From the catalog, the buyer builds a request — quantities, delivery needs, notes — and submits it. It lands in your dashboard, separate from the cart.',
    },
    {
      n: '02 · review',
      title: 'You price it',
      body: 'Open the quote, set line-item pricing (markup rules help), add notes and an expiry date. Margin shows as you price, off the cost basis.',
    },
    {
      n: '03 · quoted',
      title: 'Sent back',
      body: 'The buyer gets a branded quote PDF, valid until the expiry. The lifecycle is tracked: submitted, under review, quoted — nothing lost in email.',
    },
    {
      n: '04 · order',
      title: 'Accepted → converted',
      body: 'On accept, the quote converts straight to an order at the quoted prices — through the same checkout, inventory, and fulfillment as every other order.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Request, quote, order — one flow"
        lede="Not every wholesale order is a fixed-price reorder. When a buyer needs a custom quote, the RFQ runs end to end inside sparx — request to priced quote to a real order — with the lifecycle tracked the whole way."
      />
      <div
        className="mkt-pipeline"
        style={{ marginTop: '52px', backgroundColor: 'var(--color-base-100)' }}
      >
        {stages.map((s, i) => (
          <div
            key={s.n}
            className="mkt-stage"
            style={{
              position: 'relative',
              padding: '26px 24px 28px',
              minHeight: '196px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {s.n}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '18px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
              }}
            >
              <Dot color={M.color} size={8} />
              {s.title}
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
              {s.body}
            </p>
            {i < stages.length - 1 ? (
              <span
                className="mkt-hide-on-tablet"
                style={{
                  position: 'absolute',
                  right: '-11px',
                  top: '38px',
                  zIndex: 2,
                  width: 22,
                  height: 22,
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-base-100)',
                  border: '1px solid var(--color-base-300)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: M.color,
                }}
              >
                <ArrowRight size={13} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Parse two formatted USD prices and return a "$X.XX" saving. Used only on the
 *  fixture data, which is always well-formed "$1,234.56" — no NaN path needed. */
function formatSaving(list: string, account: string): string {
  const toNum = (s: string) => Number(s.replace(/[$,]/g, ''));
  const diff = toNum(list) - toNum(account);
  return `$${diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ArrowRight({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
