import type { ReactNode } from 'react';
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
import { CommerceCheckout, CommerceJourney } from './commerce-sections';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';
import { Faq, type FaqItem } from './faq';

/**
 * The /commerce marketing page — Commerce is the **transactional core** of
 * sparx. The thesis is a single object told end to end: the ORDER. The page
 * traces one order from catalog → cart → checkout → fulfilled → the ledger, so
 * it reads as momentum (the energy of conversion) without becoming a loud "BUY
 * NOW" billboard. Commerce orange is a *signal* — the order line, the paid
 * badge, the descending fee bars, the spark — never flood fill.
 *
 * Bespoke + full-length, modeled on ai-page.tsx / builder-page.tsx; the
 * markup-heavy device sections (the order pipeline + the annotated checkout
 * frame) live in commerce-sections.tsx so each file stays cohesive.
 *
 * Facts are grounded in docs/09 (e-commerce PRD) + docs/17 (billing). Stripe is
 * the primary processor (no invented PayPal/Klarna); wallets are Apple Pay /
 * Google Pay / Link. Tax = TaxJar / Avalara, carrier rates = EasyPost. The
 * transaction fee is the real 0.5% → 0.3% → 0% ladder from billing §2. Flat
 * $49/mo with Invoicing bundled free — no tiers, no "+", no "Pro+".
 */
export function CommercePage() {
  return (
    <>
      <CommerceHero />
      <CommerceJourney />
      <CommerceCheckout />
      <PaymentsRail />
      <FeeLadder />
      <Operations />
      <HeadlessOrHosted />
      <CommerceProof />
      <CommercePricing />
      <Faq
        items={COMMERCE_FAQ}
        id="faq"
        heading={
          <>
            Commerce questions
            <Spark color={C.color} />
          </>
        }
        lede="Pricing, fees, payments, and how it fits your stack — answered straight. Still deciding? Read the commerce docs or start the 14-day trial."
      />
      <CommerceCta />
    </>
  );
}

const C = getModuleColor('commerce');
const BUILDER = getModuleColor('builder');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// Page-specific FAQ. Real evaluation questions for sparx Commerce, answered
// straight and grounded in docs/09 (PRD) + docs/17 (billing) — no tier/plan
// language. Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing.
const COMMERCE_FAQ: FaqItem[] = [
  {
    id: 'commerce-pricing',
    question: 'How much does sparx Commerce cost?',
    answer:
      'A flat $49/mo, with Invoicing included free. No tiers and no setup fee — turn Commerce on, add any other modules à la carte, and it all lands on one bill. Start on a 14-day free trial; no card required to begin.',
  },
  {
    id: 'commerce-fees',
    question: 'Is there a per-transaction fee?',
    answer:
      'A small one that steps down as you grow: 0.5% per transaction on Commerce alone, 0.3% once CRM is active, and 0% once your active modules total $299/mo or more. It is collected through Stripe Connect and is separate from Stripe’s own processing rate — you keep your Stripe account and your processor relationship.',
  },
  {
    id: 'commerce-headless',
    question: 'Do I need a storefront, or can I run Commerce headless?',
    answer:
      'Either. Run Commerce entirely through the REST API and the MCP server against your own frontend, or switch on Builder for a hosted storefront on your own domain. It is the same order data and the same checkout either way.',
  },
  {
    id: 'commerce-payments',
    question: 'Which payment methods are supported?',
    answer:
      'Stripe is the primary processor: credit and debit cards, Apple Pay, Google Pay, and Link (Stripe’s one-click checkout). Everything runs through Stripe Connect, so funds settle into your own account.',
  },
  {
    id: 'commerce-tax-shipping',
    question: 'How are tax and shipping handled?',
    answer:
      'Sales tax is calculated by TaxJar or Avalara; live carrier rates (FedEx, UPS, USPS) come from EasyPost, alongside flat-rate rules and local pickup. Connect your accounts and totals calculate at checkout before the customer pays.',
  },
  {
    id: 'commerce-b2b',
    question: 'Can the same store sell wholesale and B2B?',
    answer:
      'Yes — D2C and B2B run on one engine. Add the B2B module for account-specific pricing, net terms, and RFQs; those orders move through the same checkout, inventory, and fulfillment as your retail orders, all on one customer record.',
  },
];

// ── HERO ──────────────────────────────────────────────────────────────────────
function CommerceHero() {
  const lede =
    'Commerce is the transactional core of sparx — products and inventory, a checkout that converts, Stripe payments, and order operations that hold up at real volume. Run it headless on the API, or pair it with Builder for a hosted storefront. One order object, cart to fulfilled.';
  const chips = [
    'stripe payments',
    'headless or hosted',
    'D2C + B2B, one engine',
    'invoicing included',
  ];
  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-bg-page)',
      }}
    >
      <Container>
        <div
          className="mkt-stack-on-tablet"
          style={{ gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Display as="h1" size={88} lineHeight={84}>
              Sell, ship, get paid
              <Spark color={C.color} />
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
                Start selling →
              </Button>
              <a href="#journey">
                <Button size="lg" variant="outline">
                  See how an order flows
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
                  <Dot color={C.color} size={6} />
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
            <OrderReceipt />
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * The hero's product-surface proof — a real order object, not a faux dashboard.
 * Crossfades through EXAMPLE_BUSINESSES (the shared, app-wide fixture set) so
 * Commerce reads as the same engine for ANY business, never anchored on one
 * vertical. Each scene is a complete, coherent order; all share the two-line
 * shape so the card never reflows. <Cycle> pins to the first scene under
 * prefers-reduced-motion.
 */
function OrderReceipt() {
  return (
    <Cycle
      items={EXAMPLE_BUSINESSES.map((b) => (
        <ReceiptCard key={b.domain} business={b} />
      ))}
    />
  );
}

function ReceiptCard({ business }: { business: ExampleBusiness }) {
  const { order, customer } = business;
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
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Dot color={C.color} size={9} />
          <span>
            <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px' }}>
              {order.number}
            </span>
            <br />
            <span
              style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--color-text-tertiary)' }}
            >
              {customer.name} · just now
            </span>
          </span>
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '5px 11px',
            borderRadius: '9999px',
            backgroundColor: C.tint,
            color: C.text,
            fontFamily: SANS,
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <Check size={13} color={C.text} /> Paid
        </span>
      </div>
      {order.products.map((it) => (
        <div
          key={it.sku}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '13px',
            padding: '13px 20px',
            borderBottom: '1px solid var(--color-bg-subtle)',
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-subtle)',
              flexShrink: 0,
              boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.05)',
            }}
          />
          <span>
            <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}>{it.name}</span>
            <br />
            <span
              style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--color-text-tertiary)' }}
            >
              {it.sku} · qty {it.qty}
            </span>
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: SANS,
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
            }}
          >
            {it.price}
          </span>
        </div>
      ))}
      <div style={{ padding: '14px 20px' }}>
        {[
          ['Subtotal', order.subtotal],
          [order.shipping.label, order.shipping.value],
          [order.tax.label, order.tax.value],
        ].map(([l, v]) => (
          <div
            key={l}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: SANS,
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              padding: '4px 0',
            }}
          >
            <span>{l}</span>
            <span>{v}</span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: '8px',
            paddingTop: '12px',
            borderTop: '1px solid var(--color-border-default)',
          }}
        >
          <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}>Total</span>
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: '22px',
              letterSpacing: '-0.02em',
            }}
          >
            {order.total}
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '13px 20px',
          borderTop: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <Dot color={C.color} size={6} />
        <span style={{ fontFamily: MONO, fontSize: '11.5px', color: 'var(--color-text-tertiary)' }}>
          paid with {order.paidWith} · inventory decremented
        </span>
      </div>
    </div>
  );
}

// ── PAYMENTS RAIL ───────────────────────────────────────────────────────────
function PaymentsRail() {
  const methods = [
    { nm: 'Cards', ds: 'Every major card, 3D Secure and SCA handled automatically.' },
    { nm: 'Apple Pay', ds: 'One-tap on iPhone and Safari — no card entry, higher conversion.' },
    { nm: 'Google Pay', ds: 'The same one-tap path for Android and Chrome shoppers.' },
    { nm: 'Link', ds: 'Stripe’s one-click checkout — saved details across every Stripe store.' },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={C.color}
        headline="Stripe, plus the wallets they already use"
        lede="Payments run on Stripe as the primary processor — you keep your own Stripe account and relationship. sparx connects it through Stripe Connect; the methods below are on by default."
      />
      <div
        className="mkt-grid-4-2-1"
        style={{
          marginTop: '48px',
          gap: 0,
          border: '1px solid var(--color-border-default)',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        {methods.map((m, i) => (
          <div
            key={m.nm}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '28px 26px',
              backgroundColor: 'var(--color-bg-surface)',
              borderLeft: i === 0 ? 'none' : '1px solid var(--color-border-default)',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: '9px',
                backgroundColor: C.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '4px',
              }}
            >
              <Dot color={C.color} size={9} />
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '16px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {m.nm}
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '13px',
                lineHeight: '20px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {m.ds}
            </span>
          </div>
        ))}
      </div>
      <p
        style={{
          marginTop: '18px',
          fontFamily: SANS,
          fontSize: '14px',
          lineHeight: '22px',
          color: 'var(--color-text-tertiary)',
          maxWidth: '720px',
        }}
      >
        Test mode runs against staging, payment intents confirm on submit, and refunds return to the
        original method. Need net terms or a PO at checkout instead?{' '}
        <a href="/b2b" style={{ color: C.text, fontWeight: 500 }}>
          That&rsquo;s B2B
        </a>
        , layered on the same engine.
      </p>
    </Section>
  );
}

// ── FEE LADDER ──────────────────────────────────────────────────────────────
function FeeLadder() {
  const rungs = [
    {
      when: 'Commerce only',
      pct: '0.5%',
      pctSize: 52,
      pctColor: C.color,
      barW: '100%',
      barColor: C.color,
      body: 'The base rate, per transaction, on top of your own Stripe processing. That’s the whole sparx fee.',
    },
    {
      when: 'With CRM',
      pct: '0.3%',
      pctSize: 64,
      pctColor: C.color,
      barW: '60%',
      barColor: C.color,
      body: 'Add CRM and the per-transaction fee drops — the more of the spine you use, the less each order costs you.',
    },
    {
      when: 'At $299+ / mo of modules',
      pct: '0%',
      pctSize: 76,
      pctColor: 'var(--color-text-primary)',
      barW: '12%',
      barColor: '#0A0A0A',
      body: 'Once your active modules total $299 a month or more, the per-transaction fee disappears entirely.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={C.color}
        headline="A transaction fee that shrinks as you grow"
        lede="One honest line, no asterisks. sparx takes a small per-transaction fee on Commerce — and it steps down the more of the platform you run, all the way to nothing."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px', alignItems: 'end' }}>
        {rungs.map((r) => (
          <div
            key={r.when}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '14px',
              padding: '26px 26px 28px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '12px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {r.when}
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                fontSize: `clamp(48px, 7vw, ${r.pctSize}px)`,
                color: r.pctColor,
              }}
            >
              {r.pct}
            </span>
            <span
              style={{
                height: '6px',
                borderRadius: '9999px',
                width: r.barW,
                backgroundColor: r.barColor,
                opacity: 0.85,
              }}
            />
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
        ))}
      </div>
      <p
        style={{
          marginTop: '20px',
          fontFamily: SANS,
          fontSize: '14px',
          lineHeight: '22px',
          color: 'var(--color-text-tertiary)',
          maxWidth: '680px',
        }}
      >
        The fee is taken through Stripe Connect and is separate from Stripe&rsquo;s own processing
        rate. No per-seat charges, no per-product metering — see{' '}
        <a href="/pricing" style={{ color: C.text, fontWeight: 500 }}>
          full pricing
        </a>
        .
      </p>
    </Section>
  );
}

// ── OPERATIONS GRID ─────────────────────────────────────────────────────────
function Operations() {
  const ops = [
    {
      title: 'Inventory that tracks',
      body: 'Per-variant counts, deny or backorder policy, low-stock thresholds that publish alerts. Bulk-adjust by CSV or API.',
    },
    {
      title: 'Discounts & promotions',
      body: 'Percentage, fixed amount, free shipping, buy-X-get-Y. Code or automatic, with minimums, date windows, and usage limits.',
    },
    {
      title: 'Refunds & returns',
      body: 'Full or partial, back to the original method via Stripe. Inventory restocks on refund, with the reason recorded for reporting.',
    },
    {
      title: 'Order timeline',
      body: 'Placed, paid, noted, fulfilled, tracked, refunded — every event in order, with staff notes and customer-visible notes.',
    },
    {
      title: 'Reports that matter',
      body: 'Revenue by period, top products and customers, AOV trend, inventory valuation, and the sessions-to-purchase funnel.',
    },
    {
      title: 'Built for real volume',
      body: 'Multi-fulfillment partial shipments, bulk order operations, and full CSV exports — order ops that scale with shipping.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={C.color}
        headline={<>Everything after &ldquo;paid&rdquo;</>}
        lede="The order is only the start. Commerce ships the operations that make selling sustainable at real volume — inventory, promotions, refunds, reporting, and bulk tooling."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {ops.map((o) => (
          <div
            key={o.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '26px',
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
              minHeight: '178px',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                backgroundColor: C.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Dot color={C.color} size={9} />
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
              {o.title}
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
              {o.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── HEADLESS / HOSTED ───────────────────────────────────────────────────────
function HeadlessOrHosted() {
  const ways: {
    tag: string;
    title: string;
    body: string;
    points: string[];
    dot: string;
    runs: string;
  }[] = [
    {
      tag: 'commerce + your stack',
      title: 'Run it headless',
      body: 'Every capability is an API endpoint first; the dashboard is one consumer among many. Build your own front end, or let an AI assistant work the catalog and orders over MCP.',
      points: [
        'Full REST + GraphQL surface — catalog, cart, checkout, orders.',
        'SSR-ready with CDN caching for sub-200ms TTFB.',
        'Read and write live commerce data from Claude, ChatGPT, or Copilot.',
      ],
      dot: C.color,
      runs: 'Commerce + API · MCP',
    },
    {
      tag: 'commerce + builder',
      title: 'Get a hosted storefront',
      body: 'Pair Commerce with Builder and the storefront renders for you — product pages, collections, cart, and the converting checkout — on your custom domain, SSL and CDN handled.',
      points: [
        'Product, collection, cart, and account pages out of the box.',
        'Full-text product search with filters and sort.',
        'Your theme and brand — selling shares one design system with the rest of the site.',
      ],
      dot: BUILDER.color,
      runs: 'Commerce + Builder',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={C.color}
        headline="Headless, hosted, or both"
        lede="Commerce is the engine, not the front end. Drive it entirely through the API and MCP, or switch on Builder and get a hosted storefront on your own domain — same data either way."
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '24px' }}>
        {ways.map((w) => (
          <div
            key={w.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '32px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderTop: `3px solid ${C.color}`,
              borderRadius: '14px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: C.text,
              }}
            >
              {w.tag}
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
              {w.title}
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
              {w.body}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
              {w.points.map((p) => (
                <li key={p} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                  <span style={{ paddingTop: '7px', flexShrink: 0 }}>
                    <Dot color={w.dot} size={7} />
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
            <span
              style={{
                fontFamily: MONO,
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                marginTop: 'auto',
                paddingTop: '4px',
              }}
            >
              {w.runs}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PROOF ROW (dark) ────────────────────────────────────────────────────────
function CommerceProof() {
  const stats: { n: ReactNode; l: string }[] = [
    {
      n: <>1{<Spark color={C.color} />}</>,
      l: 'database under products, orders, and customers — nothing to sync',
    },
    { n: 'D2C + B2B', l: 'from the same commerce engine — wholesale toggles on per account' },
    { n: '$0', l: 'extra for Invoicing — estimates, work orders, and AR ride along with Commerce' },
    { n: '<200ms', l: 'storefront TTFB target via SSR and CDN caching' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div style={{ maxWidth: '760px' }}>
        <Display size={46} lineHeight={48} color="#FFFFFF">
          See the whole funnel, on the same data
          <Spark color={C.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: '22px 0 0',
          }}
        >
          Because orders, customers, and content share one database, the numbers reconcile by
          default — no exports, no two systems disagreeing about what happened.
        </p>
      </div>
      <div className="mkt-grid-4-2-1" style={{ marginTop: '56px', gap: 0 }}>
        {stats.map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: i === 0 ? '0' : '0 0 0 32px',
              borderLeft: i === 0 ? 'none' : '1px solid #262626',
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(40px, 5vw, 56px)',
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                marginTop: '12px',
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '22px',
                color: '#A1A1AA',
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ─────────────────────────────────────────────────────────────
function CommercePricing() {
  return (
    <Section padding="lg">
      <div
        className="mkt-stack-on-tablet"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderTop: `3px solid ${C.color}`,
          borderRadius: '14px',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '56px',
                letterSpacing: '-0.025em',
                color: 'var(--color-text-primary)',
              }}
            >
              $49
            </span>
            <span
              style={{ fontFamily: SANS, fontSize: '16px', color: 'var(--color-text-tertiary)' }}
            >
              /mo
            </span>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '22px',
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: '640px',
            }}
          >
            A flat $49/mo — the transactional core, with Invoicing bundled in free. No tiers, no
            per-seat charge, no per-product metering. Pair it with Builder for a hosted storefront
            or run it headless against the API. Start free for 14 days; no card to begin.
          </p>
        </div>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
            Activate Commerce
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
function CommerceCta() {
  return (
    <section
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', gap: '36px', alignItems: 'flex-start' }}
      >
        <Display size={88} lineHeight={84} color="#FFFFFF">
          Start selling this afternoon
          <Spark color={C.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: 0,
          }}
        >
          Add products, connect Stripe, and take your first order — no contract, no migration
          weekend. Turn Commerce off the day you stop selling; your data stays, and you keep your
          processor relationships.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <Button size="xl" style={{ backgroundColor: C.color }}>
            Start selling →
          </Button>
          <a href="#journey">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              See how an order flows
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}

/** Small inline check glyph used by the receipt's Paid badge. */
function Check({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
