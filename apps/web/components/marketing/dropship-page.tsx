import type { ReactNode } from 'react';
import { Button, Text } from '@wizeworks/silicaui-react';
import { Display, Dot, getModuleColor, Section, SectionHeader, Spark } from './primitives';
import { DropshipHero } from './dropship-hero';
import { DropshipConnect, DropshipMargin } from './dropship-sections';
import { DropshipRouting, DropshipInventory, DropshipTracking } from './dropship-devices';
import { Faq, type FaqItem } from './faq';

/**
 * The /dropship marketing page — Dropship is "sell without holding inventory,
 * on a real platform underneath." The thesis is the supply chain made one
 * object: a product flows IN from a supplier's catalog, gets a markup applied,
 * and when it sells the order routes back OUT to the supplier(s) with tracking
 * flowing to the customer — all hands-off. The page walks hero (routed order) →
 * supplier connect + sync → margin math → automated routing → inventory sync →
 * tracking sync → "works alongside Commerce" → dark proof → pricing → FAQ → CTA.
 * Dropship emerald is a signal (supplier dot, routed badge, margin number, the
 * spark) — never flood fill; the hero takes the light emerald tint.
 *
 * Bespoke + full-length, modeled on commerce-page.tsx / b2b-page.tsx; the
 * markup-heavy device sections live in dropship-hero/-sections/-devices.tsx so
 * each file stays cohesive.
 *
 * Facts grounded in docs/14 (Dropship PRD) + docs/17 (billing) + the real
 * @sparx/dropship package and dashboard surfaces. The selectable vendors are
 * Printify, Printful, DSers, Spocket, and a CSV feed (the only self-serve APIs;
 * the rest are honestly omitted). Pricing rules are percentage markup,
 * multiplier, flat markup, and target margin. Routed-order status is
 * submitted → shipped → delivered. Dropship is a flat $29/mo, no tiers, 14-day
 * trial, no card to begin. Unlike B2B, Dropship is NOT in the module REQUIRES
 * graph — it works ALONGSIDE Commerce (it imports into your catalog and routes
 * your orders), so the page says "works alongside," never "auto-activates."
 */
export function DropshipPage() {
  return (
    <>
      <DropshipHero />
      <DropshipConnect />
      <DropshipMargin />
      <DropshipRouting />
      <DropshipInventory />
      <DropshipTracking />
      <DropshipWithCommerce />
      <DropshipProof />
      <DropshipPricing />
      <Faq
        items={DROPSHIP_FAQ}
        id="faq"
        heading={
          <>
            Dropship questions
            <Spark color={M.color} />
          </>
        }
        lede="Suppliers, routing, margins, and how it fits Commerce — answered straight. Still deciding? Read the dropship docs or start the 14-day trial."
      />
      <DropshipCta />
    </>
  );
}

const M = getModuleColor('dropship');
const C = getModuleColor('commerce');

// Page-specific FAQ. Real evaluation questions for sparx Dropship, answered
// straight and grounded in docs/14 (PRD) + docs/17 (billing) + @sparx/dropship —
// no tier/plan language. Feeds the FAQPage JSON-LD via <Faq>, so accuracy is
// load-bearing.
const DROPSHIP_FAQ: FaqItem[] = [
  {
    id: 'dropship-pricing',
    question: 'How much does sparx Dropship cost?',
    answer:
      'A flat $29/mo. No tiers, no per-order dropship fee, and no reseller markup between you and your supplier — you connect to your own supplier accounts directly. Add it alongside whatever else you run; it lands on one bill. Start on a 14-day free trial; no card required to begin.',
  },
  {
    id: 'dropship-suppliers',
    question: 'Which suppliers can I connect?',
    answer:
      'Printify and Printful for print-on-demand, DSers for AliExpress-sourced products, and Spocket for US/EU suppliers — each connects by API with a token you paste in. For any supplier without a usable API, a CSV feed imports the catalog and you fulfill those orders manually. We only list suppliers with a real, self-serve integration, so there are no dead Connect buttons.',
  },
  {
    id: 'dropship-needs-commerce',
    question: 'Do I need Commerce to use Dropship?',
    answer:
      'In practice, yes — Dropship is a commerce capability. Imported products become products in your Commerce catalog, and the orders that route to suppliers are the orders your store takes. Run Commerce for the catalog, checkout, and orders; add Dropship to connect suppliers, price by markup, and route fulfillment automatically. The two work as one flow on one bill.',
  },
  {
    id: 'dropship-routing',
    question: 'How does automated order routing work?',
    answer:
      'When an order with dropship products is placed, sparx splits the lines into a fulfillment group per supplier and submits each group through that supplier’s connector automatically. Submission is idempotent on the order id, so a retry never double-orders. A multi-supplier order becomes several groups that fulfill independently, and the customer gets combined tracking once every group ships. A failed submission holds the group and alerts you rather than silently dropping it.',
  },
  {
    id: 'dropship-margins',
    question: 'How is my price and margin set?',
    answer:
      'You set a pricing rule per supplier — a percentage markup, a multiplier, a flat markup, or a target margin — with rounding and an optional cap at the supplier MSRP. Every imported product prices itself off the supplier cost, and when a cost changes on the next sync, your sell price recomputes. The dashboard reports profit and margin per product, per supplier, and per order, so you always see what each sale actually made.',
  },
  {
    id: 'dropship-inventory-tracking',
    question: 'What about inventory and tracking?',
    answer:
      'API suppliers sync live stock on a schedule: a sold-out product is flagged unavailable and you’re notified, while an individual out-of-stock colour or size greys out on the product page rather than hiding the whole product. Print-on-demand suppliers are made-to-order, so their stock is unlimited. When a supplier ships, sparx forwards the tracking to your customer in a branded email from your own domain and logs the shipment on the customer record — the supplier is never named to the buyer.',
  },
  {
    id: 'dropship-pod',
    question: 'Can I sell print-on-demand products?',
    answer:
      'Yes. Connect Printify or Printful, import the products you’ve already designed in their tools, and route orders to them by SKU — sparx handles the catalog, pricing, order routing, and tracking. Designing artwork inside sparx and publishing it to the supplier is on the roadmap; today the flow imports finished products and routes orders, with no artwork moving through sparx.',
  },
];

// ── WORKS ALONGSIDE COMMERCE ────────────────────────────────────────────────
function DropshipWithCommerce() {
  const panels: {
    title: string;
    body: string;
    points: string[];
    dot: string;
    bg: string;
  }[] = [
    {
      title: 'Commerce runs the store',
      body: 'The catalog, the converting checkout, Stripe payments, tax and carrier rates, and the order record all live in Commerce. Your customers buy from one store, one cart, one checkout.',
      points: [
        'Imported dropship products are real products in your catalog.',
        'Dropship lines and stock you hold can sit on the same order.',
        'One customer record, one order timeline, one set of reports.',
      ],
      dot: C.color,
      bg: C.bg,
    },
    {
      title: 'Dropship runs the supply',
      body: 'Connect suppliers, import and price their catalogs, and hand off fulfillment. Dropship adds the supply side to Commerce — it doesn’t replace the store, it feeds it.',
      points: [
        'Supplier connectors, catalog + inventory sync, margin rules.',
        'Automatic order routing, split by supplier, with tracking back.',
        'Per-supplier profitability — cost, revenue, profit, margin.',
      ],
      dot: M.color,
      bg: M.bg,
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        headline="Hands-off fulfillment, on the same store"
        lede="Dropship is the supply side of Commerce, not a separate system. Commerce takes the order; Dropship sources and ships it. Same catalog, same checkout, same customer record — you just stop holding the inventory and packing the boxes."
      />
      <div className="mt-13 grid grid-cols-1 gap-6 md:grid-cols-2">
        {panels.map((p) => (
          <div
            key={p.title}
            className={`${p.bg} bg-soft border-base-300 flex flex-col gap-4 rounded-[14px] border p-8`}
          >
            <h3 className="m-0 font-sans text-2xl font-medium tracking-[-0.02em]">{p.title}</h3>
            <Text className="text-md m-0">{p.body}</Text>
            <ul className="m-0 grid list-none gap-3 p-0">
              {p.points.map((pt) => (
                <li key={pt} className="flex items-start gap-3">
                  <span className="shrink-0 pt-[7px]">
                    <Dot color={p.dot} size={7} />
                  </span>
                  <Text as="span" className="text-sm">
                    {pt}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── DARK PROOF ──────────────────────────────────────────────────────────────
function DropshipProof() {
  const stats: { n: ReactNode; l: string }[] = [
    { n: '$0', l: 'inventory held — you never buy stock before a customer does' },
    {
      n: <>1{<Spark color={M.color} />}</>,
      l: 'order object — dropship and stock-held lines fulfill on the same record',
    },
    { n: 'auto', l: 'routing, splitting, and tracking — submitted the moment an order lands' },
    { n: 'per-order', l: 'profit and margin — cost vs revenue, by product and supplier' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[760px]">
        <Display size={46} lineHeight={48}>
          A supply chain you don&rsquo;t have to run
          <Spark color={M.color} />
        </Display>
        <Text variant="lead" className="mt-6 max-w-[640px]">
          No warehouse, no packing, no buying stock on a bet. Connect the suppliers, set your
          margins, and let orders route themselves — while the platform keeps the catalog, the
          customer, and the profit math all in one place.
        </Text>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i === 0 ? undefined : 'border-base-300 border-l pl-8'}>
            <div className="font-sans text-[clamp(34px,5vw,52px)] leading-none font-medium tracking-[-0.03em]">
              {s.n}
            </div>
            <Text className="mt-3 text-sm">{s.l}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ───────────────────────────────────────────────────────────
function DropshipPricing() {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col lg:flex-row ${M.bg} bg-soft border-base-300 items-center justify-between gap-8 rounded-[14px] border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-sans text-[56px] font-medium tracking-[-0.025em]">$29</span>
            <Text as="span" className="text-md">
              /mo
            </Text>
          </div>
          <Text className="m-0 max-w-[660px] text-sm">
            A flat $29/mo — supplier connectors, catalog and inventory sync, markup rules, automated
            order routing, and tracking sync. No per-order dropship fee and no reseller cut; you
            connect to your own supplier accounts directly. Works alongside Commerce, which runs
            your catalog and checkout. Start free for 14 days; no card to begin.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button color="primary" size="lg">
            Activate Dropship
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
function DropshipCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Start selling without the warehouse
          <Spark color={M.color} />
        </Display>
        <Text variant="lead" className="m-0 max-w-[640px]">
          Connect a supplier, import a few products, set a markup rule, and take your first order —
          routed and tracked for you. No stock to buy, no boxes to pack, no migration weekend. Turn
          Dropship off the day you stop, and your products and orders stay yours.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <Button color="module-dropship" size="xl">
            Activate Dropship →
          </Button>
          <a href="#routing">
            <Button size="xl" variant="outline">
              See how an order routes
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
