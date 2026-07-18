import type { ReactNode } from 'react';
import { Dot, getModuleColor, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The two markup-heavy structural devices for the /commerce page, split out of
 * commerce-page.tsx so each file stays cohesive:
 *
 *  - CommerceJourney — the order pipeline (catalog → cart → checkout →
 *    fulfilled), a connected 4-stage rail that traces one order end to end.
 *  - CommerceCheckout — an annotated real single-page sparx checkout frame
 *    with A/B/C/D callout pins keyed to each conversion feature.
 *
 * Grounded in docs/09 (e-commerce PRD). Commerce orange is a signal, not fill.
 */

const C = getModuleColor('commerce');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── ORDER JOURNEY (pipeline) ────────────────────────────────────────────────
export function CommerceJourney() {
  const stages = [
    {
      n: '01 · catalog',
      title: 'Added to cart',
      body: 'Products, variants, and collections — the matrix of color, size, and SKU. Price and stock are read live, never cached stale.',
    },
    {
      n: '02 · cart',
      title: 'Validated',
      body: 'Inventory re-checked, discounts re-validated, B2B account pricing applied. Abandoned carts fire an email automation.',
    },
    {
      n: '03 · checkout',
      title: 'Paid',
      body: 'Single-page checkout, live tax and shipping, a Stripe payment intent confirmed on submit. Inventory decrements atomically.',
    },
    {
      n: '04 · fulfillment',
      title: 'Shipped',
      body: 'Pick, pack, add tracking — partial shipments allowed. Tracking triggers the shipping email; refunds restock and return via Stripe.',
    },
  ];
  return (
    <Section id="journey" surface="surface" padding="lg">
      <SectionHeader
        accent={C.color}
        headline="One order, catalog to fulfilled"
        lede="Every order travels the same path on one database — no webhooks trading state at 3am, no sync to drift. Stock, pricing, and customer history are all re-checked as it moves."
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
              minHeight: '184px',
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
              <Dot color={C.color} size={8} />
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
                  color: C.color,
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

// ── ANNOTATED CHECKOUT FRAME ────────────────────────────────────────────────
export function CommerceCheckout() {
  const pins = [
    {
      n: 'A',
      title: 'Address autocomplete',
      body: 'Suggestions as they type — fewer failed deliveries, fewer typos, faster fills.',
    },
    {
      n: 'B',
      title: 'Wallets & one-click',
      body: 'Apple Pay, Google Pay, and Link — Stripe’s one-click checkout — for buyers in a hurry.',
    },
    {
      n: 'C',
      title: 'Saved payment methods',
      body: 'Returning customers skip the card form entirely. 3D Secure and SCA handled automatically.',
    },
    {
      n: 'D',
      title: 'Live tax & shipping',
      body: 'TaxJar or Avalara for tax; carrier rates via EasyPost. Totals update before they pay.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={C.color}
        headline="A checkout built to convert"
        lede="One page, not a five-screen funnel. Address autocomplete, saved payment methods, and the wallets your customers already use — all wired in, all conversion-tuned out of the box."
      />
      <div className="mkt-frame-grid" style={{ marginTop: '52px' }}>
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <CheckoutBrowser key={b.domain} business={b} />
          ))}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {pins.map((p) => (
            <div
              key={p.n}
              style={{
                display: 'flex',
                gap: '13px',
                padding: '18px 20px',
                border: '1px solid var(--color-base-300)',
                borderRadius: '12px',
              }}
              // The module hue rides the soft wash, NOT a 3px left stripe — the
              // stripe is a retired brand device (and the most recognizable
              // generated-UI tell). Same treatment as every other module card.
              className={`${C.bg} bg-soft`}
            >
              <span
                className={C.ink}
                style={{
                  fontFamily: MONO,
                  fontSize: '12px',
                  flexShrink: 0,
                  paddingTop: '1px',
                }}
              >
                {p.n}
              </span>
              <div>
                <h4
                  style={{
                    margin: '0 0 4px',
                    fontFamily: SANS,
                    fontSize: '14.5px',
                    fontWeight: 500,
                  }}
                >
                  {p.title}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontFamily: SANS,
                    fontSize: '13px',
                    lineHeight: '20px',
                    color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  }}
                >
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CheckoutBrowser({ business }: { business: ExampleBusiness }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
        backgroundColor: 'var(--color-base-100)',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-base-300)',
          backgroundColor: 'var(--color-base-200)',
        }}
      >
        <span style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              style={{ width: 10, height: 10, borderRadius: '9999px', backgroundColor: '#E0E0E4' }}
            />
          ))}
        </span>
        <span
          style={{
            marginLeft: '8px',
            fontFamily: MONO,
            fontSize: '12px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            backgroundColor: 'var(--color-base-100)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '7px',
            padding: '5px 12px',
            flex: 1,
          }}
        >
          {business.domain}/checkout
        </span>
      </div>
      <div className="mkt-checkout">
        <CheckoutForm business={business} />
        <CheckoutSummary business={business} />
      </div>
    </div>
  );
}

function CheckoutForm({ business }: { business: ExampleBusiness }) {
  const field = (children: ReactNode, key?: string) => (
    <div
      key={key}
      style={{
        border: '1px solid var(--color-base-300)',
        borderRadius: '9px',
        padding: '11px 13px',
        fontFamily: SANS,
        fontSize: '13.5px',
        backgroundColor: 'var(--color-base-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {children}
    </div>
  );
  const step = (label: string) => (
    <span
      className={C.ink}
      style={{
        fontFamily: MONO,
        fontSize: '11px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
  const ph = { color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' };
  return (
    <div style={{ padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {step('Contact & shipping')}
      {field(<span style={{ color: 'var(--color-base-content)' }}>{business.customer.email}</span>)}
      {field(
        <>
          <span style={{ color: 'var(--color-base-content)' }}>
            {business.customer.address}
            <span style={ph}> · suggested</span>
          </span>
          <Dot color={C.color} size={7} />
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {field(<span style={ph}>City</span>, 'city')}
        {field(<span style={ph}>ZIP</span>, 'zip')}
      </div>
      {step('Payment')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {['Apple Pay', 'Link'].map((w) => (
          <span
            key={w}
            style={{
              border: '1px solid var(--color-base-300)',
              borderRadius: '9px',
              padding: '11px',
              textAlign: 'center',
              fontFamily: SANS,
              fontSize: '13px',
              fontWeight: 500,
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              backgroundColor: 'var(--color-base-100)',
            }}
          >
            {w}
          </span>
        ))}
      </div>
      {field(
        <>
          <span style={ph}>Card ending 4242</span>
          <span
            style={{
              fontFamily: MONO,
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              fontSize: '11px',
            }}
          >
            saved
          </span>
        </>
      )}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '9px',
          padding: '14px',
          borderRadius: '10px',
          backgroundColor: C.color,
          color: '#FFFFFF',
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: '15px',
        }}
      >
        Pay {business.order.total}
        <Check size={15} color="#FFFFFF" />
      </span>
    </div>
  );
}

function CheckoutSummary({ business }: { business: ExampleBusiness }) {
  const items = business.order.products.map((p): [string, string] => [
    `${p.name} ×${p.qty}`,
    p.price,
  ]);
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-200)',
        borderLeft: '1px solid var(--color-base-300)',
        padding: '26px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontSize: '13px',
          fontWeight: 500,
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        Order summary
      </span>
      {items.map(([t, amt]) => (
        <div
          key={t}
          style={{
            display: 'flex',
            gap: '11px',
            alignItems: 'center',
            fontFamily: SANS,
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: '7px',
              backgroundColor: 'var(--color-base-200)',
              flexShrink: 0,
            }}
          />
          <span>{t}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--color-base-content)' }}>{amt}</span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: SANS,
          fontSize: '13px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          paddingTop: '12px',
          borderTop: '1px solid var(--color-base-300)',
        }}
      >
        <span>Shipping</span>
        <span>{business.order.shipping.value}</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: SANS,
          fontSize: '13px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        <span>Tax</span>
        <span>{business.order.tax.value}</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: SANS,
          fontWeight: 500,
          paddingTop: '12px',
          borderTop: '1px solid var(--color-base-300)',
        }}
      >
        <span>Total</span>
        <span style={{ fontSize: '20px', letterSpacing: '-0.02em' }}>{business.order.total}</span>
      </div>
    </div>
  );
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

function Check({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
