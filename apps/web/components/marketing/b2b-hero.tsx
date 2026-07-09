import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Dot, getModuleColor, Spark } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The /b2b hero — a tinted-band split: copy on the left, the WHOLESALE ACCOUNT
 * card on the right. The card crossfades through EXAMPLE_BUSINESSES (each treated
 * as a wholesale account the tenant sells to) so B2B reads as the engine for ANY
 * kind of account — hospitality, restaurant supply, salon, office, industrial
 * fleet — never anchored on one vertical. Every scene has the same shape (tier,
 * net terms, credit limit/used, an open quote) so the card never reflows.
 *
 * Grounded in docs/10 (B2B PRD) + the real dashboard B2B account surface. B2B
 * slate is a signal, not fill; the band is the light slate tint with near-black
 * ink. See feedback-industry-agnostic-no-diesel + the rotation rule.
 */

const M = getModuleColor('b2b');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

export function B2bHero() {
  const lede =
    'sparx B2B is wholesale on the same engine as your retail orders — one catalog, one checkout, one customer record. Each business buyer logs in to their own price list, their net terms, and an RFQ-to-quote flow. Account pricing, credit limits, bulk POs, and fleet accounts — native, not a bolt-on. Pair the Scheduling module to book service against a fleet.';
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
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
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
                    backgroundColor: 'var(--color-base-100)',
                    border: '1px solid var(--color-base-300)',
                    borderRadius: '9999px',
                  }}
                >
                  <Dot color={M.color} size={6} />
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: '12px',
                      color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
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
 *  net terms, credit, and an open quote. */
function AccountCard({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '16px',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
        overflow: 'hidden',
      }}
    >
      <AccountHeader b2b={b2b} />
      <AccountStats b2b={b2b} />
      <AccountCredit b2b={b2b} />
    </div>
  );
}

function AccountHeader({ b2b }: { b2b: ExampleBusiness['b2b'] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '13px',
        padding: '18px 20px',
        borderBottom: '1px solid var(--color-base-300)',
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
        <span
          style={{
            fontFamily: MONO,
            fontSize: '12px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          B2B account · {b2b.terms}
        </span>
      </span>
      <span
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
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
  );
}

function AccountStats({ b2b }: { b2b: ExampleBusiness['b2b'] }) {
  const cells: [string, string][] = [
    [b2b.tierDiscount.replace(' off list', ''), 'price tier'],
    [b2b.creditLimit, 'credit limit'],
    [b2b.creditUsedPct, 'credit used'],
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        borderBottom: '1px solid var(--color-base-300)',
      }}
    >
      {cells.map(([v, l], i) => (
        <div
          key={l}
          style={{
            padding: '14px 16px',
            borderLeft: i === 0 ? 'none' : '1px solid var(--color-base-200)',
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
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              marginTop: '2px',
            }}
          >
            {l}
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountCredit({ b2b }: { b2b: ExampleBusiness['b2b'] }) {
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: '10.5px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
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
          backgroundColor: 'var(--color-base-200)',
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
          backgroundColor: 'var(--color-base-200)',
          border: '1px solid var(--color-base-300)',
          borderRadius: '10px',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: '12px', color: M.text, flexShrink: 0 }}>
          {b2b.quote.number}
        </span>
        <span
          style={{
            fontFamily: SANS,
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
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
  );
}
