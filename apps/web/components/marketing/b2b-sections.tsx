import { Button } from '@sparx/ui';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  Section,
  SectionHeader,
  Spark,
} from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The markup-heavy structural devices for the /b2b page, split out of
 * b2b-page.tsx so each file stays cohesive:
 *
 *  - B2bHero ......... tinted-band hero: split copy + the WHOLESALE ACCOUNT card
 *    (tier, net terms, credit limit/used, an open quote) that crossfades through
 *    EXAMPLE_BUSINESSES so B2B reads as the engine for ANY kind of account.
 *  - B2bPriceList .... account-specific pricing: the account card beside a
 *    same-SKU "list price vs account price" panel — proves login determines price.
 *  - B2bRfq .......... the RFQ → quote → order flow as a connected 4-stage rail.
 *
 * Grounded in docs/10 (B2B PRD) + the real dashboard B2B surfaces (accounts,
 * pricing tiers "% off list", credit limit/used, payment terms, the quote
 * lifecycle). B2B slate is a signal, not fill. B2B layers on Commerce.
 */

const M = getModuleColor('b2b');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── HERO ──────────────────────────────────────────────────────────────────────
export function B2bHero() {
  const lede =
    'sparx B2B is wholesale on the same engine as your retail orders — one catalog, one checkout, one customer record. Each business buyer logs in to their own price list, their net terms, and an RFQ-to-quote flow. Account pricing, credit limits, bulk POs, fleet and service scheduling — native, not a bolt-on.';
  const chips = ['account price lists', 'net terms + credit', 'RFQ → quote', 'layered on commerce'];
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
              Wholesale, done right
              <Spark color={M.color} />
            </Display>
            <p
              style={{
                fontFamily: SANS,
                fontWeight: 400,
                fontSize: 'clamp(16px, 1.6vw, 20px)',
                lineHeight: 1.55,
                color: 'var(--color-text-secondary)',
                maxWidth: '580px',
                margin: '28px 0 0',
              }}
            >
              {lede}
            </p>
            <div className="mkt-cluster" style={{ gap: '12px', marginTop: '34px' }}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Activate B2B →
              </Button>
              <a href="#price-list">
                <Button size="lg" variant="outline">
                  See account pricing
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
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <AccountCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — one real wholesale account: its tier,
 *  net terms, credit, and an open quote. Crossfades through EXAMPLE_BUSINESSES;
 *  every scene has the same shape so the card never reflows. */
function AccountCard({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
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
            borderRadius: '10px',
            backgroundColor: M.tint,
            border: `1.5px solid ${M.color}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Dot color={M.color} size={9} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: SANS, fontWeight: 500, fontSize: '16px' }}>
            {b2b.account}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            B2B account · {b2b.terms}
          </span>
        </span>
        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '5px 11px',
            borderRadius: '9999px',
            backgroundColor: M.tint,
            color: M.text,
            fontFamily: SANS,
            fontSize: '12px',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {b2b.tier}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        {[
          [b2b.tierDiscount.replace(' off list', ''), 'price tier'],
          [b2b.creditLimit, 'credit limit'],
          [b2b.creditUsedPct, 'credit used'],
        ].map(([v, l], i) => (
          <div
            key={l}
            style={{
              padding: '14px 16px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--color-bg-subtle)',
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '17px',
                letterSpacing: '-0.01em',
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                marginTop: '2px',
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '10.5px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-tertiary)',
            }}
          >
            credit · {b2b.creditUsed} of {b2b.creditLimit}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: M.text }}>
            {b2b.creditUsedPct}
          </span>
        </div>
        <span
          style={{
            display: 'block',
            height: '7px',
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '4px',
            padding: '12px 14px',
            backgroundColor: 'var(--color-bg-page)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '10px',
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: '12px', color: M.text, flexShrink: 0 }}>
            {b2b.quote.number}
          </span>
          <span
            style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}
          >
            {b2b.quote.lines} lines · {b2b.quote.total}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: SANS,
              fontSize: '11.5px',
              fontWeight: 500,
              padding: '3px 9px',
              borderRadius: '9999px',
              backgroundColor: M.tint,
              color: M.text,
              flexShrink: 0,
            }}
          >
            {b2b.quote.status}
          </span>
        </div>
      </div>
    </div>
  );
}

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
            color: 'var(--color-text-tertiary)',
            marginTop: '4px',
          }}
        >
          {b2b.buyer}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
        {[
          ['Pricing tier', b2b.tier],
          ['Tier discount', b2b.tierDiscount],
          ['Payment terms', b2b.terms],
        ].map(([l, v]) => (
          <div
            key={l}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: SANS,
              fontSize: '13.5px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--color-bg-subtle)',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary)' }}>{l}</span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: 'auto' }}>
        <Dot color={M.color} size={7} />
        <span style={{ fontFamily: MONO, fontSize: '11.5px', color: 'var(--color-text-tertiary)' }}>
          resolves automatically at checkout
        </span>
      </div>
    </div>
  );
}

/** Right panel: the SAME catalog SKU shown at list price vs the account price. */
function PriceListPanel({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
  const list = b2b.priceList.list;
  const acct = b2b.priceList.account;
  const save = formatSaving(list, acct);
  const rows: { item: string; sku: string; list: string; account: string; save: string }[] = [
    { item: b2b.priceList.item, sku: b2b.priceList.sku, list, account: acct, save },
  ];
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        className="mkt-pricerow-head"
        style={{
          borderBottom: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-bg-page)',
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
              color: 'var(--color-text-tertiary)',
            }}
          >
            {h}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          key={r.sku}
          className="mkt-pricerow"
          style={{ borderBottom: '1px solid var(--color-bg-subtle)' }}
        >
          <span
            className="mkt-pricerow-item"
            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                backgroundColor: 'var(--color-bg-subtle)',
                flexShrink: 0,
                boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.05)',
              }}
            />
            <span style={{ minWidth: 0 }}>
              <span
                style={{ display: 'block', fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}
              >
                {r.item}
              </span>
              <span
                style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--color-text-tertiary)' }}
              >
                {r.sku}
              </span>
            </span>
          </span>
          <span
            className="mkt-pricerow-cell"
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              color: 'var(--color-text-tertiary)',
              textDecoration: 'line-through',
            }}
          >
            {r.list}
          </span>
          <span
            className="mkt-pricerow-cell"
            style={{
              fontFamily: SANS,
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
            }}
          >
            {r.account}
          </span>
          <span
            className="mkt-pricerow-cell"
            style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 500, color: M.text }}
          >
            {r.save}
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '14px 22px',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <Dot color={M.color} size={6} />
        <span style={{ fontFamily: MONO, fontSize: '11.5px', color: 'var(--color-text-tertiary)' }}>
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
        style={{ marginTop: '52px', backgroundColor: 'var(--color-bg-surface)' }}
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
                color: 'var(--color-text-tertiary)',
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
                color: 'var(--color-text-secondary)',
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
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
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
