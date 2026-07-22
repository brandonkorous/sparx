import { Button, Text } from '@wizeworks/silicaui-react';
import { Container, Display, Dot, getModuleColor, Spark } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The /dropship hero — a tinted-band split: copy on the left, the marquee
 * ROUTED-ORDER card on the right. The card crossfades through EXAMPLE_BUSINESSES
 * so Dropship reads as the engine for ANY store — POD apparel, US/EU stocked
 * goods, AliExpress-sourced, a CSV-fed industrial supplier — never anchored on
 * one vertical. Every scene has the same shape (supplier + rule, a routed order
 * with status + tracking, the order-level profit) so the card never reflows.
 *
 * Grounded in docs/14 (Dropship PRD) + the real @sparx/dropship vendor catalog
 * (Printify, Printful, DSers, Spocket, CSV) and the dashboard routed-order
 * status (submitted → shipped → delivered). Dropship emerald is a signal, not
 * fill; the band is the light emerald tint with near-black ink. See
 * feedback-industry-agnostic-no-diesel + the rotation rule.
 */

const M = getModuleColor('dropship');

export function DropshipHero() {
  const lede =
    'Connect a supplier, import their catalog, set a markup rule. When an order comes in, sparx routes it to the right supplier automatically, pulls back tracking, and emails the customer — all without you touching a box. Sell without holding inventory, on a real platform where suppliers, products, and orders live in one place.';
  const chips = ['supplier connectors', 'auto order routing', 'margin rules', 'tracking sync'];
  return (
    <section className={`${M.bg} bg-soft px-page pb-section-lg pt-[clamp(56px,9vw,96px)]`}>
      <Container>
        <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
          <div className="min-w-0 flex-1">
            <Display as="h1" size={84} lineHeight={80}>
              Sell it, never stock it
              <Spark color={M.color} />
            </Display>
            <Text className="text-ink-muted mt-7 max-w-[580px] text-[clamp(16px,1.6vw,20px)] leading-[1.55] font-normal">
              {lede}
            </Text>
            <div className="mt-[34px] flex flex-wrap items-center gap-3">
              <Button color="neutral" size="lg">
                Activate Dropship →
              </Button>
              <a href="#routing">
                <Button size="lg" variant="outline">
                  See how an order routes
                </Button>
              </a>
            </div>
            <ul className="mt-6 flex list-none flex-wrap items-center gap-2.5 p-0">
              {chips.map((c) => (
                <li
                  key={c}
                  className="bg-base-100 border-base-300 inline-flex items-center gap-2 rounded-full border px-3 py-[7px]"
                >
                  <Dot color={M.color} size={6} />
                  <Text as="span" className="text-mini text-ink-muted font-mono">
                    {c}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full min-w-0 flex-1">
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <RoutedOrderCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — one real routed order: it came in, split
 *  to a supplier, and tracking flowed back, with the order-level profit shown. */
function RoutedOrderCard({ business }: { business: ExampleBusiness }) {
  const { dropship: d, customer } = business;
  return (
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border shadow-lg">
      <RoutedHeader d={d} customerName={customer.name} />
      <RoutedProfit d={d} />
      <RoutedTracking d={d} />
    </div>
  );
}

type D = ExampleBusiness['dropship'];

function RoutedHeader({ d, customerName }: { d: D; customerName: string }) {
  return (
    <div className="border-base-300 flex items-center justify-between border-b px-5 py-4">
      <span className="flex items-center gap-2.5">
        <Dot color={M.color} size={9} />
        <span>
          <Text as="span" className="text-small text-base-content font-medium">
            {d.routed.number}
          </Text>
          <br />
          <Text as="span" className="text-mini text-ink-subtle">
            {customerName} · routed to {d.supplier}
          </Text>
        </span>
      </span>
      <span
        className={`${M.bg} bg-soft ${M.ink} text-mini inline-flex shrink-0 items-center gap-[7px] rounded-full px-3 py-[5px] font-medium`}
      >
        <Dot color={M.color} size={6} /> {d.routed.status}
      </span>
    </div>
  );
}

function RoutedProfit({ d }: { d: D }) {
  const cells: [string, string][] = [
    [d.routed.revenue, 'revenue'],
    [d.routed.cost, 'supplier cost'],
    [d.routed.profit, 'your profit'],
  ];
  return (
    <div className="border-base-300 grid grid-cols-3 border-b">
      {cells.map(([v, l], i) => (
        <div
          key={l}
          className={`px-4 py-3.5 ${i === 0 ? '' : 'border-base-200 border-l'}`.trimEnd()}
        >
          <div
            className={`text-body-lg font-medium tracking-[-0.01em] ${i === 2 ? M.ink : 'text-base-content'}`}
          >
            {v}
          </div>
          <Text className="text-micro text-ink-subtle mt-0.5 font-mono">{l}</Text>
        </div>
      ))}
    </div>
  );
}

function RoutedTracking({ d }: { d: D }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="bg-base-200 border-base-300 flex items-center gap-2.5 rounded-[10px] border px-3.5 py-3">
        <TruckIcon size={16} color={M.color} />
        <span className="min-w-0">
          <Text as="span" className="text-caption text-base-content block font-medium">
            {d.routed.carrier}
          </Text>
          <Text as="span" className="text-micro text-ink-subtle font-mono">
            {d.routed.tracking}
          </Text>
        </span>
        <Text as="span" className={`text-mini ml-auto shrink-0 font-medium ${M.ink}`}>
          sent to customer
        </Text>
      </div>
      <div className="flex items-center gap-2.5">
        <Dot color={M.color} size={6} />
        <Text as="span" className="text-mini text-ink-subtle font-mono">
          {d.connection} · {d.rule} · no inventory held
        </Text>
      </div>
    </div>
  );
}

function TruckIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
