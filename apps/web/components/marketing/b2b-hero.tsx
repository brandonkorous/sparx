import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Dot, getModuleColor, Spark, Text } from './primitives';
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

export function B2bHero() {
  const lede =
    'sparx B2B is wholesale on the same engine as your retail orders — one catalog, one checkout, one customer record. Each business buyer logs in to their own price list, their net terms, and an RFQ-to-quote flow. Account pricing, credit limits, bulk POs, and fleet accounts — native, not a bolt-on. Pair the Scheduling module to book service against a fleet.';
  const chips = ['account price lists', 'net terms + credit', 'RFQ → quote', 'layered on commerce'];
  return (
    <section className={`${M.bg} px-page pb-section-lg bg-soft pt-[clamp(56px,9vw,96px)]`}>
      <Container>
        <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
          <div className="min-w-0 flex-1">
            <Display as="h1" size={84} lineHeight={80}>
              Wholesale, done right
              <Spark color={M.color} />
            </Display>
            <Text size={18} className="mt-7 max-w-[580px]">
              {lede}
            </Text>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button color="primary" size="lg">
                Activate B2B →
              </Button>
              <a href="#price-list">
                <Button size="lg" variant="outline">
                  See account pricing
                </Button>
              </a>
            </div>
            <ul className="mt-6 flex list-none flex-wrap items-center gap-2.5 p-0">
              {chips.map((c) => (
                <li
                  key={c}
                  className="bg-base-100 border-base-300 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                >
                  <Dot color={M.color} size={6} />
                  <Text as="span" size={12} mono>
                    {c}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full min-w-0 flex-1">
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
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border shadow-lg">
      <AccountHeader b2b={b2b} />
      <AccountStats b2b={b2b} />
      <AccountCredit b2b={b2b} />
    </div>
  );
}

function AccountHeader({ b2b }: { b2b: ExampleBusiness['b2b'] }) {
  return (
    <div className="border-base-300 flex items-center gap-3 border-b px-5 py-4">
      <span
        className={`${M.bg} border-module-b2b bg-soft flex size-[42px] shrink-0 items-center justify-center rounded-lg border-[1.5px]`}
      >
        <Dot color={M.color} size={9} />
      </span>
      <span className="min-w-0">
        <Text as="span" size={16} weight={500} className="block">
          {b2b.account}
        </Text>
        <Text as="span" size={12} mono>
          B2B account · {b2b.terms}
        </Text>
      </span>
      <span
        className={`${M.bg} ${M.ink} bg-soft ml-auto inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-sans text-sm font-medium`}
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
    <div className="border-base-300 grid grid-cols-3 border-b">
      {cells.map(([v, l], i) => (
        <div key={l} className={i === 0 ? 'px-4 py-3.5' : 'border-base-200 border-l px-4 py-3.5'}>
          <Text as="div" size={17} weight={500} className="tracking-[-0.01em]">
            {v}
          </Text>
          <Text as="div" size={11} mono className="mt-0.5">
            {l}
          </Text>
        </div>
      ))}
    </div>
  );
}

function AccountCredit({ b2b }: { b2b: ExampleBusiness['b2b'] }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between">
        {/* Field label inside the device mockup. Sentence case, no letterspacing —
            the uppercase micro-cap treatment is gone brand-wide, mimicry or not:
            real product UI does not use it either, so imitating it made the
            mockup look less like the product, not more. */}
        <Text as="span" size={11} mono>
          credit · {b2b.creditUsed} of {b2b.creditLimit}
        </Text>
        <Text as="span" size={11} mono className={M.ink}>
          {b2b.creditUsedPct}
        </Text>
      </div>
      <span className="bg-base-200 block h-2 overflow-hidden rounded-full">
        <span
          className="bg-module-b2b block h-full rounded-full"
          style={{ width: b2b.creditUsedPct }}
        />
      </span>
      <div className="bg-base-200 border-base-300 mt-1 flex items-center gap-2.5 rounded-lg border px-3.5 py-3">
        <Text as="span" size={12} mono className={`${M.ink} shrink-0`}>
          {b2b.quote.number}
        </Text>
        <Text as="span" size={13}>
          {b2b.quote.lines} lines · {b2b.quote.total}
        </Text>
        <span
          className={`${M.bg} ${M.ink} bg-soft ml-auto shrink-0 rounded-full px-2.5 py-[3px] font-sans text-sm font-medium`}
        >
          {b2b.quote.status}
        </span>
      </div>
    </div>
  );
}
