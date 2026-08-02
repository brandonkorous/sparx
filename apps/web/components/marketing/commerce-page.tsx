import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
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
 * $49/mo with Invoicing + Inventory bundled free — no tiers, no "+", no "Pro+".
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
        accent={C.color}
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

// Page-specific FAQ. Real evaluation questions for sparx Commerce, answered
// straight and grounded in docs/09 (PRD) + docs/17 (billing) — no tier/plan
// language. Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing.
const COMMERCE_FAQ: FaqItem[] = [
  {
    id: 'commerce-pricing',
    question: 'How much does sparx Commerce cost?',
    answer:
      'A flat $49/mo, with Invoicing and Inventory included free. No tiers and no setup fee — turn Commerce on, add any other modules à la carte, and it all lands on one bill. Start on a 14-day free trial; no card required to begin.',
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
    'invoicing + inventory free',
  ];
  return (
    <section className={`${C.bg} bg-soft px-page pb-section-lg pt-[clamp(56px,9vw,96px)]`}>
      <Container>
        <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
          <div className="min-w-0 flex-1">
            <Display as="h1" size={88} lineHeight={84}>
              Sell, ship, get paid
              <Spark color={C.color} />
            </Display>
            <p className="mt-7 max-w-[560px] font-sans text-[clamp(16px,1.6vw,20px)] leading-[1.55] font-normal">
              {lede}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button color="neutral" size="lg">
                Start selling →
              </Button>
              <a href="#journey">
                <Button size="lg" variant="outline">
                  See how an order flows
                </Button>
              </a>
            </div>
            <ul className="mt-6 flex list-none flex-wrap items-center gap-2.5 p-0">
              {chips.map((c) => (
                <li
                  key={c}
                  className="border-base-300 bg-base-100 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                >
                  <Dot color={C.color} size={6} />
                  <span className="font-mono text-sm">{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full min-w-0 flex-1">
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
    <div className="border-base-300 bg-base-100 overflow-hidden rounded-2xl border shadow-lg">
      <div className="border-base-300 flex items-center justify-between border-b px-5 py-4">
        <span className="flex items-center gap-2.5">
          <Dot color={C.color} size={9} />
          <span>
            <span className="font-sans text-sm font-medium">{order.number}</span>
            <br />
            <span className="font-sans text-sm">{customer.name} · just now</span>
          </span>
        </span>
        <span
          className={`${C.bg} bg-soft ${C.ink} inline-flex items-center gap-[7px] rounded-full px-3 py-1 font-sans text-sm font-medium`}
        >
          <Check size={13} color={C.color} /> Paid
        </span>
      </div>
      {order.products.map((it) => (
        <div key={it.sku} className="border-base-200 flex items-center gap-3 border-b px-5 py-3">
          <span className="bg-base-200 border-base-300 size-[38px] shrink-0 rounded-lg border" />
          <span>
            <span className="font-sans text-sm font-medium">{it.name}</span>
            <br />
            <span className="font-sans text-sm">
              {it.sku} · qty {it.qty}
            </span>
          </span>
          <span className="ml-auto font-sans text-sm">{it.price}</span>
        </div>
      ))}
      <div className="px-5 py-3.5">
        {[
          ['Subtotal', order.subtotal],
          [order.shipping.label, order.shipping.value],
          [order.tax.label, order.tax.value],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between py-1 font-sans text-sm">
            <span>{l}</span>
            <span>{v}</span>
          </div>
        ))}
        <div className="border-base-300 mt-2 flex items-baseline justify-between border-t pt-3">
          <span className="font-sans text-sm font-medium">Total</span>
          <span className="font-sans text-2xl font-medium tracking-[-0.02em]">{order.total}</span>
        </div>
      </div>
      <div className="border-base-300 bg-base-200 flex items-center gap-2 border-t px-5 py-3">
        <Dot color={C.color} size={6} />
        <span className="font-mono text-sm">
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
      <div className="border-base-300 mt-12 grid grid-cols-1 gap-0 overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4">
        {methods.map((m, i) => (
          <div
            key={m.nm}
            className={`bg-base-100 flex flex-col gap-2 px-6 py-7 ${
              i === 0 ? '' : 'border-base-300 border-l'
            }`}
          >
            <span
              className={`${C.bg} bg-soft mb-1 flex size-[34px] items-center justify-center rounded-lg`}
            >
              <Dot color={C.color} size={9} />
            </span>
            <span className="text-md font-sans font-medium tracking-[-0.01em]">{m.nm}</span>
            <span className="font-sans text-sm">{m.ds}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-[720px] font-sans text-sm">
        Test mode runs against staging, payment intents confirm on submit, and refunds return to the
        original method. Need net terms or a PO at checkout instead?{' '}
        <a href="/b2b" className={`${C.ink} font-medium`}>
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
      pctColor: 'var(--color-base-content)',
      barW: '12%',
      barColor: 'var(--color-base-content)',
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
      <div className="mt-13 grid grid-cols-1 items-end gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rungs.map((r) => (
          <div
            key={r.when}
            className="border-base-300 bg-base-100 flex flex-col gap-3.5 rounded-xl border px-6 pt-6 pb-7"
          >
            <span className="font-mono text-sm">{r.when}</span>
            <span
              className="font-sans leading-none font-medium tracking-[-0.03em]"
              // Per-rung display size + hue are data-driven, so the computed
              // clamp and the token color stay inline.
              style={{ fontSize: `clamp(48px, 7vw, ${r.pctSize}px)`, color: r.pctColor }}
            >
              {r.pct}
            </span>
            <span
              className="h-1.5 rounded-full"
              // Bar width + fill encode the rung's value — dynamic by definition.
              style={{ width: r.barW, backgroundColor: r.barColor }}
            />
            <p className="font-sans text-sm">{r.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 max-w-[680px] font-sans text-sm">
        The fee is taken through Stripe Connect and is separate from Stripe&rsquo;s own processing
        rate. No per-seat charges, no per-product metering — see{' '}
        <a href="/pricing" className={`${C.ink} font-medium`}>
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
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ops.map((o) => (
          <div
            key={o.title}
            className="border-base-300 bg-base-200 flex min-h-[178px] flex-col gap-3 rounded-xl border p-6"
          >
            <span className={`${C.bg} bg-soft flex size-8 items-center justify-center rounded-lg`}>
              <Dot color={C.color} size={9} />
            </span>
            <h3 className="m-0 font-sans text-lg font-medium tracking-[-0.01em]">{o.title}</h3>
            <p className="m-0 font-sans text-sm">{o.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── HEADLESS / HOSTED ───────────────────────────────────────────────────────
function HeadlessOrHosted() {
  // No `tag` field: the uppercase mono label that used to sit above each card's
  // <h3> was an eyebrow (RULE #2). The module combination it named is already
  // carried, unambiguously, by the `runs` line at the foot of the card.
  const ways: {
    title: string;
    body: string;
    points: string[];
    dot: string;
    runs: string;
  }[] = [
    {
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
      <div className="mt-13 grid grid-cols-1 gap-6 md:grid-cols-2">
        {ways.map((w, i) => (
          <div
            key={w.title}
            className={`${
              i === 0 ? `${C.bg} bg-soft` : 'bg-base-100'
            } border-base-300 flex flex-col gap-4 rounded-xl border p-8`}
          >
            <h3 className="m-0 font-sans text-2xl font-medium tracking-[-0.02em]">{w.title}</h3>
            <p className="text-md m-0 font-sans">{w.body}</p>
            <ul className="m-0 grid list-none gap-3 p-0">
              {w.points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="shrink-0 pt-[7px]">
                    <Dot color={w.dot} size={7} />
                  </span>
                  <span className="font-sans text-sm">{p}</span>
                </li>
              ))}
            </ul>
            <span className="mt-auto pt-1 font-mono text-sm">{w.runs}</span>
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
      {/* Inside the dark island the base ramp is flipped, so ink resolves from
          tokens — no #FFFFFF / #A1A1AA / #262626 hand-picked for the band. */}
      <div className="max-w-[760px]">
        <Display size={46} lineHeight={48}>
          See the whole funnel, on the same data
          <Spark color={C.color} />
        </Display>
        <p className="mt-5 max-w-[640px] font-sans text-lg">
          Because orders, customers, and content share one database, the numbers reconcile by
          default — no exports, no two systems disagreeing about what happened.
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i === 0 ? '' : 'border-base-300 border-l pl-8'}>
            <div className="font-sans text-[clamp(40px,5vw,56px)] leading-none font-medium tracking-[-0.03em]">
              {s.n}
            </div>
            <div className="mt-3 font-sans text-sm">{s.l}</div>
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
        className={`flex flex-col lg:flex-row ${C.bg} bg-soft border-base-300 items-center justify-between gap-8 rounded-xl border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-sans text-[56px] font-medium tracking-[-0.025em]">$49</span>
            <span className="text-md font-sans">/mo</span>
          </div>
          <p className="m-0 max-w-[640px] font-sans text-sm">
            A flat $49/mo — the transactional core, with Invoicing and Inventory bundled in free. No
            tiers, no per-seat charge, no per-product metering. Pair it with Builder for a hosted
            storefront or run it headless against the API. Start free for 14 days; no card to begin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button color="neutral" size="lg">
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
    // A real dark island rather than a hand-painted #0A0A0A band: `surface="dark"`
    // flips the whole base ramp, so the headline, lede, and outline button all
    // resolve their own ink.
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Start selling this afternoon
          <Spark color={C.color} />
        </Display>
        <p className="m-0 max-w-[640px] font-sans text-lg">
          Add products, connect Stripe, and take your first order — no contract, no migration
          weekend. Turn Commerce off the day you stop selling; your data stays, and you keep your
          processor relationships.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button color="module-commerce" size="xl">
            Start selling →
          </Button>
          <a href="#journey">
            <Button size="xl" variant="outline">
              See how an order flows
            </Button>
          </a>
        </div>
      </div>
    </Section>
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
